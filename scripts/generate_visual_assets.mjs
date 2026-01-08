import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

function pickArgValue(name) {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(name);
  if (idx < 0) return null;
  return argv[idx + 1] ?? null;
}

function writePng(filePath, img) {
  return writeFile(filePath, encodePngRGBA(img.width, img.height, img.pixels));
}

function encodePngRGBA(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + stride);
    raw[rowOff] = 0; // filter 0
    const srcOff = y * stride;
    for (let i = 0; i < stride; i++) raw[rowOff + 1 + i] = rgba[srcOff + i];
  }

  const idat = deflateSync(raw, { level: 9 });

  const chunks = [
    pngChunk("IHDR", ihdrData(width, height)),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ];

  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
}

function ihdrData(width, height) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(width >>> 0, 0);
  b.writeUInt32BE(height >>> 0, 4);
  b[8] = 8; // bit depth
  b[9] = 6; // color type RGBA
  b[10] = 0; // compression
  b[11] = 0; // filter
  b[12] = 0; // interlace
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length >>> 0, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0, 0);
  return Buffer.concat([len, t, data, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PALETTE = {
  bgDeep: 0x0b0f14,
  bgMid: 0x121a24,
  rustDark: 0x3a2a1e,
  rustMid: 0x6b3f2b,
  metalGray: 0x6e7a86,
  metalLight: 0xa7b2be,
  successGreen: 0x3dff9b,
  neonBlue: 0x2d7bff,
  neonMagenta: 0xff3ad7,
  warningAmber: 0xffb02e,
};

function rgb(hex) {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clamp255(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRgb(a, b, t) {
  return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) };
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function createRng(seedStr) {
  const seedNum = xmur3(String(seedStr))();
  return mulberry32(seedNum);
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blendOver(dst, src, alpha) {
  const a = clamp01(alpha);
  return {
    r: clamp255(dst.r * (1 - a) + src.r * a),
    g: clamp255(dst.g * (1 - a) + src.g * a),
    b: clamp255(dst.b * (1 - a) + src.b * a),
  };
}

function bgTile256(seedStr) {
  const w = 256;
  const h = 256;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`bgTile:${seedStr}`);
  const cTop = rgb(PALETTE.bgDeep);
  const cBot = rgb(PALETTE.bgMid);

  const blobs = Array.from({ length: 7 }, () => ({
    x: Math.floor(rng() * w),
    y: Math.floor(rng() * h),
    r: Math.floor(26 + rng() * 48),
    tone: rng(),
    alpha: 0.08 + rng() * 0.16,
  }));

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const base = lerpRgb(cTop, cBot, smoothstep(0.05, 0.95, t));
    for (let x = 0; x < w; x++) {
      let r = base.r;
      let g = base.g;
      let b = base.b;
      const grain = (rng() * 2 - 1) * 14;
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
        const rust = lerpRgb(rgb(PALETTE.rustDark), rgb(PALETTE.rustMid), bl.tone);
        ({ r, g, b } = blendOver({ r, g, b }, rust, a));
      }

      const idx = (y * w + x) * 4;
      pixels[idx + 0] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  return { width: w, height: h, pixels };
}

function bgFarSilhouette(seedStr) {
  const w = 1024;
  const h = 512;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`bgFar:${seedStr}`);

  const top = rgb(0x06080c);
  const bot = rgb(PALETTE.bgDeep);

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
  const sil = rgb(0x0f141c);

  const hillCount = 18;
  for (let i = 0; i < hillCount; i++) {
    const cx = Math.floor(-80 + rng() * (w + 160));
    const cy = Math.floor(groundY - 30 + rng() * 70);
    const rr = Math.floor(80 + rng() * 160);
    const a = 0.2 + rng() * 0.25;
    drawCircleAlpha(pixels, w, h, cx, cy, rr, sil, a);
  }

  const craneCount = 6;
  for (let i = 0; i < craneCount; i++) {
    const baseX = Math.floor(40 + rng() * (w - 80));
    const baseY = groundY - Math.floor(60 + rng() * 80);
    const height = Math.floor(120 + rng() * 120);
    const mastW = Math.floor(14 + rng() * 8);
    const arm = Math.floor((160 + rng() * 200) * (rng() < 0.5 ? -1 : 1));
    const a = 0.22 + rng() * 0.22;
    fillRectAlpha(pixels, w, h, baseX - Math.floor(mastW / 2), baseY - height, mastW, height + Math.floor(10 + rng() * 30), sil, a);
    drawLineAlpha(pixels, w, h, baseX, baseY - height, baseX + arm, baseY - height + Math.floor(-22 + rng() * 40), sil, a, 3);
  }

  return { width: w, height: h, pixels };
}

function vignette512() {
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

function lightGradient512() {
  const w = 512;
  const h = 512;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cold = rgb(PALETTE.neonBlue);
  const warm = rgb(PALETTE.warningAmber);

  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const c = lerpRgb(cold, warm, smoothstep(0.0, 1.0, t));
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const dx = (u - 0.5) / 0.75;
      const dy = (v - 0.28) / 0.65;
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

function vfxRing256() {
  const size = 256;
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r0 = size * 0.42;
  const r1 = size * 0.49;
  const blur = Math.max(1, size * 0.02);

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

function vfxGlow128() {
  const size = 128;
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
      const a = clamp01(g * 0.82);
      const idx = (y * w + x) * 4;
      pixels[idx + 0] = 255;
      pixels[idx + 1] = 255;
      pixels[idx + 2] = 255;
      pixels[idx + 3] = Math.floor(255 * a);
    }
  }

  return { width: w, height: h, pixels };
}

function vfxSpark32() {
  const size = 32;
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

function vfxSmoke64(seedStr) {
  const size = 64;
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rng = createRng(`vfxSmoke:${seedStr}`);
  const sigma = size * 0.22;
  const inv2 = 1 / (2 * sigma * sigma);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const g = Math.exp(-(dx * dx + dy * dy) * inv2);
      const n = (rng() * 2 - 1) * 0.18;
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

function vfxTrail64x16() {
  const w = 64;
  const h = 16;
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

function vfxHitFlash64() {
  const size = 64;
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

function vfxLine1x64() {
  const w = 1;
  const h = 64;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const a = clamp01(1 - Math.abs(t - 0.5) / 0.5);
    const idx = y * 4;
    pixels[idx + 0] = 255;
    pixels[idx + 1] = 255;
    pixels[idx + 2] = 255;
    pixels[idx + 3] = Math.floor(255 * a);
  }
  return { width: w, height: h, pixels };
}

function decalOil64(seedStr) {
  const size = 64;
  const w = size;
  const h = size;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rng = createRng(`oil:${seedStr}`);
  const r0 = size * (0.26 + rng() * 0.18);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      const wobble = (rng() * 2 - 1) * (size * 0.035);
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

function decalScratch64(seedStr) {
  const w = 64;
  const h = 64;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`scratch:${seedStr}`);
  const col = rgb(PALETTE.metalGray);
  const n = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const x0 = Math.floor(-8 + rng() * (w + 16));
    const y0 = Math.floor(-8 + rng() * (h + 16));
    const x1 = x0 + Math.floor(-50 + rng() * 100);
    const y1 = y0 + Math.floor(-50 + rng() * 100);
    const a = 0.18 + rng() * 0.14;
    drawLineAlpha(pixels, w, h, x0, y0, x1, y1, col, a, 1 + Math.floor(rng() * 2));
  }
  return { width: w, height: h, pixels };
}

function decalBolts64(seedStr) {
  const w = 64;
  const h = 64;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const rng = createRng(`bolts:${seedStr}`);
  const light = rgb(PALETTE.metalLight);
  const dark = rgb(PALETTE.bgDeep);
  const count = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < count; i++) {
    const cx = 10 + Math.floor(rng() * (w - 20));
    const cy = 10 + Math.floor(rng() * (h - 20));
    drawCircleAlpha(pixels, w, h, cx, cy, 2 + Math.floor(rng() * 2), light, 0.7);
    drawCircleAlpha(pixels, w, h, cx, cy, 4 + Math.floor(rng() * 2), dark, 0.28);
  }
  return { width: w, height: h, pixels };
}

function rarityFrame256x128(colorHex) {
  const w = 256;
  const h = 128;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const col = rgb(colorHex);
  const accent = rgb(PALETTE.metalLight);
  const t = Math.max(3, Math.round(Math.min(w, h) * 0.03));

  fillRectAlpha(pixels, w, h, 0, 0, w, t, col, 0.9);
  fillRectAlpha(pixels, w, h, 0, h - t, w, t, col, 0.9);
  fillRectAlpha(pixels, w, h, 0, 0, t, h, col, 0.9);
  fillRectAlpha(pixels, w, h, w - t, 0, t, h, col, 0.9);

  const inner = t + 2;
  if (w - inner * 2 > 8 && h - inner * 2 > 8) {
    fillRectAlpha(pixels, w, h, inner, inner, w - inner * 2, 1, col, 0.35);
    fillRectAlpha(pixels, w, h, inner, h - inner - 1, w - inner * 2, 1, col, 0.35);
  }

  const len = Math.min(22, Math.floor(w * 0.1));
  drawLineAlpha(pixels, w, h, inner, inner, inner + len, inner, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, inner, inner, inner, inner + len, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, w - inner - len, inner, w - inner, inner, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, w - inner, inner, w - inner, inner + len, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, inner, h - inner, inner + len, h - inner, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, inner, h - inner - len, inner, h - inner, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, w - inner - len, h - inner, w - inner, h - inner, accent, 0.55, 1);
  drawLineAlpha(pixels, w, h, w - inner, h - inner - len, w - inner, h - inner, accent, 0.55, 1);

  return { width: w, height: h, pixels };
}

function fillRectAlpha(pixels, w, h, x0, y0, rw, rh, col, alpha) {
  const x1 = x0 + rw - 1;
  const y1 = y0 + rh - 1;
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) blendPixelAlpha(pixels, (y * w + x) * 4, col, alpha);
  }
}

function drawCircleAlpha(pixels, w, h, cx, cy, r, col, alpha) {
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
      blendPixelAlpha(pixels, (y * w + x) * 4, col, alpha);
    }
  }
}

