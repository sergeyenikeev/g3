import { VISUAL_PALETTE } from "./TextureFactory";

export type VfxQuality = "low" | "medium" | "high";

export type VfxManagerOptions = {
  quality?: VfxQuality;
};

type Vec2 = { x: number; y: number };

type RingFx = {
  kind: "ring";
  obj: any;
  age: number;
  life: number;
  x: number;
  y: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
};

type ParticleFx = {
  kind: "particle";
  obj: any;
  age: number;
  life: number;
  vx: number;
  vy: number;
  drag: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
};

type TweenFx = {
  kind: "tween";
  obj: any;
  age: number;
  life: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  ease: "inOut" | "out";
};

type OverlayPulseFx = {
  kind: "overlayPulse";
  obj: any;
  age: number;
  life: number;
  aPeak: number;
};

type AnyFx = RingFx | ParticleFx | TweenFx | OverlayPulseFx;

export class VfxManager {
  private timeMs = 0;
  private quality: VfxQuality;

  private fx: AnyFx[] = [];

  private readonly maxParticlesLow = 120;
  private readonly maxParticlesMed = 220;
  private readonly maxParticlesHigh = 360;

  private readonly magLineMinIntervalMs = 120;

  private magDesired: { origin: Vec2; targets: Vec2[] } | null = null;
  private magLines: any[] = [];
  private magLastUpdateMs = -1e9;

  constructor(
    private readonly world: any,
    private readonly ui?: any,
    opts: VfxManagerOptions = {}
  ) {
    this.quality = opts.quality ?? "medium";
  }

  setQuality(preset: VfxQuality): void {
    this.quality = preset;
  }

  getQuality(): VfxQuality {
    return this.quality;
  }

  emit(eventName: string, params: any = {}): void {
    if (!eventName) return;
    switch (eventName) {
      case "scrap_collected":
        this.onScrapCollected(params);
        return;
      case "flip_used":
        this.onFlipUsed(params);
        return;
      case "projectile_deflected":
        this.onProjectileDeflected(params);
        return;
      case "player_hit":
        this.onPlayerHit(params);
        return;
      case "tail_cut":
        this.onTailCut(params);
        return;
      case "bank_complete":
        this.onBankComplete(params);
        return;
      case "wave_start":
        this.onWaveStart(params);
        return;
      case "upgrade_offer_shown":
        this.onUpgradeOfferShown(params);
        return;
      default:
        return;
    }
  }

  update(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.timeMs += dt * 1000;

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]!;
      f.age += dt;
      const t = clamp01(f.age / Math.max(1e-6, f.life));

      if (f.kind === "ring") {
        const k = easeOutCubic(t);
        const s = lerp(f.s0, f.s1, k);
        const a = lerp(f.a0, f.a1, k);
        safeSet(f.obj, "setPosition", f.x, f.y);
        safeSet(f.obj, "setScale", s);
        safeSet(f.obj, "setAlpha", a);
      } else if (f.kind === "particle") {
        const k = easeOutCubic(t);
        f.vx *= Math.pow(1 - clamp01(f.drag), dt * 60);
        f.vy *= Math.pow(1 - clamp01(f.drag), dt * 60);
        safeSet(f.obj, "setPosition", (f.obj?.x ?? 0) + f.vx * dt, (f.obj?.y ?? 0) + f.vy * dt);
        safeSet(f.obj, "setScale", lerp(f.s0, f.s1, k));
        safeSet(f.obj, "setAlpha", lerp(f.a0, f.a1, k));
      } else if (f.kind === "tween") {
        const k = f.ease === "inOut" ? easeInOutQuad(t) : easeOutCubic(t);
        safeSet(f.obj, "setPosition", lerp(f.x0, f.x1, k), lerp(f.y0, f.y1, k));
        safeSet(f.obj, "setScale", lerp(f.s0, f.s1, k));
        safeSet(f.obj, "setAlpha", lerp(f.a0, f.a1, k));
      } else if (f.kind === "overlayPulse") {
        const k = t < 0.5 ? easeOutCubic(t * 2) : easeOutCubic((1 - t) * 2);
        safeSet(f.obj, "setAlpha", f.aPeak * k);
      }

