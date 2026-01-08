import { createRng } from "../core/prng";

export type PixelTexture = { width: number; height: number; pixels: Uint8ClampedArray };

export const VISUAL_PALETTE = {
  bgDeep: 0x0b0f14,
  bgMid: 0x121a24,
  rustDark: 0x3a2a1e,
  rustMid: 0x6b3f2b,
  metalGray: 0x6e7a86,
  metalLight: 0xa7b2be,
  neonCyan: 0x3af2ff,
  neonBlue: 0x2d7bff,
  neonMagenta: 0xff3ad7,
  warningAmber: 0xffb02e,
  hpRed: 0xff3d3d,
  successGreen: 0x3dff9b,
  white: 0xffffff,
  black: 0x000000,
} as const;

type CanvasTextureLike = {
  key?: string;
  width: number;
  height: number;
  canvas?: any;
  context?: any;
  refresh?: () => void;
};

type TextureManagerLike = {
  exists: (key: string) => boolean;
  get: (key: string) => any;
  createCanvas: (key: string, width: number, height: number) => CanvasTextureLike | null;
};

type SceneLike = { textures: TextureManagerLike };

export function createBgTile256Pixels(seed: number | string): PixelTexture {
  const w = 256;
  const h = 256;
  const pixels = new Uint8ClampedArray(w * h * 4);

  const rng = createRng(`visual:bg_tile:${seed}`);
  const cTop = rgb(VISUAL_PALETTE.bgDeep);
  const cBot = rgb(VISUAL_PALETTE.bgMid);

  const blobs = Array.from({ length: 7 }, () => ({
    x: rng.int(0, w - 1),
    y: rng.int(0, h - 1),
    r: rng.int(26, 70),
    tone: rng.next(),
    alpha: rng.float(0.08, 0.22),
  }));

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const n = rng.next();
      const base = lerpRgb(cTop, cBot, smoothstep(0.05, 0.95, t));
      const vign = 1 - 0.22 * edgeFalloff(x, y, w, h);

      let r = base.r * vign;
      let g = base.g * vign;
      let b = base.b * vign;

      const grain = (n * 2 - 1) * 16;
      r = clamp255(r + grain);
      g = clamp255(g + grain);
      b = clamp255(b + grain);

      for (const bl of blobs) {
        const dx = x - bl.x;
        const dy = y - bl.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > bl.r) continue;
        const k = 1 - d / Math.max(1, bl.r);
        const a = bl.alpha * smoothstep(0, 1, k);
        const rust = lerpRgb(rgb(VISUAL_PALETTE.rustDark), rgb(VISUAL_PALETTE.rustMid), bl.tone);
        ({ r, g, b } = blend({ r, g, b }, rust, a));
      }

      const idx = (y * w + x) * 4;
      pixels[idx + 0] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  const scratchCount = 18;
  for (let i = 0; i < scratchCount; i++) {
    const x0 = rng.int(-40, w + 40);
    const y0 = rng.int(-40, h + 40);
    const x1 = x0 + rng.int(-120, 120);
    const y1 = y0 + rng.int(-120, 120);
    const a = rng.float(0.08, 0.18);
    drawLine(pixels, w, h, x0, y0, x1, y1, rgb(VISUAL_PALETTE.metalGray), a, rng.int(1, 2));
  }

  const boltCount = 10;
  for (let i = 0; i < boltCount; i++) {
    const cx = rng.int(12, w - 13);
    const cy = rng.int(12, h - 13);
    const rr = rng.int(2, 3);
    drawCircle(pixels, w, h, cx, cy, rr + 2, rgb(VISUAL_PALETTE.bgDeep), 0.55);
    drawCircle(pixels, w, h, cx, cy, rr, rgb(VISUAL_PALETTE.metalLight), 0.8);
  }

  return { width: w, height: h, pixels };
}