function drawLineAlpha(pixels, w, h, x0, y0, x1, y1, col, alpha, thickness) {
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
        blendPixelAlpha(pixels, (yy * w + xx) * 4, col, alpha * falloff);
      }
    }
  }
}

function blendPixelAlpha(pixels, idx, src, alpha) {
  const sa = clamp01(alpha);
  const da = clamp01((pixels[idx + 3] ?? 0) / 255);
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

await main();

async function main() {
  const seedArg = pickArgValue("--seed") ?? "visual-v1";
  const outDir = resolve(pickArgValue("--outDir") ?? join(process.cwd(), "public", "assets", "generated"));

  await mkdir(outDir, { recursive: true });

  const seed = String(seedArg);

  await writePng(join(outDir, "bg_tile_256.png"), bgTile256(seed));
  await writePng(join(outDir, "bg_far_silhouette.png"), bgFarSilhouette(seed));
  await writePng(join(outDir, "vignette.png"), vignette512());
  await writePng(join(outDir, "lightGradient.png"), lightGradient512());

  for (let i = 1; i <= 4; i++) await writePng(join(outDir, `decal_oil_0${i}.png`), decalOil64(`${seed}:oil:${i}`));
  for (let i = 1; i <= 4; i++) await writePng(join(outDir, `decal_scratch_0${i}.png`), decalScratch64(`${seed}:scratch:${i}`));
  for (let i = 1; i <= 4; i++) await writePng(join(outDir, `decal_bolts_0${i}.png`), decalBolts64(`${seed}:bolts:${i}`));

  await writePng(join(outDir, "vfx_ring.png"), vfxRing256());
  await writePng(join(outDir, "vfx_glow_blob.png"), vfxGlow128());
  await writePng(join(outDir, "vfx_spark.png"), vfxSpark32());
  await writePng(join(outDir, "vfx_smoke_puff.png"), vfxSmoke64("smoke"));
  await writePng(join(outDir, "vfx_trail.png"), vfxTrail64x16());
  await writePng(join(outDir, "vfx_hit_flash.png"), vfxHitFlash64());
  await writePng(join(outDir, "vfx_line.png"), vfxLine1x64());
  await writePng(join(outDir, "rarity_frame_common.png"), rarityFrame256x128(PALETTE.metalGray));
  await writePng(join(outDir, "rarity_frame_uncommon.png"), rarityFrame256x128(PALETTE.successGreen));
  await writePng(join(outDir, "rarity_frame_rare.png"), rarityFrame256x128(PALETTE.neonBlue));
  await writePng(join(outDir, "rarity_frame_epic.png"), rarityFrame256x128(PALETTE.neonMagenta));

  console.log(`visual assets generated in ${outDir}`);
}
