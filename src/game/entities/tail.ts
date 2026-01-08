import Phaser from "phaser";

export type ScrapType = "common" | "heavy" | "rareShard";

export type TailSegment = {
  sprite: Phaser.Physics.Arcade.Image;
  type: ScrapType;
};

export class Tail {
  private readonly segments: TailSegment[] = [];
  private readonly trail: Phaser.Math.Vector2[] = [];
  private lastHeadX = 0;
  private lastHeadY = 0;
  private initialized = false;
  private pulseT = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly group: Phaser.Physics.Arcade.Group,
    private readonly cfg: {
      segmentSpacing: number;
      followStiffness: number;
      damping: number;
      segmentRadius: number;
      maxLenCap: number;
    },
    private readonly textures: Record<ScrapType, string>
  ) {}

  get length(): number {
    return this.segments.length;
  }

  getSpritesGroup(): Phaser.Physics.Arcade.Group {
    return this.group;
  }

  getTailDir(headX: number, headY: number): Phaser.Math.Vector2 {
    const first = this.segments[0];
    if (!first) return new Phaser.Math.Vector2(0, 1);
    const v = new Phaser.Math.Vector2(first.sprite.x - headX, first.sprite.y - headY);
    if (v.lengthSq() > 0.0001) v.normalize();
    return v;
  }

  addSegment(type: ScrapType, spawnX: number, spawnY: number): void {
    if (this.segments.length >= this.cfg.maxLenCap) return;
    const tex = this.textures[type];
    const spr = this.group.create(spawnX, spawnY, tex) as Phaser.Physics.Arcade.Image;
    spr.setDepth(20);
    spr.setCircle(this.cfg.segmentRadius);
    spr.setImmovable(true);
    const body = spr.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(true);
    this.segments.push({ sprite: spr, type });
  }

  removeLast(n: number): TailSegment[] {
    const removed: TailSegment[] = [];
    for (let i = 0; i < n; i++) {
      const seg = this.segments.pop();
      if (!seg) break;
      seg.sprite.destroy();
      removed.push(seg);
    }
    return removed;
  }

  clear(): TailSegment[] {
    return this.removeLast(this.segments.length);
  }

  countByType(): Record<ScrapType, number> {
    const out: Record<ScrapType, number> = { common: 0, heavy: 0, rareShard: 0 };
    for (const s of this.segments) out[s.type] += 1;
    return out;
  }

  update(dt: number, headX: number, headY: number): void {
    this.pulseT += dt;
    if (!this.initialized) {
      this.trail.length = 0;
      this.trail.push(new Phaser.Math.Vector2(headX, headY));
      this.lastHeadX = headX;
      this.lastHeadY = headY;
      this.initialized = true;
    }

    const step = Math.max(2, this.cfg.segmentSpacing * 0.25);
    const dx = headX - this.lastHeadX;
    const dy = headY - this.lastHeadY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= step) {
      this.trail.push(new Phaser.Math.Vector2(headX, headY));
      this.lastHeadX = headX;
      this.lastHeadY = headY;
    } else {
      const last = this.trail[this.trail.length - 1];
      if (last) {
        last.x = headX;
        last.y = headY;
      }
    }

    const maxTrail = Math.ceil((this.cfg.maxLenCap + 2) * (this.cfg.segmentSpacing / step)) + 4;
    if (this.trail.length > maxTrail) {
      this.trail.splice(0, this.trail.length - maxTrail);
    }

    const alpha = followAlpha(this.cfg.followStiffness, dt);
    const damp = clamp01(this.cfg.damping);

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i]!;
      const desired = sampleTrail(this.trail, (i + 1) * this.cfg.segmentSpacing);
      seg.sprite.x = Phaser.Math.Linear(seg.sprite.x, desired.x, alpha);
      seg.sprite.y = Phaser.Math.Linear(seg.sprite.y, desired.y, alpha);

      const amp = seg.type === "rareShard" ? 0.06 : seg.type === "heavy" ? 0.04 : 0.05;
      const phase = this.pulseT * 2.2 + i * 0.85;
      seg.sprite.setScale(1 + Math.sin(phase) * amp);

      // микро-дэмпинг для стабильности (Arcade body может иметь velocity от коллизий)
      const body = seg.sprite.body as Phaser.Physics.Arcade.Body;
      body.velocity.scale(1 - damp);
    }
  }
}

function sampleTrail(points: Phaser.Math.Vector2[], distance: number): Phaser.Math.Vector2 {
  if (points.length === 0) return new Phaser.Math.Vector2();
  if (points.length === 1) return points[0]!.clone();

  let remaining = distance;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i]!;
    const b = points[i - 1]!;
    const segLen = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
    if (segLen >= remaining && segLen > 0.0001) {
      const t = remaining / segLen;
      return new Phaser.Math.Vector2(Phaser.Math.Linear(a.x, b.x, t), Phaser.Math.Linear(a.y, b.y, t));
    }
    remaining -= segLen;
  }
  return points[0]!.clone();
}

function followAlpha(stiffness: number, dt: number): number {
  const s = clamp01(stiffness);
  return 1 - Math.pow(1 - s, dt * 60);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
