import Phaser from "phaser";
import { createRng, type Rng } from "../../core/prng";
import { buildRuntimeConfig } from "../../data/runtimeConfig";
import type { StaticGameData } from "../../data/staticGameData";
import type { EnemyType } from "../../data/types";
import { computePressure } from "../director/pressure";
import { buildWavePlan, type WavePlan, type WaveSpawnEvent } from "../director/waveDirector";
import { applyDailyToConfig, getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { Tail, type ScrapType } from "../entities/tail";
import { GAME_EVENTS } from "../events";
import { consumeActions, inputState } from "../input/inputState";
import type { RunMode, RunState } from "../run/runState";

type EnemyEntity = {
  sprite: ArcadeImage;
  type: EnemyType;
  hp: number;
  nextFireAt: number;
  cutReadyAt: number;
};

type ProjectileEntity = {
  sprite: ArcadeImage;
  owner: "enemy" | "player";
  damage: number;
  bornAt: number;
  lifetimeSec: number;
};

type ArcadeImage = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };
type ArcadeStaticImage = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.StaticBody };

export class GameScene extends Phaser.Scene {
  private rng!: Rng;
  private staticData!: StaticGameData;
  private state!: RunState;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: {
    wasd: {
      w: Phaser.Input.Keyboard.Key;
      a: Phaser.Input.Keyboard.Key;
      s: Phaser.Input.Keyboard.Key;
      d: Phaser.Input.Keyboard.Key;
    };
  };

  private player!: ArcadeImage;
  private recycler!: ArcadeStaticImage;

