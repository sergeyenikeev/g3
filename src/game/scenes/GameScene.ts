import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
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
import { applyTrainingModeConfig, TRAINING_STARTING_SCRAP } from "../tutorial/trainingMode";
import type { SaveData } from "../../platform/save/saveManager";
import { VISUAL_PALETTE, createBgFarSilhouette, createBgTile256, createDecals, createVfxTextures } from "../../visual/TextureFactory";
import { VfxManager, type VfxQuality } from "../../visual/VfxManager";

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

type FlipPulseState = {
  tLeft: number;
  radius: number;
  pushForce: number;
  deflectProjectiles: boolean;
};

type DroneState = {
  obj: Phaser.GameObjects.Image;
  fireCooldown: number;
  bobPhase: number;
};

type ScrapMineState = {
  obj: Phaser.GameObjects.Image;
  tLeft: number;
  damage: number;
  pushForce: number;
  triggerRadius: number;
};

type ArcadeImage = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };
type ArcadeStaticImage = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.StaticBody };

export class GameScene extends Phaser.Scene {
  private rng!: Rng;
  private staticData!: StaticGameData;
  private state!: RunState;
  private analytics: AnalyticsAdapter | null = null;
  private e2eKillKey: Phaser.Input.Keyboard.Key | null = null;
  private e2eWindowBound = false;

  private visualSeed = "visual";
  private bgTime = 0;
  private bgFar: Phaser.GameObjects.TileSprite | null = null;
  private bgTile: Phaser.GameObjects.TileSprite | null = null;
  private fgFog: Phaser.GameObjects.TileSprite | null = null;
  private bgDecals: Phaser.GameObjects.Image[] = [];
  private bgDust: Array<{ obj: Phaser.GameObjects.Image; vx: number; vy: number; scroll: number }> = [];
  private bgSparkFx: Array<{ obj: Phaser.GameObjects.Image; vx: number; vy: number; age: number; life: number; a0: number }> = [];
  private bgSparkTimer = 0;
  private playerGlow: Phaser.GameObjects.Image | null = null;
  private playerGlowPhase = 0;
  private vfx: VfxManager | null = null;
  private visualQuality: VfxQuality = "medium";
  private visualQualityAuto = true;
  private fpsProbe = { t: 0, frames: 0, done: false };

  private readonly onVfxScrapCollected = (p: any) => this.vfx?.emit(GAME_EVENTS.SCRAP_COLLECTED, p);
  private readonly onVfxFlipUsed = (p: any) => this.vfx?.emit(GAME_EVENTS.FLIP_USED, p);
  private readonly onVfxProjectileDeflected = (p: any) => this.vfx?.emit(GAME_EVENTS.PROJECTILE_DEFLECTED, p);
  private readonly onVfxPlayerHit = (p: any) => this.vfx?.emit(GAME_EVENTS.PLAYER_HIT, p);
  private readonly onVfxTailCut = (p: any) => this.vfx?.emit(GAME_EVENTS.TAIL_CUT, p);
  private readonly onVfxBankComplete = (p: any) => this.vfx?.emit(GAME_EVENTS.BANK_COMPLETE, p);
  private readonly onVfxWaveStart = (p: any) => this.vfx?.emit(GAME_EVENTS.WAVE_START, p);
  private readonly onVfxUpgradeOfferShown = (p: any) => this.vfx?.emit(GAME_EVENTS.UPGRADE_OFFER_SHOWN, p);
  private readonly onVfxUpgradePicked = (p: any) => this.vfx?.emit(GAME_EVENTS.UPGRADE_PICKED, p);

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
  private tailDebrisGroup!: Phaser.Physics.Arcade.Group;
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
  private flipPulses: FlipPulseState[] = [];
  private flipCount = 0;
  private dashCooldown = 0;
  private dashTime = 0;
  private shieldHp = 0;
  private shieldTime = 0;
  private clampCharges = 0;
  private anchorTime = 0;
  private anchorCooldown = 0;
  private vacuumBurstTime = 0;
  private vacuumBurstCooldown = 0;
  private drone: DroneState | null = null;
  private scrapMines: ScrapMineState[] = [];
  private waveHudLabel = "";

  private captureCooldown = 0;
  private banking = { active: false, t: 0 };
  private revivePending = false;
  private reviveOffered = false;
  private pendingStartBooster = false;
  private tutorialEnemySpawned = false;

  constructor() {
    super("game");
  }

  init(data: { mode?: RunMode } = {}): void {
    this.registry.set("runMode", data.mode ?? "run");
  }

  create(): void {
    this.staticData = this.registry.get("staticGameData") as StaticGameData;
    const mode = (this.registry.get("runMode") as RunMode | undefined) ?? "run";
    this.analytics = (this.registry.get("analytics") as AnalyticsAdapter | undefined) ?? null;

    const built = buildRuntimeConfig(this.staticData, {
      presetId: "normal",
      metaLevels: (this.registry.get("saveData") as any)?.meta?.nodeLevels ?? {},
    });
    if (mode === "tutorial") applyTrainingModeConfig(built.config);

    this.pendingStartBooster = Boolean(this.registry.get("pendingStartBooster"));
    this.registry.set("pendingStartBooster", false);

    this.rng = createRng(
      mode === "daily" ? `daily-run:${getUtcYyyymmdd()}` : mode === "tutorial" ? `tutorial:${Date.now()}` : `run:${Date.now()}`
    );

    this.state = {
      mode,
      rng: this.rng,
      config: built.config,
      perks: { ...built.basePerks },
      startedAtMs: Date.now(),
      tailMaxLen: 0,
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

    if (import.meta.env.VITE_E2E === "1") {
      this.state.config.recycler.bankTimeSec = Math.min(this.state.config.recycler.bankTimeSec, 0.15);
    }

    this.registry.set("runState", this.state);
    this.visualSeed =
      mode === "daily"
        ? `daily:${this.state.daily?.dateUtc ?? getUtcYyyymmdd()}`
        : mode === "tutorial"
          ? `tutorial:${this.state.startedAtMs}`
          : `run:${this.state.startedAtMs}`;
    const save = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    const pref = save?.settings?.visualQuality ?? "auto";
    if (pref === "low" || pref === "medium" || pref === "high") {
      this.visualQuality = pref;
      this.visualQualityAuto = false;
      this.fpsProbe.done = true;
    } else {
      this.visualQuality = this.pickInitialQuality();
      this.visualQualityAuto = true;
    }
    this.registry.set("visualQuality", this.visualQuality);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      wasd: {
        w: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        a: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        s: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        d: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      },
    };

    if (import.meta.env.VITE_E2E === "1") {
      this.e2eKillKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.K);
      this.bindE2eWindowApi();
    }

    this.createTextures();
    this.createWorld();
    if (this.pendingStartBooster) this.applyStartBooster();
    this.createCollisions();
    this.createVfxSystem();
    this.startWave(1);

    this.track(ANALYTICS_EVENTS.RUN_START, {
      mode,
      dateUtc: this.state.daily?.dateUtc ?? null,
      variantId: this.state.daily?.variantId ?? null,
    });