export function createBgFarSilhouettePixels(seed: number | string): PixelTexture {
  const w = 1024;
  const h = 512;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`visual:bg_far:${seed}`);

  const top = rgb(0x06080c);
  const bot = rgb(VISUAL_PALETTE.bgDeep);
  const silA = rgb(0x0f141c);
  const silB = rgb(VISUAL_PALETTE.rustDark);

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const base = lerpRgb(top, bot, smoothstep(0.0, 1.0, t));
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = base.r;
      pixels[idx + 1] = base.g;
      pixels[idx + 2] = base.b;
      pixels[idx + 3] = 255;
    }
  }

  const groundY = Math.floor(h * 0.72);
  const hillCount = 18;
  for (let i = 0; i < hillCount; i++) {
    const cx = rng.int(-80, w + 80);
    const cy = rng.int(groundY - 30, groundY + 40);
    const rr = rng.int(80, 220);
    const a = rng.float(0.25, 0.5);
    drawCircle(pixels, w, h, cx, cy, rr, lerpRgb(silA, silB, rng.next()), a);
  }

  const craneCount = 6;
  for (let i = 0; i < craneCount; i++) {
    const baseX = rng.int(40, w - 40);
    const baseY = groundY - rng.int(60, 140);
    const height = rng.int(120, 220);
    const mastW = rng.int(14, 22);
    const arm = rng.int(160, 320) * (rng.next() < 0.5 ? -1 : 1);
    const a = rng.float(0.24, 0.42);
    fillRect(pixels, w, h, baseX - Math.floor(mastW / 2), baseY - height, mastW, height + rng.int(10, 40), silA, a);
    drawLine(pixels, w, h, baseX, baseY - height, baseX + arm, baseY - height + rng.int(-22, 18), silA, a, 3);
    drawLine(pixels, w, h, baseX + Math.floor(arm * 0.6), baseY - height, baseX + Math.floor(arm * 0.68), baseY - height + rng.int(70, 120), silA, a, 2);
  }

  const hazeH = Math.floor(h * 0.22);
  for (let y = 0; y < hazeH; y++) {
    const t = y / Math.max(1, hazeH - 1);
    const a = 0.22 * (1 - t);
    for (let x = 0; x < w; x++) {
      const idx = ((h - 1 - y) * w + x) * 4;
      const r0 = pixels[idx + 0]!;
      const g0 = pixels[idx + 1]!;
      const b0 = pixels[idx + 2]!;
      const out = blend({ r: r0, g: g0, b: b0 }, rgb(VISUAL_PALETTE.bgMid), a);
      pixels[idx + 0] = out.r;
      pixels[idx + 1] = out.g;
      pixels[idx + 2] = out.b;
    }
  }

  return { width: w, height: h, pixels };
}