  private tail!: Tail;
  private tailGroup!: Phaser.Physics.Arcade.Group;
  private scrapGroup!: Phaser.Physics.Arcade.Group;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectileGroup!: Phaser.Physics.Arcade.Group;
  private shrapnelGroup!: Phaser.Physics.Arcade.Group;

  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];

  private wavePlan!: WavePlan;
  private waveTime = 0;
  private spawnCursor = 0;
  private pendingTelegraphs: Array<{ x: number; y: number; type: EnemyType; tLeft: number }> = [];
  private awaitingUpgrade = false;

  private playerInvuln = 0;
  private flipCooldown = 0;
  private flipPulse = 0;
  private dashCooldown = 0;
  private dashTime = 0;

  private captureCooldown = 0;
  private banking = { active: false, t: 0 };

  constructor() {
    super("game");
  }

  init(data: { mode?: RunMode } = {}): void {
    this.registry.set("runMode", data.mode ?? "run");
  }

  create(): void {
    this.staticData = this.registry.get("staticGameData") as StaticGameData;
    const mode = (this.registry.get("runMode") as RunMode | undefined) ?? "run";

    const built = buildRuntimeConfig(this.staticData, {
      presetId: "normal",
      metaLevels: (this.registry.get("saveData") as any)?.meta?.nodeLevels ?? {},
    });

    this.rng = createRng(mode === "daily" ? `daily-run:${getUtcYyyymmdd()}` : `run:${Date.now()}`);

    this.state = {
      mode,
      rng: this.rng,
      config: built.config,
      perks: { ...built.basePerks },
      waveIndex: 1,
      bolts: 0,
      cores: 0,
      hp: built.config.player.hpMax,
      recentHits: [],
      pickedUpgrades: {},
      pityNoRareOrEpicPicks: 0,
    };

    if (mode === "daily") {
      const dateUtc = getUtcYyyymmdd();
      const sel = pickDailyVariant(this.state.config.daily, dateUtc);
      applyDailyToConfig(this.state.config, this.state.perks, this.state.config.daily, sel);
      this.state.daily = { dateUtc: sel.dateUtc, variantId: sel.variantId, specialRule: sel.specialRule };
    }

    this.registry.set("runState", this.state);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      wasd: {
        w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      },
    };

    this.createTextures();
    this.createWorld();
    this.createCollisions();
    this.startWave(1);

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      if (this.awaitingUpgrade) {
        this.awaitingUpgrade = false;
        this.state.waveIndex += 1;
        this.startWave(this.state.waveIndex);
      }
    });
  }

  update(_time: number, dtMs: number): void {
    const dt = dtMs / 1000;
    if (dt <= 0) return;

    this.updateTimers(dt);
    this.updateMovement(dt);
    this.updateTail(dt);
    this.updateMagnet(dt);
    this.updateFlipPulse(dt);
    this.updateEnemyAI(dt);
    this.updateProjectiles();
    this.updateBanking(dt);
    this.updateWave(dt);
  }

  private updateTimers(dt: number): void {
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.flipCooldown = Math.max(0, this.flipCooldown - dt);
    this.flipPulse = Math.max(0, this.flipPulse - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.captureCooldown = Math.max(0, this.captureCooldown - dt);

    const now = this.time.now / 1000;
    const windowSec = this.state.config.director.pressure.recentHitWindowSec;
    while (this.state.recentHits.length > 0 && now - this.state.recentHits[0]!.t > windowSec) {
      this.state.recentHits.shift();
    }
  }

  private updateMovement(dt: number): void {
    const { flip, dash } = consumeActions();
    const spaceDown = this.cursors.space ? Phaser.Input.Keyboard.JustDown(this.cursors.space) : false;
    const shiftDown = this.cursors.shift ? Phaser.Input.Keyboard.JustDown(this.cursors.shift) : false;

    if ((flip || spaceDown) && this.flipCooldown <= 0) this.doFlip();
    if ((dash || shiftDown) && this.isDashEnabled() && this.dashCooldown <= 0) this.doDash();

    const move = new Phaser.Math.Vector2(inputState.moveX, inputState.moveY);
    if (move.lengthSq() < 0.01) {
      const left = (this.cursors.left?.isDown ?? false) || this.keys.wasd.a.isDown;
      const right = (this.cursors.right?.isDown ?? false) || this.keys.wasd.d.isDown;
      const up = (this.cursors.up?.isDown ?? false) || this.keys.wasd.w.isDown;
      const down = (this.cursors.down?.isDown ?? false) || this.keys.wasd.s.isDown;
      move.set(Number(right) - Number(left), Number(down) - Number(up));
    }
    if (move.lengthSq() > 0) move.normalize();

    const tailPenalty = this.state.config.player.tailSpeedPenaltyPerSegment * this.tail.length;
    const baseSpeed = Math.max(this.state.config.player.speedMin, this.state.config.player.speedBase * (1 - tailPenalty));
    const speed = baseSpeed * (this.dashTime > 0 ? this.state.config.dash.speedMult : 1);

    const targetVx = move.x * speed;
    const targetVy = move.y * speed;
    const alpha = 1 - Math.pow(1 - clamp01(this.state.config.player.turnSmoothing), dt * 60);
    const vx = Phaser.Math.Linear(this.player.body.velocity.x, targetVx, alpha);
    const vy = Phaser.Math.Linear(this.player.body.velocity.y, targetVy, alpha);
    this.player.setVelocity(vx, vy);

    if (move.lengthSq() > 0.001) this.player.setRotation(Math.atan2(move.y, move.x));
  }

  private updateTail(dt: number): void {
    this.tail.update(dt, this.player.x, this.player.y);
  }

  private updateMagnet(dt: number): void {
    const magnet = this.state.config.magnet;
    const radius = clamp(magnet.radiusBase, 0, magnet.radiusMax);
    if (radius <= 0) return;

    this.scrapGroup.children.iterate((o) => {
      const spr = o as ArcadeImage | null;
      if (!spr) return null;
      const dx = this.player.x - spr.x;
      const dy = this.player.y - spr.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius) return null;
      const d = Math.sqrt(d2);
      if (d < 0.001) return null;
      const nx = dx / d;
      const ny = dy / d;
      const pull = magnet.pullAccelBase * (1 - d / radius);
      spr.body.velocity.x += nx * pull * dt;
      spr.body.velocity.y += ny * pull * dt;
      const spd = spr.body.velocity.length();
      if (spd > magnet.pullMaxSpeed) spr.body.velocity.scale(magnet.pullMaxSpeed / spd);
      return null;
    });
  }

  private updateFlipPulse(dt: number): void {
    if (this.flipPulse <= 0) return;
    const cfg = this.state.config.flip;
    const radius = cfg.radius;

    this.enemyGroup.children.iterate((o) => {
      const e = o as ArcadeImage | null;
      if (!e) return null;
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius || d2 < 0.001) return null;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      e.body.velocity.x += nx * cfg.pushForce * dt;
      e.body.velocity.y += ny * cfg.pushForce * dt;
      return null;
    });

    if (!cfg.deflectProjectiles) return;
    this.projectileGroup.children.iterate((o) => {
      const p = o as ArcadeImage | null;
      if (!p) return null;
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > radius * radius || d2 < 0.001) return null;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const speed = Math.max(60, p.body.velocity.length());
      p.body.velocity.x = nx * speed;
      p.body.velocity.y = ny * speed;
      const ent = this.projectiles.find((pp) => pp.sprite === p);
      if (ent) ent.owner = "player";
      return null;
    });
  }

  private updateEnemyAI(_dt: number): void {
    const now = this.time.now / 1000;
    const cfg = this.state.config;
    const speedMult = clamp(
      1 + cfg.waves.enemySpeedMultPerWave * Math.max(0, this.state.waveIndex - 1),
      1,
      cfg.waves.enemySpeedMultCap
    );

    for (const e of this.enemies) {
      const spr = e.sprite;
      if (!spr.active) continue;

      const dx = this.player.x - spr.x;
      const dy = this.player.y - spr.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const nx = d > 0.001 ? dx / d : 0;
      const ny = d > 0.001 ? dy / d : 0;

      if (e.type === "chaser") {
        spr.body.velocity.x = nx * cfg.enemies.chaser.speed * speedMult;
        spr.body.velocity.y = ny * cfg.enemies.chaser.speed * speedMult;
      } else if (e.type === "shooter") {
        const keep = cfg.enemies.shooter.keepDistance ?? 220;
        const spd = cfg.enemies.shooter.speed * speedMult;
        const wantAway = d < keep * 0.85;
        const wantToward = d > keep * 1.25;
        const dir = wantAway ? -1 : wantToward ? 1 : 0;
        spr.body.velocity.x = nx * spd * dir;
        spr.body.velocity.y = ny * spd * dir;

        if (now >= e.nextFireAt && cfg.enemies.shooter.projectile) {
          e.nextFireAt = now + (cfg.enemies.shooter.fireCooldownSec ?? 1.5);
          const pr = cfg.enemies.shooter.projectile;
          this.spawnProjectile("enemy", spr.x, spr.y, nx, ny, pr.speed * speedMult, pr.damage, pr.lifetimeSec);
        }
      } else if (e.type === "cutter") {
        const target = this.pickTailTarget();
        const tx = target?.x ?? this.player.x;
        const ty = target?.y ?? this.player.y;
        const ddx = tx - spr.x;
        const ddy = ty - spr.y;
        const dd = Math.sqrt(ddx * ddx + ddy * ddy);
        const nnx = dd > 0.001 ? ddx / dd : 0;
        const nny = dd > 0.001 ? ddy / dd : 0;
        spr.body.velocity.x = nnx * cfg.enemies.cutter.speed * speedMult;
        spr.body.velocity.y = nny * cfg.enemies.cutter.speed * speedMult;
      }

      spr.setRotation(Math.atan2(spr.body.velocity.y, spr.body.velocity.x));
    }
  }

  private updateProjectiles(): void {
    const now = this.time.now / 1000;
    for (const p of this.projectiles) {
      if (!p.sprite.active) continue;
      if (now - p.bornAt >= p.lifetimeSec) p.sprite.destroy();
    }
    this.projectiles = this.projectiles.filter((p) => p.sprite.active);
  }

  private updateWave(dt: number): void {
    if (this.awaitingUpgrade) return;
    this.waveTime += dt;

    for (const t of this.pendingTelegraphs) t.tLeft -= dt;
    const ready = this.pendingTelegraphs.filter((t) => t.tLeft <= 0);
    this.pendingTelegraphs = this.pendingTelegraphs.filter((t) => t.tLeft > 0);
    for (const s of ready) this.spawnEnemy(s.type, s.x, s.y);

    while (this.spawnCursor < this.wavePlan.spawns.length && this.wavePlan.spawns[this.spawnCursor]!.t <= this.waveTime) {
      const ev = this.wavePlan.spawns[this.spawnCursor]!;
      this.spawnCursor += 1;

      const pressure = this.getCurrentPressure();
      if (pressure > this.wavePlan.pressureTargets.max) {
        this.spawnScrapBurst(1);
        continue;
      }

      this.scheduleSpawnEvent(ev);
    }

    if (this.waveTime >= this.wavePlan.durationSec) this.onWaveComplete();
  }

  private updateBanking(dt: number): void {
    const inZone =
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.recycler.x, this.recycler.y) <= this.state.config.recycler.radius;
    if (inZone && this.tail.length > 0) {
      if (!this.banking.active) {
        this.banking.active = true;
        this.banking.t = 0;
      }
      this.banking.t += dt;
      if (this.banking.t >= this.state.config.recycler.bankTimeSec) {
        this.bankTail();
        this.banking.active = false;
        this.banking.t = 0;
      }
    } else {
      this.banking.active = false;
      this.banking.t = 0;
    }
  }

  private startWave(_waveIndex: number): void {
    const waveIndex = _waveIndex;
    this.waveTime = 0;
    this.spawnCursor = 0;
    this.pendingTelegraphs = [];

    const waveSet = this.state.config.waveSets.default;
    if (!waveSet) throw new Error("wave_sets.json: missing 'default'");
    const ctx = {
      tailLen: this.tail.length,
      hpRatio: this.state.config.player.hpMax > 0 ? this.state.hp / this.state.config.player.hpMax : 1,
      dailyRule: this.state.daily?.specialRule,
    };
    this.wavePlan = buildWavePlan(
      { waves: this.state.config.waves, director: this.state.config.director, tail: this.state.config.tail },
      waveSet,
      this.state.config.patterns,
      waveIndex,
      ctx,
      this.rng
    );

    if (import.meta.env.VITE_E2E === "1") {
      this.wavePlan.durationSec = Math.min(this.wavePlan.durationSec, 6);
      this.scrapGroup.clear(true, true);
      for (let i = 0; i < 3; i++) {
        this.spawnScrapAt(this.player.x + (i - 1) * 10, this.player.y);
      }
      return;
    }

    this.spawnScrapClusters(this.wavePlan.extraScrapClusters);
  }

  private scheduleSpawnEvent(ev: WaveSpawnEvent): void {
    for (let i = 0; i < ev.count; i++) {
      const pos = this.pickSpawnPos(ev.formation, i, ev.count, ev.arcDeg);
      this.spawnTelegraph(pos.x, pos.y, ev.type);
    }
  }

  private getCurrentPressure(): number {
    const cfg = this.state.config;
    const px = this.player.x;
    const py = this.player.y;

    const nearEnemiesRadius = cfg.director.pressure.radiusNearEnemies;
    const nearProjRadius = cfg.director.pressure.radiusNearProjectiles;
    const ne2 = nearEnemiesRadius * nearEnemiesRadius;
    const np2 = nearProjRadius * nearProjRadius;

    let nearEnemies = 0;
    for (const e of this.enemies) {
      if (!e.sprite.active) continue;
      const dx = e.sprite.x - px;
      const dy = e.sprite.y - py;
      if (dx * dx + dy * dy <= ne2) nearEnemies += 1;
    }

    let nearProjectiles = 0;
    for (const p of this.projectiles) {
      if (!p.sprite.active) continue;
      const dx = p.sprite.x - px;
      const dy = p.sprite.y - py;
      if (dx * dx + dy * dy <= np2) nearProjectiles += 1;
    }

    return computePressure(
      { director: cfg.director, tail: cfg.tail },
      { nearEnemies, nearProjectiles, recentHits: this.state.recentHits.length, tailLen: this.tail.length }
    );
  }

  private spawnTelegraph(x: number, y: number, type: EnemyType): void {
    const g = this.add.image(x, y, "telegraph").setDepth(15);
    this.pendingTelegraphs.push({ x, y, type, tLeft: this.state.config.director.telegraphSec });
    this.time.delayedCall(this.state.config.director.telegraphSec * 1000, () => g.destroy());
  }

  private spawnEnemy(type: EnemyType, x: number, y: number): void {
    type = this.applyCaps(type);
    const tex = type === "shooter" ? "enemy_shooter" : type === "cutter" ? "enemy_cutter" : "enemy_chaser";
    const spr = this.enemyGroup.create(x, y, tex) as ArcadeImage;
    spr.setDepth(25);
    spr.setCircle(12);
    spr.body.setAllowGravity(false);
    spr.setCollideWorldBounds(true);
    spr.body.setBounce(0.6, 0.6);
    spr.body.setDrag(40, 40);

    const base = this.state.config.enemies[type];
    const waveMultHp = clamp(
      1 + this.state.config.waves.enemyHpMultPerWave * Math.max(0, this.state.waveIndex - 1),
      1,
      this.state.config.waves.enemyHpMultCap
    );
    const hp = base.hp * waveMultHp;
    this.enemies.push({ sprite: spr, type, hp, nextFireAt: 0, cutReadyAt: 0 });
  }

  private applyCaps(type: EnemyType): EnemyType {
    const total = this.enemies.filter((e) => e.sprite.active).length;
    if (total >= this.wavePlan.caps.maxTotal) return "chaser";
    if (type === "shooter") {
      const n = this.enemies.filter((e) => e.sprite.active && e.type === "shooter").length;
      if (n >= this.wavePlan.caps.maxShooters) return "chaser";
    }
    if (type === "cutter") {
      const n = this.enemies.filter((e) => e.sprite.active && e.type === "cutter").length;
      if (n >= this.wavePlan.caps.maxCutters) return "chaser";
    }
    return type;
  }

  private spawnProjectile(
    owner: "enemy" | "player",
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    speed: number,
    damage: number,
    lifetimeSec: number
  ): void {
    const spr = this.projectileGroup.create(x, y, "projectile") as ArcadeImage;
    spr.setDepth(35);
    spr.setCircle(4);
    spr.body.setAllowGravity(false);
    spr.setVelocity(dirX * speed, dirY * speed);
    spr.setCollideWorldBounds(false);
    this.projectiles.push({ sprite: spr, owner, damage, bornAt: this.time.now / 1000, lifetimeSec });
  }

  private pickTailTarget(): { x: number; y: number } | null {
    const children = this.tailGroup.getChildren() as ArcadeImage[];
    if (children.length === 0) return null;
    const idx = clampInt(Math.floor(children.length * 0.8), 0, children.length - 1);
    const spr = children[idx]!;
    return { x: spr.x, y: spr.y };
  }

  private pickSpawnPos(formation: string, idx: number, count: number, arcDeg?: number): { x: number; y: number } {
    const cfg = this.state.config;
    const safe = cfg.director.safeSpawnDist;
    const rSafe = cfg.director.recyclerSafeDist;
    const px = this.player.x;
    const py = this.player.y;
    const rx = cfg.arena.recyclerPos.x;
    const ry = cfg.arena.recyclerPos.y;

    const tryPick = (angle: number, dist: number) => {
      const x = clamp(px + Math.cos(angle) * dist, 24, cfg.arena.width - 24);
      const y = clamp(py + Math.sin(angle) * dist, 24, cfg.arena.height - 24);
      if (Phaser.Math.Distance.Between(x, y, rx, ry) < rSafe) return null;
      if (Phaser.Math.Distance.Between(x, y, px, py) < safe) return null;
      return { x, y };
    };

    for (let attempt = 0; attempt < 14; attempt++) {
      let angle = this.rng.next() * Math.PI * 2;
      let dist = safe + this.rng.float(0, 180);

      if (formation === "corners") {
        const corners = [
          { x: 40, y: 40 },
          { x: cfg.arena.width - 40, y: 40 },
          { x: 40, y: cfg.arena.height - 40 },
          { x: cfg.arena.width - 40, y: cfg.arena.height - 40 },
        ];
        const c = corners[idx % corners.length]!;
        if (Phaser.Math.Distance.Between(c.x, c.y, rx, ry) >= rSafe) return c;
      }

      if (formation === "opposite") {
        angle = this.rng.next() * Math.PI * 2 + (idx % 2 === 0 ? 0 : Math.PI);
      }

      if (formation === "arc") {
        const arc = ((arcDeg ?? 140) / 180) * Math.PI;
        const center = this.rng.next() * Math.PI * 2;
        const t = count > 1 ? idx / (count - 1) : 0.5;
        angle = center - arc / 2 + arc * t;
      }

      if (formation === "behind_tail_bias") {
        const tailDir = this.tail.getTailDir(this.player.x, this.player.y);
        const behind = Math.atan2(-tailDir.y, -tailDir.x);
        angle = behind + this.rng.float(-0.7, 0.7);
      }

      const p = tryPick(angle, dist);
      if (p) return p;
    }

    return { x: clamp(px + safe, 24, cfg.arena.width - 24), y: clamp(py, 24, cfg.arena.height - 24) };
  }

  private createTextures(): void {
    if (this.textures.exists("player")) return;

    const makeCircle = (
      key: string,
      radius: number,
      fill: number,
      stroke?: { color: number; width: number; alpha?: number }
    ) => {
      const g = this.add.graphics();
      if (stroke) g.lineStyle(stroke.width, stroke.color, stroke.alpha ?? 1);
      g.fillStyle(fill, 1);
      g.fillCircle(radius, radius, radius);
      if (stroke) g.strokeCircle(radius, radius, radius - stroke.width / 2);
      g.generateTexture(key, radius * 2, radius * 2);
      g.destroy();
    };

    makeCircle("player", 14, 0x5cc8ff);
    makeCircle("recycler", 60, 0x10202c, { color: 0x3aa4d4, width: 4, alpha: 0.9 });
    makeCircle("scrap_common", 6, 0xd9f2ff);
    makeCircle("scrap_heavy", 8, 0xffc86b);
    makeCircle("scrap_rare", 7, 0xbb7cff);
    makeCircle("enemy_chaser", 12, 0xff5c7a);
    makeCircle("enemy_shooter", 11, 0xff8d5c);
    makeCircle("enemy_cutter", 11, 0xff5ce8);
    makeCircle("projectile", 4, 0xf0f6ff);
    makeCircle("shrapnel", 3, 0x5cc8ff);
    makeCircle("telegraph", 14, 0x000000, { color: 0x5cc8ff, width: 2, alpha: 0.7 });
  }

  private createWorld(): void {
    const cfg = this.state.config;

    this.physics.world.setBounds(0, 0, cfg.arena.width, cfg.arena.height);
    this.cameras.main.setBounds(0, 0, cfg.arena.width, cfg.arena.height);

    this.scrapGroup = this.physics.add.group({ collideWorldBounds: true });
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.projectileGroup = this.physics.add.group({ collideWorldBounds: true });
    this.shrapnelGroup = this.physics.add.group({ collideWorldBounds: true });

    this.tailGroup = this.physics.add.group({ collideWorldBounds: true });
    this.tail = new Tail(
      this,
      this.tailGroup,
      {
        segmentSpacing: cfg.tail.segmentSpacing,
        followStiffness: cfg.tail.followStiffness,
        damping: cfg.tail.damping,
        segmentRadius: cfg.tail.segmentRadius,
        maxLenCap: cfg.tail.maxLenCap,
      },
      { common: "scrap_common", heavy: "scrap_heavy", rareShard: "scrap_rare" }
    );

    this.player = this.physics.add.image(cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y + 220, "player") as ArcadeImage;
    this.player.setCircle(14);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(30);
    this.player.body.setAllowGravity(false);

    this.recycler = this.physics.add.staticImage(cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y, "recycler") as ArcadeStaticImage;
    this.recycler.setDepth(5);
    this.recycler.body.setCircle(cfg.recycler.radius);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.add
      .text(16, 16, "Magnet Caravan", { fontSize: "14px", color: "#98b7c7" })
      .setScrollFactor(0)
      .setDepth(100);
  }

  private createCollisions(): void {
    this.physics.add.overlap(this.player, this.scrapGroup, (_p, s) => this.onScrapOverlap(s as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player, this.enemyGroup, (_p, e) => this.onPlayerHitByEnemy(e as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.player, this.projectileGroup, (_p, pr) =>
      this.onPlayerHitByProjectile(pr as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(this.tailGroup, this.projectileGroup, (t, pr) =>
      this.onTailHitByProjectile(t as any, pr as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(this.tailGroup, this.enemyGroup, (t, e) => this.onTailOverlapEnemy(t as any, e as Phaser.Physics.Arcade.Image));
    this.physics.add.overlap(this.enemyGroup, this.projectileGroup, (e, pr) =>
      this.onEnemyHitByProjectile(e as Phaser.Physics.Arcade.Image, pr as Phaser.Physics.Arcade.Image)
    );
    this.physics.add.overlap(this.enemyGroup, this.shrapnelGroup, (e, sh) =>
      this.onEnemyHitByShrapnel(e as Phaser.Physics.Arcade.Image, sh as Phaser.Physics.Arcade.Image)
    );
  }

  private doFlip(): void {
    const cfg = this.state.config.flip;
    this.flipCooldown = cfg.cooldownBaseSec;
    this.flipPulse = cfg.pulseDurationSec;
    this.playerInvuln = Math.max(this.playerInvuln, cfg.postFlipInvulnSec);
    this.game.events.emit(GAME_EVENTS.FLIP_USED, {});

    if (!cfg.shrapnel.enabled) return;
    const count = Math.max(0, cfg.shrapnel.count);
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * Math.PI * 2;
      const vx = Math.cos(a);
      const vy = Math.sin(a);
      const spr = this.shrapnelGroup.create(this.player.x, this.player.y, "shrapnel") as ArcadeImage;
      spr.setDepth(40);
      spr.setVelocity(vx * cfg.shrapnel.speed, vy * cfg.shrapnel.speed);
      spr.body.setAllowGravity(false);
      this.time.delayedCall(cfg.shrapnel.lifetimeSec * 1000, () => spr.destroy());
    }
  }

  private doDash(): void {
    this.dashCooldown = this.state.config.dash.cooldownSec;
    this.dashTime = this.state.config.dash.durationSec;
    this.playerInvuln = Math.max(this.playerInvuln, this.state.config.dash.iframesSec);
  }

  private isDashEnabled(): boolean {
    return Boolean(this.state.config.dash.enabledByDefault) || Boolean((this.state.perks as any).dash_module);
  }

  private spawnScrapClusters(_extraClusters: number): void {
    const extraClusters = _extraClusters;
    const cfg = this.state.config;
    const mult = clamp(1 + cfg.waves.scrapMultPerWave * Math.max(0, this.state.waveIndex - 1), 1, cfg.waves.scrapMultCap);
    const baseClusters = clampInt(
      Math.round(cfg.scrap.clusterCountBase + cfg.scrap.clusterCountPerWave * Math.max(0, this.state.waveIndex - 1)),
      0,
      cfg.scrap.clusterCountCap
    );
    const clusters = clampInt(Math.round(baseClusters * mult) + extraClusters, 0, cfg.scrap.clusterCountCap + 10);

    for (let i = 0; i < clusters; i++) {
      const center = this.pickScrapCenter();
      const size = this.rng.int(cfg.scrap.clusterSizeMin, cfg.scrap.clusterSizeMax);
      for (let j = 0; j < size; j++) {
        const a = this.rng.next() * Math.PI * 2;
        const r = this.rng.float(0, cfg.scrap.clusterRadius);
        this.spawnScrapAt(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r);
      }
    }
  }

  private spawnScrapBurst(clusters: number): void {
    const cfg = this.state.config;
    for (let i = 0; i < clusters; i++) {
      const center = this.pickScrapCenter();
      const size = this.rng.int(cfg.scrap.clusterSizeMin, cfg.scrap.clusterSizeMax);
      for (let j = 0; j < size; j++) {
        const a = this.rng.next() * Math.PI * 2;
        const r = this.rng.float(0, cfg.scrap.clusterRadius);
        this.spawnScrapAt(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r);
      }
    }
  }

  private onWaveComplete(): void {
    this.awaitingUpgrade = true;
    this.waveTime = 0;
    this.spawnCursor = 0;
    this.pendingTelegraphs = [];

    this.enemyGroup.clear(true, true);
    this.projectileGroup.clear(true, true);
    this.shrapnelGroup.clear(true, true);
    this.enemies = [];
    this.projectiles = [];

    this.game.events.emit(GAME_EVENTS.WAVE_COMPLETE, { waveIndex: this.state.waveIndex });
    this.scene.launch("upgrade");
    this.scene.pause();
  }

  private spawnScrapAt(x: number, y: number): void {
    const type = this.rollScrapType();
    const tex = type === "heavy" ? "scrap_heavy" : type === "rareShard" ? "scrap_rare" : "scrap_common";
    const spr = this.scrapGroup.create(x, y, tex) as ArcadeImage;
    spr.setDepth(10);
    spr.setData("scrapType", type);
    spr.body.setAllowGravity(false);
    spr.setCollideWorldBounds(true);
    spr.body.setBounce(0.9, 0.9);
    spr.body.setDrag(40, 40);
  }

  private onScrapOverlap(s: Phaser.Physics.Arcade.Image): void {
    if (this.captureCooldown > 0) return;
    const magnet = this.state.config.magnet;
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
    if (d > magnet.captureDistance) return;

    this.captureCooldown = magnet.captureCooldownSec;
    const type = (s.getData("scrapType") as ScrapType | undefined) ?? "common";

    if (this.tail.length < this.state.config.tail.maxLenCap) {
      this.tail.addSegment(type, this.player.x, this.player.y);
    } else {
      if (type === "heavy") this.state.bolts += this.state.config.recycler.boltsPerScrapHeavy;
      else this.state.bolts += this.state.config.recycler.boltsPerScrapCommon;
    }

    if (type === "rareShard") {
      const bonus = this.state.mode === "daily" ? this.state.config.daily.dailyRewards.coreDropBonus : 0;
      if (this.rng.next() < this.state.config.scrap.types.rareShard.coreDropChance + bonus) this.state.cores += 1;
    }

    this.game.events.emit(GAME_EVENTS.SCRAP_COLLECTED, { type });
    s.destroy();

    this.time.delayedCall(this.state.config.scrap.respawnTimeSec * 1000, () => {
      if (!this.scene.isActive()) return;
      const c = this.pickScrapCenter();
      this.spawnScrapAt(c.x, c.y);
    });
  }

  private bankTail(): void {
    const counts = this.tail.countByType();
    const mult = this.state.perks.recycler_bolts_mult?.params?.mult;
    const m = typeof mult === "number" ? mult : 1;

    const bolts =
      counts.common * this.state.config.recycler.boltsPerScrapCommon +
      counts.heavy * this.state.config.recycler.boltsPerScrapHeavy;
    this.state.bolts += Math.floor(bolts * m);

    const heal = this.state.config.recycler.healOnBank;
    this.state.hp = Math.min(this.state.config.player.hpMax, this.state.hp + heal);

    this.tail.clear();
    this.game.events.emit(GAME_EVENTS.BANK_COMPLETE, { bolts });
  }

  private onPlayerHitByEnemy(enemySpr: Phaser.Physics.Arcade.Image): void {
    if (this.playerInvuln > 0) return;
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent) return;
    const def = this.state.config.enemies[ent.type];
    const dmg = Math.max(1, Math.floor(def.contactDamage ?? 10));
    this.applyDamage(dmg);

    const dx = this.player.x - enemySpr.x;
    const dy = this.player.y - enemySpr.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : 0;
    const kb = def.knockback ?? 220;
    this.player.body.velocity.x += nx * kb;
    this.player.body.velocity.y += ny * kb;

    this.tail.removeLast(this.state.config.tail.lossOnObstacle);
  }

  private onPlayerHitByProjectile(pr: Phaser.Physics.Arcade.Image): void {
    if (this.playerInvuln > 0) return;
    const ent = this.projectiles.find((p) => p.sprite === pr);
    if (!ent || ent.owner !== "enemy") return;
    this.applyDamage(ent.damage);
    this.tail.removeLast(this.state.config.tail.lossOnProjectile);
    pr.destroy();
  }

  private onTailHitByProjectile(_tail: any, pr: Phaser.Physics.Arcade.Image): void {
    const ent = this.projectiles.find((p) => p.sprite === pr);
    if (!ent || ent.owner !== "enemy") return;
    this.tail.removeLast(this.state.config.tail.lossOnProjectile);
    pr.destroy();
  }

  private onTailOverlapEnemy(_tail: any, enemySpr: Phaser.Physics.Arcade.Image): void {
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent || ent.type !== "cutter") return;
    const now = this.time.now / 1000;
    if (now < ent.cutReadyAt) return;
    ent.cutReadyAt = now + (this.state.config.enemies.cutter.cooldownAfterCutSec ?? 1.0);
    const cut = Math.max(1, this.state.config.enemies.cutter.tailCut ?? this.state.config.tail.lossOnCutter);
    this.tail.removeLast(cut);
  }

  private onEnemyHitByProjectile(enemySpr: Phaser.Physics.Arcade.Image, pr: Phaser.Physics.Arcade.Image): void {
    const proj = this.projectiles.find((p) => p.sprite === pr);
    if (!proj || proj.owner !== "player") return;
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent) return;
    ent.hp -= Math.max(1, proj.damage);
    pr.destroy();
    if (ent.hp <= 0) this.killEnemy(ent);
  }

  private onEnemyHitByShrapnel(enemySpr: Phaser.Physics.Arcade.Image, sh: Phaser.Physics.Arcade.Image): void {
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent) return;
    ent.hp -= Math.max(1, this.state.config.flip.shrapnel.damage);
    sh.destroy();
    if (ent.hp <= 0) this.killEnemy(ent);
  }

  private killEnemy(ent: EnemyEntity): void {
    const x = ent.sprite.x;
    const y = ent.sprite.y;
    ent.sprite.destroy();
    if (this.rng.next() < 0.35) this.spawnScrapAt(x, y);
  }

  private applyDamage(damage: number): void {
    const mult = (this.state.perks as any).damage_taken_mult?.params?.mult;
    const dmgMult = typeof mult === "number" ? mult : 1;
    const dmg = Math.max(1, Math.floor(damage * dmgMult));

    this.state.hp -= dmg;
    this.playerInvuln = Math.max(this.playerInvuln, this.state.config.player.invulnOnHitSec);
    this.state.recentHits.push({ t: this.time.now / 1000 });
    if (this.state.hp <= 0) this.endRun();
  }

  private endRun(): void {
    this.game.events.emit(GAME_EVENTS.RUN_END, { waveIndex: this.state.waveIndex, bolts: this.state.bolts });
    this.scene.stop("ui");
    this.scene.launch("results");
    this.scene.stop();
  }

  private rollScrapType(): ScrapType {
    const cfg = this.state.config.scrap.types;
    let wCommon = cfg.common.weight;
    let wHeavy = cfg.heavy.weight;
    let wRare = cfg.rareShard.weight;

    const heavyPerk = this.state.perks.heavy_haul?.params?.heavySpawnMult;
    if (typeof heavyPerk === "number") wHeavy *= heavyPerk;
    if (this.state.daily?.specialRule?.type === "more_heavy_scrap" && typeof (this.state.daily.specialRule as any).mult === "number") {
      wHeavy *= (this.state.daily.specialRule as any).mult;
    }

    const total = Math.max(0, wCommon) + Math.max(0, wHeavy) + Math.max(0, wRare);
    if (total <= 0) return "common";
    let r = this.rng.next() * total;
    if ((r -= Math.max(0, wCommon)) < 0) return "common";
    if ((r -= Math.max(0, wHeavy)) < 0) return "heavy";
    return "rareShard";
  }

  private pickScrapCenter(): { x: number; y: number } {
    const cfg = this.state.config;
    for (let i = 0; i < 12; i++) {
      const x = this.rng.float(40, cfg.arena.width - 40);
      const y = this.rng.float(40, cfg.arena.height - 40);
      const d = Phaser.Math.Distance.Between(x, y, cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y);
      if (d > cfg.recycler.radius + 80) return { x, y };
    }
    return { x: cfg.arena.recyclerPos.x + 200, y: cfg.arena.recyclerPos.y };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v)));
}
