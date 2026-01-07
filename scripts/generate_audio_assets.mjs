import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

if (!ffmpegPath) {
  throw new Error("ffmpeg-static: ffmpeg path not found");
}

const OUT_DIR = join(process.cwd(), "public", "assets", "audio");
const TMP_DIR = join(tmpdir(), "magnet-caravan-audio-tmp");

const SAMPLE_RATE = 44100;

await mkdir(OUT_DIR, { recursive: true });
await mkdir(TMP_DIR, { recursive: true });

await writeToneMp3(join(OUT_DIR, "pickup.mp3"), {
  durationSec: 0.12,
  ffmpegQ: 6,
  osc: [
    { type: "sine", freqHz: 880, gain: 0.9 },
    { type: "sine", freqHz: 1320, gain: 0.25 },
  ],
  env: { attackSec: 0.005, decaySec: 0.02, sustain: 0.3, releaseSec: 0.05 },
});

await writeToneMp3(join(OUT_DIR, "hit.mp3"), {
  durationSec: 0.16,
  ffmpegQ: 6,
  osc: [
    { type: "sine", freqHz: 170, gain: 0.9 },
    { type: "noise", freqHz: 0, gain: 0.15 },
  ],
  env: { attackSec: 0.001, decaySec: 0.03, sustain: 0.2, releaseSec: 0.08 },
});

await writeToneMp3(join(OUT_DIR, "flip.mp3"), {
  durationSec: 0.24,
  ffmpegQ: 6,
  osc: [
    { type: "sweep", freqHz: [260, 760], gain: 0.9 },
    { type: "noise", freqHz: 0, gain: 0.08 },
  ],
  env: { attackSec: 0.002, decaySec: 0.06, sustain: 0.15, releaseSec: 0.12 },
});

await writeToneMp3(join(OUT_DIR, "bank.mp3"), {
  durationSec: 0.42,
  ffmpegQ: 5,
  osc: [
    { type: "sine", freqHz: 523.25, gain: 0.45 },
    { type: "sine", freqHz: 659.25, gain: 0.38 },
    { type: "sine", freqHz: 783.99, gain: 0.32 },
  ],
  env: { attackSec: 0.01, decaySec: 0.08, sustain: 0.25, releaseSec: 0.25 },
});

await writeToneMp3(join(OUT_DIR, "ui_click.mp3"), {
  durationSec: 0.08,
  ffmpegQ: 6,
  osc: [{ type: "sine", freqHz: 1200, gain: 0.8 }],
  env: { attackSec: 0.001, decaySec: 0.015, sustain: 0.2, releaseSec: 0.03 },
});

await writeToneMp3(join(OUT_DIR, "upgrade_select.mp3"), {
  durationSec: 0.18,
  ffmpegQ: 6,
  osc: [
    { type: "sine", freqHz: 740, gain: 0.7 },
    { type: "sine", freqHz: 1108, gain: 0.22 },
  ],
  env: { attackSec: 0.003, decaySec: 0.03, sustain: 0.25, releaseSec: 0.08 },
});

await writeToneMp3(join(OUT_DIR, "music_loop.mp3"), {
  durationSec: 12.0,
  ffmpegQ: 4,
  osc: [
    { type: "sine", freqHz: 220, gain: 0.12 },
    { type: "sine", freqHz: 277.18, gain: 0.09 },
    { type: "sine", freqHz: 329.63, gain: 0.08 },
  ],
  env: { attackSec: 0.03, decaySec: 0.2, sustain: 0.85, releaseSec: 0.25 },
  lfo: { freqHz: 0.25, depth: 0.35 },
});

console.log(`Audio MP3 generated in ${OUT_DIR}`);

async function writeToneMp3(filePath, spec) {
  const wavPath = join(TMP_DIR, `${safeName(filePath)}.wav`);
  const samples = synth(spec);
  const wav = encodeWavMono16(samples, SAMPLE_RATE);
  await writeFile(wavPath, wav);
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    wavPath,
    "-codec:a",
    "libmp3lame",
    "-q:a",
    String(spec.ffmpegQ ?? 6),
    filePath,
  ]);
  await rm(wavPath, { force: true });
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

function encodeWavMono16(samplesInt16, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samplesInt16.length * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM
  buf.writeUInt16LE(1, 20); // format
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samplesInt16.length; i++) {
    buf.writeInt16LE(samplesInt16[i], 44 + i * 2);
  }

  return buf;
}

function synth(spec) {
  const frames = Math.max(1, Math.floor(spec.durationSec * SAMPLE_RATE));
  const out = new Int16Array(frames);
  const env = spec.env ?? { attackSec: 0.005, decaySec: 0.02, sustain: 0.4, releaseSec: 0.05 };
  const osc = spec.osc ?? [{ type: "sine", freqHz: 440, gain: 0.8 }];

  const lfo = spec.lfo ? { freqHz: spec.lfo.freqHz ?? 0.25, depth: spec.lfo.depth ?? 0.2 } : null;

  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    const amp = envelope(t, spec.durationSec, env);
    const mod = lfo ? 1 + Math.sin(t * Math.PI * 2 * lfo.freqHz) * lfo.depth : 1;

    let v = 0;
    for (const o of osc) v += oscillator(o, t) * (o.gain ?? 1);

    v = softClip(v * amp * mod);
    out[i] = floatToInt16(v);
  }

  return out;
}

function oscillator(o, t) {
  const type = o.type ?? "sine";
  if (type === "noise") return (hashNoise(t) * 2 - 1) * 0.9;
  if (type === "sweep") {
    const f0 = Array.isArray(o.freqHz) ? o.freqHz[0] : 220;
    const f1 = Array.isArray(o.freqHz) ? o.freqHz[1] : 880;
    const k = clamp(t / (o.sweepSec ?? 0.24), 0, 1);
    const f = f0 + (f1 - f0) * k;
    return Math.sin(t * Math.PI * 2 * f);
  }
  const f = Array.isArray(o.freqHz) ? o.freqHz[0] : o.freqHz;
  return Math.sin(t * Math.PI * 2 * f);
}

function envelope(t, total, env) {
  const a = env.attackSec ?? 0.005;
  const d = env.decaySec ?? 0.02;
  const s = env.sustain ?? 0.4;
  const r = env.releaseSec ?? 0.05;
  const sustainStart = a + d;
  const releaseStart = Math.max(sustainStart, total - r);

  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < sustainStart) {
    const k = (t - a) / Math.max(1e-6, d);
    return 1 - (1 - s) * k;
  }
  if (t < releaseStart) return s;
  if (t < total) {
    const k = (t - releaseStart) / Math.max(1e-6, r);
    return s * (1 - k);
  }
  return 0;
}

function softClip(x) {
  const a = 0.95;
  if (x > a) return a + (x - a) / (1 + (x - a) * (x - a));
  if (x < -a) return -a + (x + a) / (1 + (x + a) * (x + a));
  return x;
}

function floatToInt16(v) {
  const x = clamp(v, -1, 1);
  return Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hashNoise(t) {
  const x = Math.sin(t * 12_989.123) * 43758.5453;
  return x - Math.floor(x);
}

function safeName(filePath) {
  return filePath.replaceAll(/[^\w.-]+/g, "_");
}