      if (f.age >= f.life) {
        safeCall(f.obj, "destroy");
        this.fx.splice(i, 1);
      }
    }

    this.updateMagnetLines();
  }

  destroy(): void {
    for (const f of this.fx) safeCall(f.obj, "destroy");
    this.fx = [];
    for (const l of this.magLines) safeCall(l, "destroy");
    this.magLines = [];
    this.magDesired = null;
  }

  setMagnetLines(origin: Vec2, targets: Vec2[]): void {
    this.magDesired = { origin, targets };
  }

  private updateMagnetLines(): void {
    if (!this.magDesired) {
      if (this.magLines.length > 0) {
        for (const l of this.magLines) safeCall(l, "destroy");
        this.magLines = [];
      }
      return;
    }

    if (this.timeMs - this.magLastUpdateMs < this.magLineMinIntervalMs) return;
    this.magLastUpdateMs = this.timeMs;

    const maxLines = this.quality === "low" ? 4 : 8;
    const origin = this.magDesired.origin;
    const targets = this.magDesired.targets.slice(0, maxLines);

    while (this.magLines.length > targets.length) {
      const l = this.magLines.pop();
      safeCall(l, "destroy");
    }
    while (this.magLines.length < targets.length) {
      const obj = this.world?.add?.image?.(origin.x, origin.y, "vfx_line");
      if (!obj) break;
      safeSet(obj, "setDepth", 65);
      safeSet(obj, "setBlendMode", "ADD");
      safeSet(obj, "setTint", VISUAL_PALETTE.neonCyan);
      safeSet(obj, "setAlpha", 0.22);
      this.magLines.push(obj);
    }

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      const dx = t.x - origin.x;
      const dy = t.y - origin.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const midX = origin.x + dx * 0.5;
      const midY = origin.y + dy * 0.5;
      const rot = Math.atan2(dy, dx) - Math.PI / 2;
      const obj = this.magLines[i];
      if (!obj) continue;
      safeSet(obj, "setPosition", midX, midY);
      safeSet(obj, "setRotation", rot);
      safeSet(obj, "setDisplaySize", 2, Math.max(6, len));
      safeSet(obj, "setAlpha", 0.18);
    }
  }

  private onScrapCollected(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    const tex = typeof p?.tex === "string" ? p.tex : typeof p?.texture === "string" ? p.texture : "scrap_common";

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const pop = this.world?.add?.image?.(x, y, tex);
    if (pop) {
      safeSet(pop, "setDepth", 60);
      safeSet(pop, "setAlpha", 0.9);
      safeSet(pop, "setScale", 0.8);
      this.fx.push({ kind: "tween", obj: pop, age: 0, life: 0.18, x0: x, y0: y, x1: x, y1: y, s0: 0.8, s1: 1.15, a0: 0.9, a1: 0, ease: "out" });
    }

    this.spawnGlow(x, y, VISUAL_PALETTE.neonCyan, 0.24, 0.55, 0.16);
    this.spawnSparkBurst(x, y, this.quality === "low" ? 6 : this.quality === "high" ? 10 : 8, {
      tintA: VISUAL_PALETTE.metalLight,
      tintB: VISUAL_PALETTE.neonCyan,
      speed: 240,
      life: 0.26,
      spread: 1,
    });

    const uiTarget = { x: 90, y: 20 };
    this.spawnUiFlyIcon(x, y, uiTarget.x, uiTarget.y, "vfx_spark", VISUAL_PALETTE.neonCyan);
  }

  private onFlipUsed(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    const radius = Math.max(1, num(p?.radius) || 160);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this.cameraShake(120, 0.003);

    const ring = this.world?.add?.image?.(x, y, "vfx_ring");
    if (ring) {
      safeSet(ring, "setDepth", 70);
      safeSet(ring, "setBlendMode", "ADD");
      safeSet(ring, "setTint", VISUAL_PALETTE.neonCyan);
      const baseScale = radius / 128;
      safeSet(ring, "setScale", baseScale * 0.2);
      safeSet(ring, "setAlpha", 0.9);
      this.fx.push({ kind: "ring", obj: ring, age: 0, life: 0.22, x, y, s0: baseScale * 0.2, s1: baseScale * 1.2, a0: 0.9, a1: 0 });
    }

    const sparkCount = this.quality === "low" ? 16 : this.quality === "high" ? 28 : 22;
    this.spawnRadialSparks(x, y, radius, sparkCount, VISUAL_PALETTE.neonCyan, 0.26);
    this.spawnGlow(x, y, VISUAL_PALETTE.neonCyan, 0.38, 1.05, 0.16);
  }

  private onProjectileDeflected(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const ring = this.world?.add?.image?.(x, y, "vfx_ring");
    if (ring) {
      safeSet(ring, "setDepth", 68);
      safeSet(ring, "setBlendMode", "ADD");
      safeSet(ring, "setTint", VISUAL_PALETTE.neonCyan);
      safeSet(ring, "setScale", 0.25);
      safeSet(ring, "setAlpha", 0.6);
      this.fx.push({ kind: "ring", obj: ring, age: 0, life: 0.16, x, y, s0: 0.25, s1: 0.75, a0: 0.6, a1: 0 });
    }

    this.spawnSparkBurst(x, y, 5, { tintA: VISUAL_PALETTE.metalLight, tintB: VISUAL_PALETTE.neonCyan, speed: 190, life: 0.18, spread: 1 });
  }

  private onPlayerHit(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this.cameraShake(160, 0.004);

    const flash = this.world?.add?.image?.(x, y, "vfx_hit_flash");
    if (flash) {
      safeSet(flash, "setDepth", 72);
      safeSet(flash, "setBlendMode", "ADD");
      safeSet(flash, "setTint", VISUAL_PALETTE.hpRed);
      safeSet(flash, "setAlpha", 0.9);
      safeSet(flash, "setScale", 0.75);
      this.fx.push({ kind: "ring", obj: flash, age: 0, life: 0.18, x, y, s0: 0.75, s1: 1.1, a0: 0.9, a1: 0 });
    }

    this.spawnSparkBurst(x, y, 8, { tintA: VISUAL_PALETTE.hpRed, tintB: VISUAL_PALETTE.warningAmber, speed: 260, life: 0.24, spread: 1 });
    this.spawnRedVignettePulse(0.35, 0.15);
  }

  private onTailCut(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this.cameraShake(140, 0.0035);
    this.spawnSparkBurst(x, y, this.quality === "low" ? 10 : 14, {
      tintA: VISUAL_PALETTE.warningAmber,
      tintB: VISUAL_PALETTE.metalLight,
      speed: 250,
      life: 0.28,
      spread: 1,
    });

    const smoke = this.world?.add?.image?.(x, y, "vfx_smoke_puff");
    if (smoke) {
      safeSet(smoke, "setDepth", 66);
      safeSet(smoke, "setBlendMode", "SCREEN");
      safeSet(smoke, "setTint", VISUAL_PALETTE.metalGray);
      safeSet(smoke, "setAlpha", 0.22);
      safeSet(smoke, "setScale", 0.9);
      this.fx.push({ kind: "ring", obj: smoke, age: 0, life: 0.42, x, y, s0: 0.9, s1: 1.45, a0: 0.22, a1: 0 });
    }
  }

  private onBankComplete(p: any): void {
    const x = num(p?.x);
    const y = num(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    this.spawnGlow(x, y, VISUAL_PALETTE.successGreen, 0.35, 1.35, 0.28);
    const count = this.quality === "low" ? 14 : this.quality === "high" ? 28 : 20;
    this.spawnInwardBurst(x, y, count, {
      rMin: 40,
      rMax: 110,
      tintA: VISUAL_PALETTE.successGreen,
      tintB: VISUAL_PALETTE.warningAmber,
      life: 0.38,
    });
  }

  private onWaveStart(p: any): void {
    const waveIndex = typeof p?.waveIndex === "number" ? p.waveIndex : null;
    if (!this.ui || !waveIndex) return;
    const { width } = this.ui.scale ?? { width: 0 };
    const txt = this.ui.add?.text?.(width / 2, 42, `WAVE ${waveIndex}`, {
      fontSize: "20px",
      color: "#d9f2ff",
      fontStyle: "700",
    });
    if (!txt) return;
    safeSet(txt, "setOrigin", 0.5);
    safeSet(txt, "setScrollFactor", 0);
    safeSet(txt, "setDepth", 1100);
    safeSet(txt, "setAlpha", 0);
    this.fx.push({
      kind: "tween",
      obj: txt,
      age: 0,
      life: 0.8,
      x0: width / 2,
      y0: 28,
      x1: width / 2,
      y1: 52,
      s0: 0.96,
      s1: 1,
      a0: 0,
      a1: 1,
      ease: "inOut",
    });
  }

  private onUpgradeOfferShown(_p: any): void {
    if (!this.ui) return;
    const { width, height } = this.ui.scale ?? { width: 0, height: 0 };
    const glow = this.ui.add?.image?.(width / 2, height / 2, "vfx_glow_blob");
    if (!glow) return;
    safeSet(glow, "setScrollFactor", 0);
    safeSet(glow, "setDepth", 1050);
    safeSet(glow, "setBlendMode", "ADD");
    safeSet(glow, "setTint", VISUAL_PALETTE.neonMagenta);
    safeSet(glow, "setAlpha", 0.18);
    safeSet(glow, "setScale", 4.2);
    this.fx.push({ kind: "ring", obj: glow, age: 0, life: 0.25, x: width / 2, y: height / 2, s0: 4.2, s1: 5.1, a0: 0.18, a1: 0 });
  }

  private spawnSparkBurst(
    x: number,
    y: number,
    count: number,
    spec: { tintA: number; tintB: number; speed: number; life: number; spread: number }
  ): void {
    const n = clampInt(count, 0, 64);
    if (n <= 0) return;

    const cap = this.getMaxParticles();
    const current = this.countParticles();
    const avail = Math.max(0, cap - current);
    const spawn = Math.min(n, avail);
    if (spawn <= 0) return;

    for (let i = 0; i < spawn; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() ** 0.6 * spec.spread;
      const vx = Math.cos(a) * spec.speed * (0.45 + Math.random() * 0.75) * r;
      const vy = Math.sin(a) * spec.speed * (0.45 + Math.random() * 0.75) * r;
      const tint = Math.random() < 0.5 ? spec.tintA : spec.tintB;

      const obj = this.world?.add?.image?.(x, y, "vfx_spark");
      if (!obj) continue;
      safeSet(obj, "setDepth", 75);
      safeSet(obj, "setBlendMode", "ADD");
      safeSet(obj, "setTint", tint);
      safeSet(obj, "setAlpha", 1);
      safeSet(obj, "setScale", 0.75 + Math.random() * 0.65);
      safeSet(obj, "setRotation", Math.random() * Math.PI * 2);

      this.fx.push({
        kind: "particle",
        obj,
        age: 0,
        life: spec.life * (0.75 + Math.random() * 0.45),
        vx,
        vy,
        drag: 0.12,
        s0: 0.85 + Math.random() * 0.55,
        s1: 0,
        a0: 1,
        a1: 0,
      });
    }
  }

  private spawnRadialSparks(x: number, y: number, radius: number, count: number, tint: number, life: number): void {
    const n = clampInt(count, 0, 64);
    if (n <= 0) return;

    const cap = this.getMaxParticles();
    const current = this.countParticles();
    const avail = Math.max(0, cap - current);
    const spawn = Math.min(n, avail);
    if (spawn <= 0) return;

    const off = Math.random() * Math.PI * 2;
    for (let i = 0; i < spawn; i++) {
      const a = off + (i / Math.max(1, spawn)) * Math.PI * 2;
      const px = x + Math.cos(a) * radius * (0.65 + Math.random() * 0.35);
      const py = y + Math.sin(a) * radius * (0.65 + Math.random() * 0.35);
      const vx = Math.cos(a) * (260 + Math.random() * 140);
      const vy = Math.sin(a) * (260 + Math.random() * 140);

      const obj = this.world?.add?.image?.(px, py, "vfx_spark");
      if (!obj) continue;
      safeSet(obj, "setDepth", 75);
      safeSet(obj, "setBlendMode", "ADD");
      safeSet(obj, "setTint", tint);
      safeSet(obj, "setAlpha", 1);
      safeSet(obj, "setScale", 0.95 + Math.random() * 0.5);
      safeSet(obj, "setRotation", a);

      this.fx.push({
        kind: "particle",
        obj,
        age: 0,
        life: life * (0.75 + Math.random() * 0.4),
        vx,
        vy,
        drag: 0.14,
        s0: 0.9,
        s1: 0,
        a0: 1,
        a1: 0,
      });
    }
  }

  private spawnInwardBurst(
    x: number,
    y: number,
    count: number,
    spec: { rMin: number; rMax: number; tintA: number; tintB: number; life: number }
  ): void {
    const n = clampInt(count, 0, 96);
    if (n <= 0) return;

    const cap = this.getMaxParticles();
    const current = this.countParticles();
    const avail = Math.max(0, cap - current);
    const spawn = Math.min(n, avail);
    if (spawn <= 0) return;

    for (let i = 0; i < spawn; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = lerp(spec.rMin, spec.rMax, Math.random() ** 0.7);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      const dirX = (x - px) / Math.max(1e-6, r);
      const dirY = (y - py) / Math.max(1e-6, r);
      const speed = 260 + Math.random() * 200;
      const vx = dirX * speed;
      const vy = dirY * speed;
      const tint = Math.random() < 0.55 ? spec.tintA : spec.tintB;

      const obj = this.world?.add?.image?.(px, py, "vfx_spark");
      if (!obj) continue;
      safeSet(obj, "setDepth", 74);
      safeSet(obj, "setBlendMode", "ADD");
      safeSet(obj, "setTint", tint);
      safeSet(obj, "setAlpha", 0.85);
      safeSet(obj, "setScale", 0.8 + Math.random() * 0.6);
      safeSet(obj, "setRotation", a);

      this.fx.push({
        kind: "particle",
        obj,
        age: 0,
        life: spec.life * (0.75 + Math.random() * 0.35),
        vx,
        vy,
        drag: 0.18,
        s0: 1,
        s1: 0,
        a0: 0.85,
        a1: 0,
      });
    }
  }

  private spawnGlow(x: number, y: number, tint: number, alpha: number, scale: number, life: number): void {
    const obj = this.world?.add?.image?.(x, y, "vfx_glow_blob");
    if (!obj) return;
    safeSet(obj, "setDepth", 69);
    safeSet(obj, "setBlendMode", "ADD");
    safeSet(obj, "setTint", tint);
    safeSet(obj, "setAlpha", alpha);
    safeSet(obj, "setScale", scale * 0.7);
    this.fx.push({ kind: "ring", obj, age: 0, life, x, y, s0: scale * 0.7, s1: scale, a0: alpha, a1: 0 });
  }

  private spawnUiFlyIcon(worldX: number, worldY: number, uiX: number, uiY: number, key: string, tint: number): void {
    const ui = this.ui;
    const world = this.world;
    if (!ui || !world) return;
    const cam = world.cameras?.main;
    if (!cam) return;

    const x0 = (worldX - cam.scrollX) * cam.zoom;
    const y0 = (worldY - cam.scrollY) * cam.zoom;

    const obj = ui.add?.image?.(x0, y0, key);
    if (!obj) return;

    safeSet(obj, "setScrollFactor", 0);
    safeSet(obj, "setDepth", 1005);
    safeSet(obj, "setBlendMode", "ADD");
    safeSet(obj, "setTint", tint);
    safeSet(obj, "setAlpha", 0.85);
    safeSet(obj, "setScale", 0.9);

    this.fx.push({ kind: "tween", obj, age: 0, life: 0.6, x0, y0, x1: uiX, y1: uiY, s0: 0.9, s1: 0.1, a0: 0.85, a1: 0, ease: "inOut" });
  }

  private spawnRedVignettePulse(alphaPeak: number, durationSec: number): void {
    if (!this.ui) return;
    const { width, height } = this.ui.scale ?? { width: 0, height: 0 };
    const img = this.ui.add?.image?.(width / 2, height / 2, "vignette");
    if (!img) return;
    safeSet(img, "setScrollFactor", 0);
    safeSet(img, "setDepth", 950);
    safeSet(img, "setTint", VISUAL_PALETTE.hpRed);
    safeSet(img, "setAlpha", 0);
    safeSet(img, "setDisplaySize", width, height);
    this.fx.push({ kind: "overlayPulse", obj: img, age: 0, life: durationSec, aPeak: alphaPeak });
  }

  private cameraShake(durationMs: number, intensity: number): void {
    try {
      const cam = this.world?.cameras?.main;
      cam?.shake?.(durationMs, intensity);
    } catch {
      // ignore
    }
  }

  private countParticles(): number {
    let n = 0;
    for (const f of this.fx) if (f.kind === "particle") n++;
    return n;
  }

  private getMaxParticles(): number {
    if (this.quality === "low") return this.maxParticlesLow;
    if (this.quality === "high") return this.maxParticlesHigh;
    return this.maxParticlesMed;
  }
}

function safeSet(obj: any, method: string, ...args: any[]): void {
  try {
    const fn = obj?.[method];
    if (typeof fn === "function") fn.apply(obj, args);
  } catch {
    // ignore
  }
}

function safeCall(obj: any, method: string, ...args: any[]): void {
  try {
    const fn = obj?.[method];
    if (typeof fn === "function") fn.apply(obj, args);
  } catch {
    // ignore
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  const k = clamp01(t);
  return 1 - Math.pow(1 - k, 3);
}

function easeInOutQuad(t: number): number {
  const k = clamp01(t);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

function num(v: any): number {
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