    this.game.events.on(GAME_EVENTS.REVIVE_ACCEPTED, this.onReviveAccepted, this);
    this.game.events.on(GAME_EVENTS.REVIVE_DECLINED, this.onReviveDeclined, this);
    this.game.events.on(GAME_EVENTS.TUTORIAL_STEP_CHANGED, this.onTutorialStepChanged, this);
    this.game.events.on(GAME_EVENTS.TUTORIAL_FINISHED, this.onTutorialFinished, this);
    this.game.events.on(GAME_EVENTS.TUTORIAL_EXITED, this.onTutorialExited, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.REVIVE_ACCEPTED, this.onReviveAccepted, this);
      this.game.events.off(GAME_EVENTS.REVIVE_DECLINED, this.onReviveDeclined, this);
      this.game.events.off(GAME_EVENTS.TUTORIAL_STEP_CHANGED, this.onTutorialStepChanged, this);
      this.game.events.off(GAME_EVENTS.TUTORIAL_FINISHED, this.onTutorialFinished, this);
      this.game.events.off(GAME_EVENTS.TUTORIAL_EXITED, this.onTutorialExited, this);
    });

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
    if (this.revivePending) return;

    if (import.meta.env.VITE_E2E === "1" && this.e2eKillKey && Phaser.Input.Keyboard.JustDown(this.e2eKillKey)) {
      this.endRun("e2e");
      return;
    }

    this.updateTimers(dt);
    this.updateMovement(dt);
    this.updatePerkSystems(dt);
    this.updatePlayerGlow(dt);
    this.updateTail(dt);
    this.updateMagnet(dt);
    this.updateFlipPulse(dt);
    this.updateEnemyAI(dt);
    this.updateProjectiles();
    this.updateScrapMines(dt);
    this.updateBanking(dt);
    this.updateWave(dt);
    this.updateHudStatus();
    this.updateBackgroundLayers(dt);
    this.vfx?.update(dt);
    this.updateFpsProbe(dt);
  }

  private updateTimers(dt: number): void {
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.flipCooldown = Math.max(0, this.flipCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.captureCooldown = Math.max(0, this.captureCooldown - dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    if (this.shieldTime <= 0) this.shieldHp = 0;
    this.anchorTime = Math.max(0, this.anchorTime - dt);
    this.anchorCooldown = Math.max(0, this.anchorCooldown - dt);
    this.vacuumBurstTime = Math.max(0, this.vacuumBurstTime - dt);
    this.vacuumBurstCooldown = Math.max(0, this.vacuumBurstCooldown - dt);

    this.registry.set("flipCooldown", this.flipCooldown);
    this.registry.set("dashCooldown", this.dashCooldown);

    const now = this.time.now / 1000;
    const windowSec = this.state.config.director.pressure.recentHitWindowSec;
    while (this.state.recentHits.length > 0 && now - this.state.recentHits[0]!.t > windowSec) {
      this.state.recentHits.shift();
    }
  }

  private updatePerkSystems(dt: number): void {
    this.updateVacuumBurst();
    this.updateDrone(dt);
  }

  private updateVacuumBurst(): void {
    const perk = this.state.perks.vacuum_burst?.params;
    if (!perk) {
      this.vacuumBurstTime = 0;
      this.vacuumBurstCooldown = 0;
      return;
    }

    if (this.vacuumBurstTime > 0 || this.vacuumBurstCooldown > 0) return;
    const period = positiveNum(perk.periodSec, 8);
    const duration = clamp(positiveNum(perk.durationSec, 1), 0.15, period);
    this.vacuumBurstTime = duration;
    this.vacuumBurstCooldown = period;
  }

  private updateDrone(dt: number): void {
    const perk = this.state.perks.drone_buddy?.params;
    if (!perk) {
      this.destroyDrone();
      return;
    }

    if (!this.drone) this.createDrone();
    if (!this.drone) return;

    const drone = this.drone;
    drone.fireCooldown = Math.max(0, drone.fireCooldown - dt);
    drone.bobPhase += dt * 4;

    const orbitAngle = this.player.rotation + Math.PI * 0.72;
    const targetX = this.player.x + Math.cos(orbitAngle) * 42;
    const targetY = this.player.y + Math.sin(orbitAngle) * 42 - 10 + Math.sin(drone.bobPhase) * 6;
    const followAlpha = 1 - Math.pow(1 - 0.16, dt * 60);
    drone.obj.x = Phaser.Math.Linear(drone.obj.x, targetX, followAlpha);
    drone.obj.y = Phaser.Math.Linear(drone.obj.y, targetY, followAlpha);
    drone.obj.setRotation(orbitAngle + Math.PI * 0.5);

    const target = this.findNearestEnemy(drone.obj.x, drone.obj.y, 520);
    if (!target || drone.fireCooldown > 0) return;

    const dx = target.sprite.x - drone.obj.x;
    const dy = target.sprite.y - drone.obj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0.001) return;

    const fireCooldown = positiveNum(perk.fireCooldownSec, 1.4);
    const damage = positiveNum(perk.damage, 6);
    const projectileSpeed = positiveNum(perk.projectileSpeed, 420);
    drone.fireCooldown = fireCooldown;
    this.spawnProjectile("player", drone.obj.x, drone.obj.y, dx / dist, dy / dist, projectileSpeed, damage, 1.5);
  }

  private createDrone(): void {
    if (this.drone) return;
    const obj = this.add.image(this.player.x, this.player.y, "drone_buddy").setDepth(32).setAlpha(0.92).setScale(0.92);
    obj.setBlendMode(Phaser.BlendModes.ADD);
    this.drone = { obj, fireCooldown: 0.15, bobPhase: 0 };
  }

  private destroyDrone(): void {
    if (!this.drone) return;
    this.drone.obj.destroy();
    this.drone = null;
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
    this.state.tailMaxLen = Math.max(this.state.tailMaxLen, this.tail.length);
  }

  private updateMagnet(dt: number): void {
    const magnet = this.state.config.magnet;
    const radius = clamp(magnet.radiusBase, 0, magnet.radiusMax);
    const r2 = radius * radius;
    const enabled = radius > 0;
    const corePullMult = this.getCorePullMult();
    const perkPullMult = this.vacuumBurstTime > 0 ? this.getVacuumPullMult() : 1;

    const candidates: Array<{ x: number; y: number; d2: number }> = [];

    this.scrapGroup.children.iterate((o) => {
      const spr = o as ArcadeImage | null;
      if (!spr) return null;
      const dx = this.player.x - spr.x;
      const dy = this.player.y - spr.y;
      const d2 = dx * dx + dy * dy;
      const inRange = enabled && d2 <= r2;

      const was = Boolean(spr.getData("magnetHl"));
      if (inRange !== was) {
        if (inRange) {
          const type = (spr.getData("scrapType") as ScrapType | undefined) ?? "common";
          const col = type === "heavy" ? VISUAL_PALETTE.warningAmber : type === "rareShard" ? VISUAL_PALETTE.neonMagenta : VISUAL_PALETTE.neonCyan;
          spr.setTintFill(col);
          spr.setData("magnetHl", true);
        } else {
          spr.clearTint();
          spr.setData("magnetHl", false);
        }
      }

      if (!inRange) return null;
      candidates.push({ x: spr.x, y: spr.y, d2 });
      const d = Math.sqrt(d2);
      if (d < 0.001) return null;
      const nx = dx / d;
      const ny = dy / d;
      const pull = magnet.pullAccelBase * corePullMult * perkPullMult * (1 - d / radius);
      spr.body.velocity.x += nx * pull * dt;
      spr.body.velocity.y += ny * pull * dt;
      const spd = spr.body.velocity.length();
      if (spd > magnet.pullMaxSpeed) spr.body.velocity.scale(magnet.pullMaxSpeed / spd);
      return null;
    });

    if (this.vfx) {
      candidates.sort((a, b) => a.d2 - b.d2);
      const targets = candidates.slice(0, 12).map((c) => ({ x: c.x, y: c.y }));
      this.vfx.setMagnetLines({ x: this.player.x, y: this.player.y }, targets);
    }
  }

  private updateFlipPulse(dt: number): void {
    if (this.flipPulses.length <= 0) return;
    for (let i = this.flipPulses.length - 1; i >= 0; i--) {
      const pulse = this.flipPulses[i]!;
      pulse.tLeft -= dt;

      this.enemyGroup.children.iterate((o) => {
        const e = o as ArcadeImage | null;
        if (!e) return null;
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > pulse.radius * pulse.radius || d2 < 0.001) return null;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        e.body.velocity.x += nx * pulse.pushForce * dt;
        e.body.velocity.y += ny * pulse.pushForce * dt;
        return null;
      });

      if (pulse.deflectProjectiles) {
        this.projectileGroup.children.iterate((o) => {
          const p = o as ArcadeImage | null;
          if (!p) return null;
          const dx = p.x - this.player.x;
          const dy = p.y - this.player.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > pulse.radius * pulse.radius || d2 < 0.001) return null;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const speed = Math.max(this.state.config.tuning.projectile.deflectMinSpeed, p.body.velocity.length());
          p.body.velocity.x = nx * speed;
          p.body.velocity.y = ny * speed;
          const ent = this.projectiles.find((pp) => pp.sprite === p);
          if (ent && ent.owner === "enemy") {
            ent.owner = "player";
            this.game.events.emit(GAME_EVENTS.PROJECTILE_DEFLECTED, { x: p.x, y: p.y });
          } else if (ent) {
            ent.owner = "player";
          }
          return null;
        });
      }

      if (pulse.tLeft <= 0) this.flipPulses.splice(i, 1);
    }
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
        const keep = cfg.enemies.shooter.keepDistance;
        const spd = cfg.enemies.shooter.speed * speedMult;
        const wantAway = d < keep * cfg.tuning.shooterAi.keepAwayMult;
        const wantToward = d > keep * cfg.tuning.shooterAi.keepTowardMult;
        const dir = wantAway ? -1 : wantToward ? 1 : 0;
        spr.body.velocity.x = nx * spd * dir;
        spr.body.velocity.y = ny * spd * dir;

        if (now >= e.nextFireAt) {
          e.nextFireAt = now + cfg.enemies.shooter.fireCooldownSec;
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

  private updateScrapMines(dt: number): void {
    for (let i = this.scrapMines.length - 1; i >= 0; i--) {
      const mine = this.scrapMines[i]!;
      mine.tLeft -= dt;
      if (mine.tLeft <= 0 || !mine.obj.active) {
        mine.obj.destroy();
        this.scrapMines.splice(i, 1);
        continue;
      }

      const pulse = 0.84 + Math.sin((this.time.now / 1000) * 9 + i * 0.7) * 0.08;
      mine.obj.setScale(pulse);

      const triggerR2 = mine.triggerRadius * mine.triggerRadius;
      let shouldDetonate = false;
      for (const enemy of this.enemies) {
        if (!enemy.sprite.active) continue;
        const dx = enemy.sprite.x - mine.obj.x;
        const dy = enemy.sprite.y - mine.obj.y;
        if (dx * dx + dy * dy <= triggerR2) {
          shouldDetonate = true;
          break;
        }
      }

      if (shouldDetonate) this.detonateScrapMine(i);
    }
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
    this.flipPulses = [];
    this.clampCharges = this.getChainClampCharges();

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
    this.waveHudLabel = describeWavePlan(this.wavePlan);
    this.registry.set("uiStatusPrimary", this.waveHudLabel);

    this.game.events.emit(GAME_EVENTS.WAVE_START, { waveIndex });

    if (this.state.mode === "tutorial") {
      this.waveHudLabel = "Training: learn the salvage loop";
      this.registry.set("uiStatusPrimary", this.waveHudLabel);
      this.wavePlan.durationSec = 60 * 60;
      this.wavePlan.spawns.length = 0;
      this.scrapGroup.clear(true, true);
      this.tutorialEnemySpawned = false;
      for (let i = 0; i < TRAINING_STARTING_SCRAP; i++) {
        this.spawnScrapAt(this.player.x + (i - 1) * 18, this.player.y - 10, "common");
      }
      return;
    }

    if (import.meta.env.VITE_E2E === "1") {
      this.waveHudLabel = "Quick test wave";
      this.registry.set("uiStatusPrimary", this.waveHudLabel);
      this.wavePlan.durationSec = Math.min(this.wavePlan.durationSec, 6);
      this.wavePlan.spawns.length = 0;
      this.scrapGroup.clear(true, true);
      for (let i = 0; i < 3; i++) {
        this.spawnScrapAt(this.player.x + (i - 1) * 10, this.player.y, "common");
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
    spr.setCircle(this.state.config.tuning.enemyPhysics.radius);
    spr.body.setAllowGravity(false);
    spr.setCollideWorldBounds(true);
    spr.body.setBounce(this.state.config.tuning.enemyPhysics.bounce, this.state.config.tuning.enemyPhysics.bounce);
    spr.body.setDrag(this.state.config.tuning.enemyPhysics.drag, this.state.config.tuning.enemyPhysics.drag);

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
    const clampMargin = cfg.tuning.spawn.clampMargin;
    const safe = cfg.director.safeSpawnDist;
    const rSafe = cfg.director.recyclerSafeDist;
    const px = this.player.x;
    const py = this.player.y;
    const rx = cfg.arena.recyclerPos.x;
    const ry = cfg.arena.recyclerPos.y;

    const tryPick = (angle: number, dist: number) => {
      const x = clamp(px + Math.cos(angle) * dist, clampMargin, cfg.arena.width - clampMargin);
      const y = clamp(py + Math.sin(angle) * dist, clampMargin, cfg.arena.height - clampMargin);
      if (Phaser.Math.Distance.Between(x, y, rx, ry) < rSafe) return null;
      if (Phaser.Math.Distance.Between(x, y, px, py) < safe) return null;
      return { x, y };
    };

    for (let attempt = 0; attempt < cfg.tuning.spawn.maxAttempts; attempt++) {
      let angle = this.rng.next() * Math.PI * 2;
      let dist = safe + this.rng.float(0, cfg.tuning.spawn.randomExtraDist);

      if (formation === "corners") {
        const corners = [
          { x: cfg.tuning.spawn.cornerInset, y: cfg.tuning.spawn.cornerInset },
          { x: cfg.arena.width - cfg.tuning.spawn.cornerInset, y: cfg.tuning.spawn.cornerInset },
          { x: cfg.tuning.spawn.cornerInset, y: cfg.arena.height - cfg.tuning.spawn.cornerInset },
          { x: cfg.arena.width - cfg.tuning.spawn.cornerInset, y: cfg.arena.height - cfg.tuning.spawn.cornerInset },
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
    this.ensureVisualTextures();
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

    makeCircle("player", 14, VISUAL_PALETTE.neonCyan, { color: VISUAL_PALETTE.metalLight, width: 3, alpha: 0.95 });
    makeCircle("recycler", 60, VISUAL_PALETTE.bgMid, { color: VISUAL_PALETTE.neonBlue, width: 4, alpha: 0.9 });
    makeCircle("scrap_common", 6, VISUAL_PALETTE.metalLight, { color: VISUAL_PALETTE.metalGray, width: 2, alpha: 0.95 });
    makeCircle("scrap_heavy", 8, VISUAL_PALETTE.warningAmber, { color: VISUAL_PALETTE.rustDark, width: 2, alpha: 0.95 });
    makeCircle("scrap_rare", 7, VISUAL_PALETTE.neonMagenta, { color: VISUAL_PALETTE.neonBlue, width: 2, alpha: 0.95 });
    makeCircle("enemy_chaser", 12, VISUAL_PALETTE.hpRed, { color: VISUAL_PALETTE.rustDark, width: 2, alpha: 0.95 });
    makeCircle("enemy_shooter", 11, VISUAL_PALETTE.neonBlue, { color: VISUAL_PALETTE.rustDark, width: 2, alpha: 0.95 });
    makeCircle("enemy_cutter", 11, VISUAL_PALETTE.neonMagenta, { color: VISUAL_PALETTE.rustDark, width: 2, alpha: 0.95 });
    makeCircle("projectile", 4, 0xffffff);
    makeCircle("shrapnel", 3, VISUAL_PALETTE.neonCyan);
    makeCircle("telegraph", 14, 0x000000, { color: VISUAL_PALETTE.neonCyan, width: 2, alpha: 0.8 });
    makeCircle("drone_buddy", 7, VISUAL_PALETTE.neonBlue, { color: VISUAL_PALETTE.neonCyan, width: 2, alpha: 0.95 });
    makeCircle("scrap_mine", 6, VISUAL_PALETTE.warningAmber, { color: VISUAL_PALETTE.neonMagenta, width: 2, alpha: 0.95 });
  }

  private createWorld(): void {
    const cfg = this.state.config;

    this.physics.world.setBounds(0, 0, cfg.arena.width, cfg.arena.height);
    this.cameras.main.setBounds(0, 0, cfg.arena.width, cfg.arena.height);
    this.createBackgroundLayers();

    this.scrapGroup = this.physics.add.group({ collideWorldBounds: true });
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.projectileGroup = this.physics.add.group({ collideWorldBounds: true });
    this.shrapnelGroup = this.physics.add.group({ collideWorldBounds: true });

    this.tailGroup = this.physics.add.group({ collideWorldBounds: true });
    this.tailDebrisGroup = this.physics.add.group({ collideWorldBounds: true });
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

    this.player = this.physics.add.image(
      cfg.arena.recyclerPos.x,
      cfg.arena.recyclerPos.y + cfg.tuning.playerStart.offsetYFromRecycler,
      "player"
    ) as ArcadeImage;
    this.player.setCircle(14);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(30);
    this.player.body.setAllowGravity(false);
    this.createPlayerGlow();

    if (import.meta.env.VITE_E2E === "1") {
      for (let i = 0; i < 3; i++) this.tail.addSegment("common", this.player.x, this.player.y);
      this.time.delayedCall(250, () => {
        if (!this.scene.isActive()) return;
        if (this.state.bolts > 0) return;
        if (this.tail.length <= 0) return;
        this.bankTail();
      });
    }

    this.recycler = this.physics.add.staticImage(cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y, "recycler") as ArcadeStaticImage;
    this.recycler.setDepth(5);
    this.recycler.body.setCircle(cfg.recycler.radius);

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.onResize, this);
      this.destroyDrone();
      this.clearScrapMines();
    });
    this.onResize();
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

  private queueFlipPulse(forceMult: number, radiusMult: number, deflectProjectiles: boolean, emitGameEvent: boolean): void {
    const cfg = this.state.config.flip;
    this.flipPulses.push({
      tLeft: cfg.pulseDurationSec,
      radius: cfg.radius * radiusMult,
      pushForce: cfg.pushForce * forceMult,
      deflectProjectiles: deflectProjectiles && cfg.deflectProjectiles,
    });

    if (emitGameEvent) {
      this.game.events.emit(GAME_EVENTS.FLIP_USED, {
        x: this.player.x,
        y: this.player.y,
        radius: cfg.radius * radiusMult,
      });
    }
  }

  private applyFlipShield(): void {
    const perk = this.state.perks.flip_shield?.params;
    if (!perk) return;
    const shieldAmount = positiveNum(perk.shieldAmount, 15);
    const durationSec = positiveNum(perk.durationSec, 3);
    this.shieldHp = Math.max(this.shieldHp, shieldAmount);
    this.shieldTime = Math.max(this.shieldTime, durationSec);
  }

  private doFlip(): void {
    const cfg = this.state.config.flip;
    this.flipCooldown = cfg.cooldownBaseSec;
    this.queueFlipPulse(1, 1, true, true);
    this.playerInvuln = Math.max(this.playerInvuln, cfg.postFlipInvulnSec);
    this.flipCount += 1;
    this.applyFlipShield();

    const echo = this.state.perks.polarity_echo?.params;
    const everyN = Math.max(1, Math.floor(numOrDefault(echo?.everyN, 0)));
    if (echo && everyN > 0 && this.flipCount % everyN === 0) {
      const delaySec = clamp(numOrDefault(echo?.delaySec, 0.15), 0.05, 0.6);
      const forceMult = clamp(numOrDefault(echo?.forceMult, 0.65), 0.2, 1);
      const radiusMult = clamp(numOrDefault(echo?.radiusMult, 0.9), 0.3, 1);
      this.time.delayedCall(delaySec * 1000, () => {
        if (!this.scene.isActive()) return;
        this.queueFlipPulse(forceMult, radiusMult, true, false);
        this.vfx?.emit(GAME_EVENTS.FLIP_USED, { x: this.player.x, y: this.player.y, radius: cfg.radius * radiusMult });
      });
    }

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
    const clusters = clampInt(
      Math.round(baseClusters * mult) + extraClusters,
      0,
      cfg.scrap.clusterCountCap + cfg.tuning.scrapSpawn.clusterCapOverflow
    );

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
    if (this.state.mode === "tutorial") return;
    this.awaitingUpgrade = true;
    this.waveTime = 0;
    this.spawnCursor = 0;
    this.pendingTelegraphs = [];
    this.flipPulses = [];

    this.enemyGroup.clear(true, true);
    this.projectileGroup.clear(true, true);
    this.shrapnelGroup.clear(true, true);
    this.enemies = [];
    this.projectiles = [];
    this.clearScrapMines();

    this.registry.set("uiStatusPrimary", "Upgrade pick");
    this.registry.set("uiStatusSecondary", "");
    this.game.events.emit(GAME_EVENTS.WAVE_COMPLETE, { waveIndex: this.state.waveIndex });
    this.scene.launch("upgrade");
    this.scene.pause();
  }

  private spawnScrapAt(x: number, y: number, forcedType?: ScrapType): void {
    const type = forcedType ?? this.rollScrapType();
    const tex = type === "heavy" ? "scrap_heavy" : type === "rareShard" ? "scrap_rare" : "scrap_common";
    const spr = this.scrapGroup.create(x, y, tex) as ArcadeImage;
    spr.setDepth(10);
    spr.setData("scrapType", type);
    spr.body.setAllowGravity(false);
    spr.setCollideWorldBounds(true);
    spr.body.setBounce(this.state.config.tuning.scrapPhysics.bounce, this.state.config.tuning.scrapPhysics.bounce);
    spr.body.setDrag(this.state.config.tuning.scrapPhysics.drag, this.state.config.tuning.scrapPhysics.drag);
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
      if (type === "heavy") this.state.bolts += this.getHeavyScrapBoltValue();
      else this.state.bolts += this.state.config.recycler.boltsPerScrapCommon;
    }

    if (type === "rareShard") {
      const bonus = this.state.mode === "daily" ? this.state.config.daily.dailyRewards.coreDropBonus : 0;
      if (this.rng.next() < this.state.config.scrap.types.rareShard.coreDropChance + bonus) this.state.cores += 1;
    }

    const tex = type === "heavy" ? "scrap_heavy" : type === "rareShard" ? "scrap_rare" : "scrap_common";
    this.game.events.emit(GAME_EVENTS.SCRAP_COLLECTED, { x: s.x, y: s.y, type, tex });
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

    const boltsBase =
      counts.common * this.state.config.recycler.boltsPerScrapCommon +
      counts.heavy * this.getHeavyScrapBoltValue();
    const bolts = Math.floor(boltsBase * m);
    this.state.bolts += bolts;

    const heal = this.state.config.recycler.healOnBank;
    const hpBefore = this.state.hp;
    this.state.hp = Math.min(this.state.config.player.hpMax, this.state.hp + heal);
    const hpHealed = Math.max(0, this.state.hp - hpBefore);

    this.tail.clear();
    const pos = this.state.config.arena.recyclerPos;
    this.game.events.emit(GAME_EVENTS.BANK_COMPLETE, { x: pos.x, y: pos.y, bolts, hpHealed });
  }

  private onPlayerHitByEnemy(enemySpr: Phaser.Physics.Arcade.Image): void {
    if (this.playerInvuln > 0) return;
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent) return;
    const def = this.state.config.enemies[ent.type];
    const dmg = Math.max(1, Math.floor(def.contactDamage));
    this.applyDamage(dmg);

    const dx = this.player.x - enemySpr.x;
    const dy = this.player.y - enemySpr.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : 0;
    const kb = def.knockback;
    this.player.body.velocity.x += nx * kb;
    this.player.body.velocity.y += ny * kb;
    this.loseTailSegments(this.state.config.tail.lossOnObstacle, enemySpr.x, enemySpr.y);
  }

  private onPlayerHitByProjectile(pr: Phaser.Physics.Arcade.Image): void {
    if (this.playerInvuln > 0) return;
    const ent = this.projectiles.find((p) => p.sprite === pr);
    if (!ent || ent.owner !== "enemy") return;
    this.applyDamage(ent.damage);
    this.loseTailSegments(this.state.config.tail.lossOnProjectile, pr.x, pr.y);
    pr.destroy();
  }

  private onTailHitByProjectile(_tail: any, pr: Phaser.Physics.Arcade.Image): void {
    const ent = this.projectiles.find((p) => p.sprite === pr);
    if (!ent || ent.owner !== "enemy") return;
    this.loseTailSegments(this.state.config.tail.lossOnProjectile, pr.x, pr.y);
    pr.destroy();
  }

  private onTailOverlapEnemy(_tail: any, enemySpr: Phaser.Physics.Arcade.Image): void {
    const ent = this.enemies.find((e) => e.sprite === enemySpr);
    if (!ent || ent.type !== "cutter") return;
    const now = this.time.now / 1000;
    if (now < ent.cutReadyAt) return;
    ent.cutReadyAt = now + this.state.config.enemies.cutter.cooldownAfterCutSec;
    const cut = Math.max(1, this.state.config.enemies.cutter.tailCut);
    this.loseTailSegments(cut, enemySpr.x, enemySpr.y);
  }

  private loseTailSegments(count: number, x: number, y: number): void {
    if (count <= 0) return;
    if (this.tryPreventTailLoss()) return;

    const removed = this.tail.removeLast(count);
    if (removed.length <= 0) return;

    this.game.events.emit(GAME_EVENTS.TAIL_CUT, { x, y, segmentsLost: removed.length, segments: removed });
    this.spawnTailDebris(removed);
    this.spawnScrapMines(removed);
  }

  private tryPreventTailLoss(): boolean {
    if (this.anchorTime > 0) return true;

    const anchor = this.state.perks.magnet_anchor?.params;
    if (anchor && this.anchorCooldown <= 0) {
      this.anchorTime = positiveNum(anchor.durationSec, 0.6);
      this.anchorCooldown = positiveNum(anchor.cooldownSec, 10);
      return true;
    }

    if (this.clampCharges > 0) {
      this.clampCharges -= 1;
      return true;
    }

    return false;
  }

  private spawnScrapMines(segments: Array<{ x: number; y: number; type: ScrapType }>): void {
    const perk = this.state.perks.scrap_mine?.params;
    if (!perk || segments.length <= 0) return;

    const limit = this.visualQuality === "low" ? 4 : this.visualQuality === "high" ? 10 : 7;
    while (this.scrapMines.length >= limit) {
      const old = this.scrapMines.shift();
      old?.obj.destroy();
    }

    const spawnCount = Math.min(segments.length, 3);
    const damage = positiveNum(perk.damage, 14);
    const pushForce = positiveNum(perk.pushForce, 520);
    const triggerRadius = positiveNum(perk.triggerRadius, 28);
    const durationSec = positiveNum(perk.durationSec, 3);

    for (let i = 0; i < spawnCount; i++) {
      const seg = segments[Math.floor((i / spawnCount) * segments.length)] ?? segments[i];
      if (!seg) continue;
      const obj = this.add.image(seg.x, seg.y, "scrap_mine").setDepth(23).setAlpha(0.95).setScale(0.82);
      obj.setBlendMode(Phaser.BlendModes.ADD);
      this.scrapMines.push({ obj, tLeft: durationSec, damage, pushForce, triggerRadius });
    }
  }

  private detonateScrapMine(index: number): void {
    const mine = this.scrapMines[index];
    if (!mine) return;

    const blastRadius = mine.triggerRadius * 1.8;
    const blastR2 = blastRadius * blastRadius;
    const victims = this.enemies.filter((enemy) => {
      if (!enemy.sprite.active) return false;
      const dx = enemy.sprite.x - mine.obj.x;
      const dy = enemy.sprite.y - mine.obj.y;
      return dx * dx + dy * dy <= blastR2;
    });

    for (const enemy of victims) {
      const dx = enemy.sprite.x - mine.obj.x;
      const dy = enemy.sprite.y - mine.obj.y;
      const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.sprite.body.velocity.x += nx * mine.pushForce;
      enemy.sprite.body.velocity.y += ny * mine.pushForce;
      enemy.hp -= mine.damage;
      if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    this.vfx?.emit(GAME_EVENTS.PROJECTILE_DEFLECTED, { x: mine.obj.x, y: mine.obj.y });
    mine.obj.destroy();
    this.scrapMines.splice(index, 1);
  }

  private spawnTailDebris(segments: Array<{ x: number; y: number; type: ScrapType }>): void {
    if (!segments || segments.length === 0) return;
    const max = this.visualQuality === "low" ? 3 : this.visualQuality === "high" ? 8 : 5;
    const count = Math.min(max, segments.length);
    for (let i = 0; i < count; i++) {
      const seg = segments[i]!;
      const tex = seg.type === "heavy" ? "scrap_heavy" : seg.type === "rareShard" ? "scrap_rare" : "scrap_common";
      const spr = this.tailDebrisGroup.create(seg.x, seg.y, tex) as ArcadeImage;
      spr.setDepth(22);
      spr.setScale(0.7 + Math.random() * 0.25);
      spr.setAlpha(0.85);
      spr.setRotation(Math.random() * Math.PI * 2);
      spr.body.setAllowGravity(false);
      spr.body.setCollideWorldBounds(true);
      spr.body.setBounce(0.3, 0.3);
      spr.body.setDrag(90, 90);

      const a = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 160;
      spr.body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);

      const life = 320 + Math.random() * 260;
      this.tweens.add({
        targets: spr,
        alpha: 0,
        scale: 0.2,
        duration: life,
        ease: "Quad.Out",
        onComplete: () => spr.destroy(),
      });
    }
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
    if (this.rng.next() < this.state.config.tuning.scrapSpawn.enemyKillDropChance) this.spawnScrapAt(x, y);
  }

  private applyDamage(damage: number): void {
    const mult = (this.state.perks as any).damage_taken_mult?.params?.mult;
    const dmgMult = typeof mult === "number" ? mult : 1;
    let dmg = Math.max(1, Math.floor(damage * dmgMult));

    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      if (this.shieldHp <= 0) {
        this.shieldHp = 0;
        this.shieldTime = 0;
      }
    }
    if (dmg <= 0) return;

    this.state.hp -= dmg;
    this.playerInvuln = Math.max(this.playerInvuln, this.state.config.player.invulnOnHitSec);
    this.state.recentHits.push({ t: this.time.now / 1000 });
    this.game.events.emit(GAME_EVENTS.PLAYER_HIT, { x: this.player.x, y: this.player.y, damage: dmg });
    if (this.state.hp <= 0) {
      if (this.canOfferRevive()) this.offerRevive();
      else this.endRun("hp");
    }
  }

  private endRun(reason: string): void {
    if (this.state.deathReason) return;
    this.state.deathReason = reason;
    this.game.events.emit(GAME_EVENTS.RUN_END, { waveIndex: this.state.waveIndex, bolts: this.state.bolts });
    const durationMs = Math.max(0, Date.now() - this.state.startedAtMs);
    this.track(ANALYTICS_EVENTS.RUN_END, {
      mode: this.state.mode,
      durationMs,
      wave: this.state.waveIndex,
      bolts: this.state.bolts,
      cores: this.state.cores,
      tailMax: this.state.tailMaxLen,
      reason,
      dateUtc: this.state.daily?.dateUtc ?? null,
      variantId: this.state.daily?.variantId ?? null,
    });

    if (this.state.mode === "tutorial") {
      this.finishTutorialMode(`end:${reason}`);
      return;
    }

    this.scene.stop("upgrade");
    this.scene.stop("ui");
    this.scene.launch("results");
    this.scene.stop();
  }

  private canOfferRevive(): boolean {
    const cfg = this.state.config.ads?.rewarded?.revive;
    return Boolean(cfg?.enabled) && !this.reviveOffered;
  }

  private offerRevive(): void {
    this.revivePending = true;
    this.reviveOffered = true;
    this.physics.world.pause();
    try {
      (this.time as any).paused = true;
    } catch {
      // ignore
    }
    try {
      this.player.setVelocity(0, 0);
    } catch {
      // ignore
    }
    inputState.moveX = 0;
    inputState.moveY = 0;
    consumeActions();
    this.game.events.emit(GAME_EVENTS.REVIVE_OFFER, {});
  }

  private onReviveAccepted(): void {
    if (!this.revivePending) return;
    this.revivePending = false;
    this.physics.world.resume();
    try {
      (this.time as any).paused = false;
    } catch {
      // ignore
    }

    const cfg = this.state.config.ads.rewarded.revive;
    const hp = Math.max(1, Math.floor(this.state.config.player.hpMax * cfg.hpRestoreFrac));
    this.state.hp = hp;
    this.playerInvuln = Math.max(this.playerInvuln, cfg.invulnSec);
    this.state.recentHits = [];
    this.banking.active = false;
    this.banking.t = 0;

    if (cfg.clearEnemies) this.clearThreats();
  }

  private onReviveDeclined(): void {
    if (!this.revivePending) return;
    this.revivePending = false;
    this.physics.world.resume();
    try {
      (this.time as any).paused = false;
    } catch {
      // ignore
    }
    this.endRun("hp");
  }

  private onTutorialStepChanged(payload?: { step?: number }): void {
    if (this.state.mode !== "tutorial") return;
    const step = payload?.step;
    if (step === 2 && !this.tutorialEnemySpawned) {
      this.tutorialEnemySpawned = true;
      this.spawnEnemy("chaser", this.player.x + this.state.config.flip.radius * 0.7, this.player.y);
      return;
    }

    if (step === 3) {
      this.clearThreats();
      if (this.tail.length <= 0) {
        for (let i = 0; i < TRAINING_STARTING_SCRAP; i++) {
          this.tail.addSegment("common", this.player.x, this.player.y);
        }
      }
    }
  }

  private onTutorialFinished(): void {
    if (this.state.mode !== "tutorial") return;
    this.finishTutorialMode("completed");
  }

  private onTutorialExited(): void {
    if (this.state.mode !== "tutorial") return;
    this.finishTutorialMode("exit");
  }

  private clearThreats(): void {
    for (const e of this.enemies) {
      try {
        e.sprite.destroy();
      } catch {
        // ignore
      }
    }
    this.enemies = [];
    this.enemyGroup.clear(true, true);

    for (const p of this.projectiles) {
      try {
        p.sprite.destroy();
      } catch {
        // ignore
      }
    }
    this.projectiles = [];
    this.projectileGroup.clear(true, true);

    this.pendingTelegraphs = [];
    this.clearScrapMines();
  }

  private clearScrapMines(): void {
    for (const mine of this.scrapMines) {
      try {
        mine.obj.destroy();
      } catch {
        // ignore
      }
    }
    this.scrapMines = [];
  }

  private findNearestEnemy(x: number, y: number, maxDistance: number): EnemyEntity | null {
    let best: EnemyEntity | null = null;
    let bestD2 = maxDistance * maxDistance;
    for (const enemy of this.enemies) {
      if (!enemy.sprite.active) continue;
      const dx = enemy.sprite.x - x;
      const dy = enemy.sprite.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= bestD2) continue;
      best = enemy;
      bestD2 = d2;
    }
    return best;
  }

  private updateHudStatus(): void {
    const waveStatus = this.awaitingUpgrade ? "Upgrade pick" : this.waveHudLabel;
    const buffs: string[] = [];

    if (this.shieldHp > 0) buffs.push(`Shield ${Math.ceil(this.shieldHp)}`);
    if (this.clampCharges > 0) buffs.push(`Clamp x${this.clampCharges}`);
    if (this.anchorTime > 0) buffs.push(`Anchor ${this.anchorTime.toFixed(1)}s`);
    else if (this.state.perks.magnet_anchor) buffs.push(this.anchorCooldown > 0 ? `Anchor ${Math.ceil(this.anchorCooldown)}s` : "Anchor ready");

    if (this.vacuumBurstTime > 0) buffs.push(`Vacuum ${this.vacuumBurstTime.toFixed(1)}s`);
    else if (this.state.perks.vacuum_burst) buffs.push(this.vacuumBurstCooldown > 0 ? `Vacuum ${Math.ceil(this.vacuumBurstCooldown)}s` : "Vacuum ready");

    if (this.drone) buffs.push("Drone online");
    if (this.scrapMines.length > 0) buffs.push(`Mines ${this.scrapMines.length}`);
    if (this.state.cores > 0) buffs.push(`Core pull x${this.getCorePullMult().toFixed(2)}`);

    this.registry.set("uiStatusPrimary", waveStatus);
    this.registry.set("uiStatusSecondary", buffs.join(" | "));
  }

  private finishTutorialMode(_reason: string): void {
    this.scene.stop("upgrade");
    this.scene.stop("ui");
    this.scene.start("menu");
    this.scene.stop();
  }

  private track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.analytics?.track(eventName, payload);
    } catch {
      // ignore
    }
  }

  private bindE2eWindowApi(): void {
    if (this.e2eWindowBound) return;
    this.e2eWindowBound = true;
    try {
      (window as any).__MC_E2E__ = {
        endRun: () => this.endRun("e2e"),
      };
    } catch {
      // ignore
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      try {
        if ((window as any).__MC_E2E__) delete (window as any).__MC_E2E__;
      } catch {
        // ignore
      }
      this.e2eWindowBound = false;
    });
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

  private getChainClampCharges(): number {
    const charges = this.state.perks.chain_clamp?.params?.negateLossPerWave;
    return Math.max(0, Math.floor(numOrDefault(charges, 0)));
  }

  private getHeavyScrapBoltValue(): number {
    const bonus = this.state.perks.heavy_haul?.params?.heavyBonusBolts;
    return this.state.config.recycler.boltsPerScrapHeavy + Math.max(0, Math.floor(numOrDefault(bonus, 0)));
  }

  private getVacuumPullMult(): number {
    const perk = this.state.perks.vacuum_burst?.params?.pullMult;
    return positiveNum(perk, 1.3);
  }

  private getCorePullMult(): number {
    return Math.pow(this.state.config.magnet.pullAccelCoreScale, Math.max(0, this.state.cores));
  }

  private applyStartBooster(): void {
    const cfg = this.state.config.ads?.rewarded?.startBooster;
    if (!cfg?.enabled) return;

    const addBolts = Math.max(0, Math.floor(cfg.addBolts));
    const addCores = Math.max(0, Math.floor(cfg.addCores));
    const addTailSegments = Math.max(0, Math.floor(cfg.addTailSegments));

    this.state.bolts += addBolts;
    this.state.cores += addCores;

    for (let i = 0; i < addTailSegments; i++) {
      this.tail.addSegment("common", this.player.x, this.player.y);
    }
  }

  private createVfxSystem(): void {
    if (this.vfx) return;
    let ui: any | undefined;
    try {
      ui = this.scene.get("ui");
    } catch {
      ui = undefined;
    }

    this.vfx = new VfxManager(this, ui, { quality: this.visualQuality });

    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onVfxScrapCollected);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onVfxFlipUsed);
    this.game.events.on(GAME_EVENTS.PROJECTILE_DEFLECTED, this.onVfxProjectileDeflected);
    this.game.events.on(GAME_EVENTS.PLAYER_HIT, this.onVfxPlayerHit);
    this.game.events.on(GAME_EVENTS.TAIL_CUT, this.onVfxTailCut);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onVfxBankComplete);
    this.game.events.on(GAME_EVENTS.WAVE_START, this.onVfxWaveStart);
    this.game.events.on(GAME_EVENTS.UPGRADE_OFFER_SHOWN, this.onVfxUpgradeOfferShown);
    this.game.events.on(GAME_EVENTS.UPGRADE_PICKED, this.onVfxUpgradePicked);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onVfxScrapCollected);
      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onVfxFlipUsed);
      this.game.events.off(GAME_EVENTS.PROJECTILE_DEFLECTED, this.onVfxProjectileDeflected);
      this.game.events.off(GAME_EVENTS.PLAYER_HIT, this.onVfxPlayerHit);
      this.game.events.off(GAME_EVENTS.TAIL_CUT, this.onVfxTailCut);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onVfxBankComplete);
      this.game.events.off(GAME_EVENTS.WAVE_START, this.onVfxWaveStart);
      this.game.events.off(GAME_EVENTS.UPGRADE_OFFER_SHOWN, this.onVfxUpgradeOfferShown);
      this.game.events.off(GAME_EVENTS.UPGRADE_PICKED, this.onVfxUpgradePicked);
      this.vfx?.destroy();
      this.vfx = null;
    });
  }

  private ensureVisualTextures(): void {
    const seed = this.visualSeed;
    createBgTile256(this, seed);
    createBgFarSilhouette(this, seed);
    createDecals(this, seed);
    createVfxTextures(this);
  }

  private createBackgroundLayers(): void {
    const cfg = this.state.config;
    const { width, height } = this.scale;

    this.bgFar?.destroy();
    this.bgTile?.destroy();
    this.fgFog?.destroy();
    for (const d of this.bgDecals) d.destroy();
    this.bgDecals = [];
    this.clearBackgroundAmbient();

    this.bgFar = null;
    if (this.visualQuality !== "low") {
      this.bgFar = this.add
        .tileSprite(0, 0, width, height, "bg_far_silhouette")
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(0)
        .setAlpha(0.9);
    }

    this.bgTile = this.add.tileSprite(0, 0, width, height, "bg_tile_256").setOrigin(0, 0).setScrollFactor(0).setDepth(1).setAlpha(1);

    const vrng = createRng(`visual:world_decals:${this.visualSeed}`);

    const oils = ["decal_oil_01", "decal_oil_02", "decal_oil_03", "decal_oil_04"] as const;
    const scratches = ["decal_scratch_01", "decal_scratch_02", "decal_scratch_03", "decal_scratch_04"] as const;
    const bolts = ["decal_bolts_01", "decal_bolts_02", "decal_bolts_03", "decal_bolts_04"] as const;

    const bucket = [
      { item: oils as readonly string[], weight: 0.34 },
      { item: scratches as readonly string[], weight: 0.46 },
      { item: bolts as readonly string[], weight: 0.2 },
    ] as const;

    const area = cfg.arena.width * cfg.arena.height;
    const decalCount =
      this.visualQuality === "low"
        ? clampInt(Math.round(area / 40_000), 24, 70)
        : this.visualQuality === "high"
          ? clampInt(Math.round(area / 16_000), 80, 180)
          : clampInt(Math.round(area / 20_000), 60, 140);
    const avoidR = cfg.recycler.radius + 140;

    for (let i = 0; i < decalCount; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = vrng.float(0, cfg.arena.width);
        const y = vrng.float(0, cfg.arena.height);
        const d = Phaser.Math.Distance.Between(x, y, cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y);
        if (d < avoidR) continue;

        const list = vrng.weightedPick(bucket);
        const key = vrng.pick(list);

        const img = this.add.image(x, y, key).setScrollFactor(0.1).setDepth(2);
        img.setRotation(vrng.float(0, Math.PI * 2));

        if (key.startsWith("decal_oil_")) {
          img.setAlpha(vrng.float(0.14, 0.28));
          img.setScale(vrng.float(1.1, 1.7));
        } else if (key.startsWith("decal_scratch_")) {
          img.setAlpha(vrng.float(0.18, 0.34));
          img.setScale(vrng.float(0.9, 1.35));
          img.setTint(VISUAL_PALETTE.metalGray);
        } else {
          img.setAlpha(vrng.float(0.22, 0.38));
          img.setScale(vrng.float(0.9, 1.25));
          img.setTint(VISUAL_PALETTE.metalLight);
        }

        this.bgDecals.push(img);
        placed = true;
        break;
      }
      if (!placed) continue;
    }

    this.fgFog = null;
    if (this.visualQuality !== "low") {
      this.fgFog = this.add
        .tileSprite(0, 0, width, height, "vfx_smoke_puff")
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(90)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setAlpha(0.09);
    }

    this.createBackgroundDust(vrng);
    this.bgSparkTimer = 0;
  }

  private clearBackgroundAmbient(): void {
    for (const d of this.bgDust) d.obj.destroy();
    this.bgDust = [];
    for (const s of this.bgSparkFx) s.obj.destroy();
    this.bgSparkFx = [];
  }

  private createBackgroundDust(rng: Rng): void {
    if (this.visualQuality === "low") return;
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    const scroll = 0.22;
    const count = this.visualQuality === "high" ? 26 : 18;

    for (let i = 0; i < count; i++) {
      const x = cam.scrollX * scroll + rng.float(0, width);
      const y = cam.scrollY * scroll + rng.float(0, height);
      const obj = this.add.image(x, y, "vfx_spark");
      obj.setDepth(88);
      obj.setScrollFactor(scroll);
      obj.setTint(VISUAL_PALETTE.metalLight);
      obj.setAlpha(rng.float(0.08, 0.18));
      obj.setScale(rng.float(0.18, 0.35));

      const vx = rng.float(-10, 10);
      const vy = rng.float(-8, 8);
      this.bgDust.push({ obj, vx, vy, scroll });
    }
  }

  private updateBackgroundLayers(dt: number): void {
    this.bgTime += dt;
    const cam = this.cameras.main;

    if (this.bgFar) {
      this.bgFar.tilePositionX = cam.scrollX * 0.05;
      this.bgFar.tilePositionY = cam.scrollY * 0.05 + 28;
    }

    if (this.bgTile) {
      this.bgTile.tilePositionX = cam.scrollX * 0.1;
      this.bgTile.tilePositionY = cam.scrollY * 0.1;
    }

    if (this.fgFog) {
      this.fgFog.tilePositionX = cam.scrollX * 0.25 + this.bgTime * 10;
      this.fgFog.tilePositionY = cam.scrollY * 0.25 + this.bgTime * 7;
    }

    this.updateBackgroundAmbient(dt);
  }

  private updateBackgroundAmbient(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;

    if (this.bgDust.length > 0) {
      const cam = this.cameras.main;
      const { width, height } = this.scale;
      const margin = 40;
      for (const d of this.bgDust) {
        const obj = d.obj;
        obj.x += d.vx * dt;
        obj.y += d.vy * dt;

        const minX = cam.scrollX * d.scroll - margin;
        const maxX = cam.scrollX * d.scroll + width + margin;
        const minY = cam.scrollY * d.scroll - margin;
        const maxY = cam.scrollY * d.scroll + height + margin;

        if (obj.x < minX) obj.x = maxX;
        else if (obj.x > maxX) obj.x = minX;
        if (obj.y < minY) obj.y = maxY;
        else if (obj.y > maxY) obj.y = minY;
      }
    }

    if (this.visualQuality !== "low") {
      this.bgSparkTimer -= dt;
      if (this.bgSparkTimer <= 0) {
        this.spawnBackgroundSpark();
        this.bgSparkTimer = (this.visualQuality === "high" ? 0.45 : 0.7) + Math.random() * 0.6;
      }
    }

    for (let i = this.bgSparkFx.length - 1; i >= 0; i--) {
      const s = this.bgSparkFx[i]!;
      s.age += dt;
      const t = clamp01(s.age / Math.max(1e-6, s.life));
      s.obj.x += s.vx * dt;
      s.obj.y += s.vy * dt;
      s.obj.setAlpha(s.a0 * (1 - t));
      if (s.age >= s.life) {
        s.obj.destroy();
        this.bgSparkFx.splice(i, 1);
      }
    }
  }

  private spawnBackgroundSpark(): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    const scroll = 0.08;
    const x = cam.scrollX * scroll + Math.random() * width;
    const y = cam.scrollY * scroll + Math.random() * height;

    const obj = this.add.image(x, y, "vfx_spark");
    obj.setDepth(1.5);
    obj.setScrollFactor(scroll);
    obj.setBlendMode(Phaser.BlendModes.ADD);
    obj.setTint(VISUAL_PALETTE.neonCyan);
    obj.setAlpha(0.2);
    obj.setScale(0.35);

    const a = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 20;
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    const life = 0.6 + Math.random() * 0.5;
    const a0 = 0.16 + Math.random() * 0.12;
    this.bgSparkFx.push({ obj, vx, vy, age: 0, life, a0 });
  }

  private createPlayerGlow(): void {
    this.playerGlow?.destroy();
    this.playerGlow = this.add
      .image(this.player.x, this.player.y, "vfx_glow_blob")
      .setDepth(15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(VISUAL_PALETTE.neonCyan)
      .setAlpha(0.32)
      .setScale(0.9);
    this.playerGlowPhase = 0;
  }

  private updatePlayerGlow(dt: number): void {
    if (!this.playerGlow) return;
    this.playerGlowPhase += dt;
    const pulse = 1 + Math.sin(this.playerGlowPhase * Math.PI * 2 * 1.15) * 0.06;
    const tint =
      this.anchorTime > 0
        ? VISUAL_PALETTE.warningAmber
        : this.shieldHp > 0
          ? VISUAL_PALETTE.successGreen
          : this.vacuumBurstTime > 0
            ? VISUAL_PALETTE.neonBlue
            : VISUAL_PALETTE.neonCyan;
    const alpha = this.anchorTime > 0 ? 0.42 : this.shieldHp > 0 ? 0.4 : this.vacuumBurstTime > 0 ? 0.38 : 0.32;
    this.playerGlow.setPosition(this.player.x, this.player.y);
    this.playerGlow.setTint(tint);
    this.playerGlow.setAlpha(alpha);
    this.playerGlow.setScale(0.9 * pulse);
  }

  private onResize(): void {
    const { width, height } = this.scale;
    if (this.bgFar) {
      this.bgFar.setSize(width, height);
      this.bgFar.setDisplaySize(width, height);
    }
    if (this.bgTile) {
      this.bgTile.setSize(width, height);
      this.bgTile.setDisplaySize(width, height);
    }
    if (this.fgFog) {
      this.fgFog.setSize(width, height);
      this.fgFog.setDisplaySize(width, height);
    }
  }

  private pickInitialQuality(): VfxQuality {
    let deviceMemory: number | null = null;
    try {
      const dm = (navigator as any)?.deviceMemory;
      if (typeof dm === "number" && Number.isFinite(dm) && dm > 0) deviceMemory = dm;
    } catch {
      // ignore
    }

    if (deviceMemory !== null) {
      if (deviceMemory <= 2) return "low";
      if (deviceMemory <= 4) return "medium";
      return "high";
    }

    return "medium";
  }

  private updateFpsProbe(dt: number): void {
    if (!this.visualQualityAuto) return;
    if (this.fpsProbe.done) return;
    const step = Math.min(dt, 0.1);
    this.fpsProbe.t += step;
    this.fpsProbe.frames += 1;

    if (this.fpsProbe.t < 5) return;
    this.fpsProbe.done = true;

    const fps = this.fpsProbe.frames / Math.max(0.001, this.fpsProbe.t);
    if (fps < 50) this.setVisualQuality(downgradeQuality(this.visualQuality));
  }

  private setVisualQuality(next: VfxQuality): void {
    if (next === this.visualQuality) return;
    this.visualQuality = next;
    this.registry.set("visualQuality", next);
    this.vfx?.setQuality(next);
    this.createBackgroundLayers();
    this.onResize();
  }

  private pickScrapCenter(): { x: number; y: number } {
    const cfg = this.state.config;
    for (let i = 0; i < cfg.tuning.scrapSpawn.maxAttempts; i++) {
      const x = this.rng.float(cfg.tuning.scrapSpawn.centerMargin, cfg.arena.width - cfg.tuning.scrapSpawn.centerMargin);
      const y = this.rng.float(cfg.tuning.scrapSpawn.centerMargin, cfg.arena.height - cfg.tuning.scrapSpawn.centerMargin);
      const d = Phaser.Math.Distance.Between(x, y, cfg.arena.recyclerPos.x, cfg.arena.recyclerPos.y);
      if (d > cfg.recycler.radius + cfg.tuning.scrapSpawn.recyclerBuffer) return { x, y };
    }
    return { x: cfg.arena.recyclerPos.x + cfg.tuning.scrapSpawn.fallbackOffsetX, y: cfg.arena.recyclerPos.y };
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

function downgradeQuality(q: VfxQuality): VfxQuality {
  if (q === "high") return "medium";
  if (q === "medium") return "low";
  return "low";
}

function positiveNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return n > 0 ? n : fallback;
}

function numOrDefault(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function describeWavePlan(plan: WavePlan): string {
  if (plan.special?.type === "breather") return "Breather wave: harvest and reset";

  const counts: Record<EnemyType, number> = { chaser: 0, shooter: 0, cutter: 0 };
  for (const spawn of plan.spawns) counts[spawn.type] += spawn.count;

  const details = [
    counts.chaser > 0 ? `${counts.chaser}x Chaser` : null,
    counts.shooter > 0 ? `${counts.shooter}x Shooter` : null,
    counts.cutter > 0 ? `${counts.cutter}x Cutter` : null,
  ].filter(Boolean);

  const title = plan.patternId ? titleCase(plan.patternId.replace(/_/g, " ")) : "Pressure wave";
  return details.length > 0 ? `${title} | ${details.join(", ")}` : title;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (s) => s.toUpperCase());
}