export function createVignettePixels(): PixelTexture {
  const w = 512;
  const h = 512;
  const pixels = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const dx = Math.abs(u - 0.5) / 0.5;
      const dy = Math.abs(v - 0.5) / 0.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = clamp01(smoothstep(0.62, 1.02, d));
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

export function createLightGradientPixels(): PixelTexture {
  const w = 512;
  const h = 512;
  const pixels = new Uint8ClampedArray(w * h * 4);

  const cold = rgb(VISUAL_PALETTE.neonBlue);
  const warm = rgb(VISUAL_PALETTE.warningAmber);

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const c = lerpRgb(cold, warm, smoothstep(0.0, 1.0, t));
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const cx = 0.5;
      const cy = 0.28;
      const dx = (u - cx) / 0.75;
      const dy = (v - cy) / 0.65;
      const d = Math.sqrt(dx * dx + dy * dy);
      const beam = 1 - clamp01(smoothstep(0.2, 1.05, d));

      const a = clamp01(0.22 * t + 0.38 * beam);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = c.r;
      pixels[idx + 1] = c.g;
      pixels[idx + 2] = c.b;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

export function createVfxTexturesPixels(): Record<string, PixelTexture> {
  return {
    vfx_ring: ringPixels(256, 0.42, 0.49),
    vfx_glow_blob: glowPixels(128, 0.82),
    vfx_spark: sparkPixels(32),
    vfx_smoke_puff: smokePixels(64),
    vfx_trail: trailPixels(64, 16),
    vfx_hit_flash: hitFlashPixels(64),
    vfx_line: linePixels(1, 64),
  };
}

export function createDecalsPixels(seed: number | string): Record<string, PixelTexture> {
  const rng = createRng(`visual:decals:${seed}`);
  const out: Record<string, PixelTexture> = {};

  for (let i = 1; i <= 4; i++) out[`decal_oil_0${i}`] = oilPixels(64, rng.next());
  for (let i = 1; i <= 4; i++) out[`decal_scratch_0${i}`] = scratchPixels(64, rng.next());
  for (let i = 1; i <= 4; i++) out[`decal_bolts_0${i}`] = boltsPixels(64, rng.next());

  return out;
}

export function createRarityFramesPixels(): Record<string, PixelTexture> {
  return {
    rarity_frame_common: rarityFramePixels(256, 128, VISUAL_PALETTE.metalGray),
    rarity_frame_uncommon: rarityFramePixels(256, 128, VISUAL_PALETTE.successGreen),
    rarity_frame_rare: rarityFramePixels(256, 128, VISUAL_PALETTE.neonBlue),
    rarity_frame_epic: rarityFramePixels(256, 128, VISUAL_PALETTE.neonMagenta),
  };
}

export function createBgTile256(scene: SceneLike, seed: number | string, key = "bg_tile_256"): CanvasTextureLike {
  return ensureCanvasTexture(scene, key, createBgTile256Pixels(seed));
}

export function createBgFarSilhouette(scene: SceneLike, seed: number | string, key = "bg_far_silhouette"): CanvasTextureLike {
  return ensureCanvasTexture(scene, key, createBgFarSilhouettePixels(seed));
}

export function createVignette(scene: SceneLike, key = "vignette"): CanvasTextureLike {
  return ensureCanvasTexture(scene, key, createVignettePixels());
}

export function createLightGradient(scene: SceneLike, key = "lightGradient"): CanvasTextureLike {
  return ensureCanvasTexture(scene, key, createLightGradientPixels());
}

export function createVfxTextures(scene: SceneLike): Record<string, CanvasTextureLike> {
  const pixels = createVfxTexturesPixels();
  const out: Record<string, CanvasTextureLike> = {};
  for (const [key, tex] of Object.entries(pixels)) out[key] = ensureCanvasTexture(scene, key, tex);
  return out;
}

export function createDecals(scene: SceneLike, seed: number | string): Record<string, CanvasTextureLike> {
  const pixels = createDecalsPixels(seed);
  const out: Record<string, CanvasTextureLike> = {};
  for (const [key, tex] of Object.entries(pixels)) out[key] = ensureCanvasTexture(scene, key, tex);
  return out;
}

export function createRarityFrames(scene: SceneLike): Record<string, CanvasTextureLike> {
  const pixels = createRarityFramesPixels();
  const out: Record<string, CanvasTextureLike> = {};
  for (const [key, tex] of Object.entries(pixels)) out[key] = ensureCanvasTexture(scene, key, tex);
  return out;
}

function ensureCanvasTexture(scene: SceneLike, key: string, tex: PixelTexture): CanvasTextureLike {
  if (scene.textures.exists(key)) return scene.textures.get(key) as CanvasTextureLike;

  const canvasTex = scene.textures.createCanvas(key, tex.width, tex.height);
  if (!canvasTex) return { width: tex.width, height: tex.height };
  try {
    const ctx = canvasTex.context;
    if (!ctx || typeof ctx.putImageData !== "function") return canvasTex;

    const img = makeImageData(tex.pixels, tex.width, tex.height, ctx);
    if (!img) return canvasTex;

    ctx.putImageData(img, 0, 0);
    canvasTex.refresh?.();
  } catch {
    // ignore
  }
  return canvasTex;
}

function makeImageData(pixels: Uint8ClampedArray, width: number, height: number, ctx: any): ImageData | null {
  try {
    if (typeof ImageData !== "undefined") return new ImageData(pixels as unknown as Uint8ClampedArray<ArrayBuffer>, width, height);
  } catch {
    // ignore
  }

  try {
    const img = ctx?.createImageData?.(width, height);
    if (!img?.data) return null;
    img.data.set(pixels);
    return img;
  } catch {
    return null;
  }
}

function ringPixels(size: number, inner: number, outer: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r0 = Math.min(w, h) * inner;
  const r1 = Math.min(w, h) * outer;
  const blur = Math.max(1, Math.min(w, h) * 0.02);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const aIn = 1 - smoothstep(r0 - blur, r0 + blur, d);
      const aOut = smoothstep(r1 - blur, r1 + blur, d);
      const a = clamp01(aIn * (1 - aOut));

      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function glowPixels(size: number, intensity: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const sigma = size * 0.18;
  const inv2 = 1 / (2 * sigma * sigma);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const g = Math.exp(-(dx * dx + dy * dy) * inv2);
      const a = clamp01(g * intensity);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function sparkPixels(size: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const d = Math.min(dx, dy);
      const core = 1 - clamp01(d / (size * 0.22));
      const streak = 1 - clamp01(Math.min(dx, dy) / (size * 0.12));
      const a = clamp01(core * 0.8 + streak * 0.55);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function smokePixels(size: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rng = createRng(`visual:smoke:${size}`);
  const sigma = size * 0.22;
  const inv2 = 1 / (2 * sigma * sigma);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const g = Math.exp(-(dx * dx + dy * dy) * inv2);
      const n = (rng.next() * 2 - 1) * 0.18;
      const a = clamp01((g + n) * 0.85);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function trailPixels(w: number, h: number): PixelTexture {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    const band = 1 - Math.abs(v - 0.5) / 0.5;
    const a0 = clamp01(smoothstep(0.0, 1.0, band));
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const a = clamp01(a0 * (1 - u));
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }
  return { width: w, height: h, pixels };
}

function hitFlashPixels(size: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const d = Math.sqrt(dx * dx + dy * dy);
      const core = 1 - clamp01(d / (size * 0.35));
      const cross = 1 - clamp01(Math.min(dx, dy) / (size * 0.06));
      const a = clamp01(core * 0.8 + cross * 0.55);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function linePixels(w: number, h: number): PixelTexture {
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const a = clamp01(1 - Math.abs(t - 0.5) / 0.5);
    const idx = y * w * 4;
    pixels[idx + 0] = 255;
    pixels[idx + 1] = 255;
    pixels[idx + 2] = 255;
    pixels[idx + 3] = Math.floor(255 * a);
  }
  return { width: w, height: h, pixels };
}

function oilPixels(size: number, tone: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r0 = size * (0.26 + tone * 0.18);
  const rng = createRng(`visual:oil:${tone}`);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const wobble = (rng.next() * 2 - 1) * (size * 0.035);
      const a = clamp01(1 - smoothstep(r0, r0 + size * 0.18, d + wobble));

      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = Math.floor(255 * a * 0.55);
    }
  }

  return { width: w, height: h, pixels };
}

function scratchPixels(size: number, tone: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`visual:scratch:${tone}`);
  const base = rgb(VISUAL_PALETTE.metalGray);

  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const x0 = rng.int(-8, w + 8);
    const y0 = rng.int(-8, h + 8);
    const x1 = x0 + rng.int(-50, 50);
    const y1 = y0 + rng.int(-50, 50);
    const a = rng.float(0.18, 0.32);
    drawLine(pixels, w, h, x0, y0, x1, y1, base, a, rng.int(1, 2));
  }

  return { width: w, height: h, pixels };
}

function rarityFramePixels(w: number, h: number, color: number): PixelTexture {
  const pixels = new Uint8ClampedArray(w * h * 4);
  const col = rgb(color);
  const accent = rgb(VISUAL_PALETTE.metalLight);
  const t = Math.max(3, Math.round(Math.min(w, h) * 0.03));

  fillRect(pixels, w, h, 0, 0, w, t, col, 0.9);
  fillRect(pixels, w, h, 0, h - t, w, t, col, 0.9);
  fillRect(pixels, w, h, 0, 0, t, h, col, 0.9);
  fillRect(pixels, w, h, w - t, 0, t, h, col, 0.9);

  const inner = t + 2;
  if (w - inner * 2 > 8 && h - inner * 2 > 8) {
    fillRect(pixels, w, h, inner, inner, w - inner * 2, 1, col, 0.35);
    fillRect(pixels, w, h, inner, h - inner - 1, w - inner * 2, 1, col, 0.35);
  }

  const len = Math.min(22, Math.floor(w * 0.1));
  drawLine(pixels, w, h, inner, inner, inner + len, inner, accent, 0.55, 1);
  drawLine(pixels, w, h, inner, inner, inner, inner + len, accent, 0.55, 1);
  drawLine(pixels, w, h, w - inner - len, inner, w - inner, inner, accent, 0.55, 1);
  drawLine(pixels, w, h, w - inner, inner, w - inner, inner + len, accent, 0.55, 1);
  drawLine(pixels, w, h, inner, h - inner, inner + len, h - inner, accent, 0.55, 1);
  drawLine(pixels, w, h, inner, h - inner - len, inner, h - inner, accent, 0.55, 1);
  drawLine(pixels, w, h, w - inner - len, h - inner, w - inner, h - inner, accent, 0.55, 1);
  drawLine(pixels, w, h, w - inner, h - inner - len, w - inner, h - inner, accent, 0.55, 1);

  return { width: w, height: h, pixels };
}

function boltsPixels(size: number, tone: number): PixelTexture {
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`visual:bolts:${tone}`);

  const count = rng.int(3, 6);
  for (let i = 0; i < count; i++) {
    const cx = rng.int(10, w - 11);
    const cy = rng.int(10, h - 11);
    drawCircle(pixels, w, h, cx, cy, rng.int(2, 3), rgb(VISUAL_PALETTE.metalLight), 0.7);
    drawCircle(pixels, w, h, cx, cy, rng.int(4, 5), rgb(VISUAL_PALETTE.bgDeep), 0.28);
  }

  return { width: w, height: h, pixels };
}

function rgb(hex: number): { r: number; g: number; b: number } {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp255(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function edgeFalloff(x: number, y: number, w: number, h: number): number {
  const nx = Math.abs((x + 0.5) / w - 0.5) / 0.5;
  const ny = Math.abs((y + 0.5) / h - 0.5) / 0.5;
  return clamp01(Math.sqrt(nx * nx + ny * ny));
}

function blend(dst: { r: number; g: number; b: number }, src: { r: number; g: number; b: number }, alpha: number) {
  const a = clamp01(alpha);
  return {
    r: clamp255(dst.r * (1 - a) + src.r * a),
    g: clamp255(dst.g * (1 - a) + src.g * a),
    b: clamp255(dst.b * (1 - a) + src.b * a),
  };
}

function blendPixel(pixels: Uint8ClampedArray, idx: number, src: { r: number; g: number; b: number }, alpha: number): void {
  const sa = clamp01(alpha);
  const da = clamp01(((pixels[idx + 3] ?? 0) as number) / 255);
  const oa = sa + da * (1 - sa);
  if (oa <= 1e-6) {
    pixels[idx + 3] = 0;
    return;
  }

  const r0 = pixels[idx + 0] ?? 0;
  const g0 = pixels[idx + 1] ?? 0;
  const b0 = pixels[idx + 2] ?? 0;

  const r = (src.r * sa + r0 * da * (1 - sa)) / oa;
  const g = (src.g * sa + g0 * da * (1 - sa)) / oa;
  const b = (src.b * sa + b0 * da * (1 - sa)) / oa;

  pixels[idx + 0] = clamp255(r);
  pixels[idx + 1] = clamp255(g);
  pixels[idx + 2] = clamp255(b);
  pixels[idx + 3] = clamp255(oa * 255);
}

function fillRect(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  rw: number,
  rh: number,
  color: { r: number; g: number; b: number },
  alpha: number
): void {
  const x1 = x0 + rw - 1;
  const y1 = y0 + rh - 1;
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      blendPixel(pixels, (y * w + x) * 4, color, alpha);
    }
  }
}

function drawCircle(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  color: { r: number; g: number; b: number },
  alpha: number
): void {
  const r2 = r * r;
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      blendPixel(pixels, (y * w + x) * 4, color, alpha);
    }
  }
}

function drawLine(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: { r: number; g: number; b: number },
  alpha: number,
  thickness: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    for (let oy = -thickness; oy <= thickness; oy++) {
      for (let ox = -thickness; ox <= thickness; ox++) {
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const falloff = 1 - Math.sqrt(ox * ox + oy * oy) / Math.max(1, thickness + 0.2);
        if (falloff <= 0) continue;
        blendPixel(pixels, (yy * w + xx) * 4, color, alpha * falloff);
      }
    }
  }
}
