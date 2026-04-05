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

await writeMusicLoopMp3(join(OUT_DIR, "music_battle_loop.mp3"), "battle");
await writeMusicLoopMp3(join(OUT_DIR, "music_menu_loop.mp3"), "menu");
await writeMusicLoopMp3(join(OUT_DIR, "music_loop.mp3"), "battle");

console.log(`Audio MP3 generated in ${OUT_DIR}`);

async function writeToneMp3(filePath, spec) {
  const samples = synth(spec);
  await writeSamplesMp3(filePath, samples, spec.ffmpegQ ?? 6);
}

async function writeMusicLoopMp3(filePath, kind) {
  const samples = kind === "menu" ? composeMenuLoop() : composeBattleLoop();
  await writeSamplesMp3(filePath, samples, 4);
}

async function writeSamplesMp3(filePath, samples, ffmpegQ) {
  const wavPath = join(TMP_DIR, `${safeName(filePath)}.wav`);
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
    String(ffmpegQ),
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

function composeBattleLoop() {
  const bpm = 118;
  const beatSec = 60 / bpm;
  const bars = 4;
  const beatsPerBar = 4;
  const durationSec = beatSec * beatsPerBar * bars;
  const frames = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
  const out = new Float32Array(frames);

  const chords = [
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 261.63],
    [130.81, 164.81, 196.0],
    [196.0, 246.94, 293.66],
  ];

  const bassPattern = [0, 1.5, 2.0, 3.25];
  const melodyBars = [
    [
      { beat: 0.5, note: 440.0, length: 0.5 },
      { beat: 1.25, note: 523.25, length: 0.5 },
      { beat: 2.0, note: 659.25, length: 0.5 },
      { beat: 2.75, note: 783.99, length: 0.5 },
      { beat: 3.5, note: 659.25, length: 0.75 },
    ],
    [
      { beat: 0.25, note: 440.0, length: 0.5 },
      { beat: 1.0, note: 523.25, length: 0.5 },
      { beat: 1.75, note: 698.46, length: 0.75 },
      { beat: 3.0, note: 659.25, length: 0.75 },
    ],
    [
      { beat: 0.5, note: 392.0, length: 0.5 },
      { beat: 1.25, note: 523.25, length: 0.5 },
      { beat: 2.0, note: 659.25, length: 0.5 },
      { beat: 2.75, note: 587.33, length: 0.75 },
    ],
    [
      { beat: 0.25, note: 392.0, length: 0.5 },
      { beat: 1.0, note: 493.88, length: 0.5 },
      { beat: 1.75, note: 587.33, length: 0.5 },
      { beat: 2.5, note: 659.25, length: 0.5 },
      { beat: 3.25, note: 587.33, length: 0.75 },
    ],
  ];

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * beatsPerBar * beatSec;
    const chord = chords[bar] ?? chords[0];
    if (!chord) continue;

    for (const note of chord) {
      mixNote(out, {
        startSec: barStart,
        durationSec: beatsPerBar * beatSec + 0.06,
        freqHz: note,
        gain: 0.055,
        wave: "triangle",
        env: { attackSec: 0.04, decaySec: 0.16, sustain: 0.82, releaseSec: 0.12 },
        vibratoHz: 4.3,
        vibratoDepth: 0.0025,
      });
      mixNote(out, {
        startSec: barStart,
        durationSec: beatsPerBar * beatSec + 0.04,
        freqHz: note * 2,
        gain: 0.012,
        wave: "sine",
        env: { attackSec: 0.02, decaySec: 0.18, sustain: 0.74, releaseSec: 0.08 },
      });
    }

    for (const beat of bassPattern) {
      mixNote(out, {
        startSec: barStart + beat * beatSec,
        durationSec: beatSec * 0.42,
        freqHz: chord[0] / 2,
        gain: 0.13,
        wave: "square",
        env: { attackSec: 0.004, decaySec: 0.08, sustain: 0.52, releaseSec: 0.09 },
      });
      mixNote(out, {
        startSec: barStart + beat * beatSec,
        durationSec: beatSec * 0.42,
        freqHz: chord[0] / 2,
        gain: 0.05,
        wave: "triangle",
        env: { attackSec: 0.004, decaySec: 0.06, sustain: 0.45, releaseSec: 0.08 },
      });
    }

    for (const phrase of melodyBars[bar] ?? []) {
      mixNote(out, {
        startSec: barStart + phrase.beat * beatSec,
        durationSec: phrase.length * beatSec,
        freqHz: phrase.note,
        gain: 0.095,
        wave: "square",
        env: { attackSec: 0.01, decaySec: 0.05, sustain: 0.38, releaseSec: 0.08 },
        vibratoHz: 5.2,
        vibratoDepth: 0.003,
      });
      mixNote(out, {
        startSec: barStart + phrase.beat * beatSec,
        durationSec: phrase.length * beatSec,
        freqHz: phrase.note * 2,
        gain: 0.018,
        wave: "triangle",
        env: { attackSec: 0.008, decaySec: 0.04, sustain: 0.32, releaseSec: 0.06 },
      });
    }

    for (let beat = 0; beat < beatsPerBar; beat++) {
      const start = barStart + beat * beatSec;
      if (beat === 0 || beat === 2) mixKick(out, start, 0.9);
      if (beat === 3) mixKick(out, start + beatSec * 0.5, 0.52);
      if (beat === 1 || beat === 3) mixSnare(out, start, 0.5);
      mixHat(out, start + beatSec * 0.5, 0.18);
      mixHat(out, start + beatSec * 0.75, 0.09);
    }
  }

  applyDelay(out, Math.floor(beatSec * SAMPLE_RATE * 0.75), 0.2);
  applyShortCrossfade(out, Math.floor(SAMPLE_RATE * 0.02));

  const rendered = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) rendered[i] = floatToInt16(softClip(out[i] * 0.82));
  return rendered;
}

function composeMenuLoop() {
  const bpm = 92;
  const beatSec = 60 / bpm;
  const bars = 4;
  const beatsPerBar = 4;
  const durationSec = beatSec * beatsPerBar * bars;
  const frames = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));
  const out = new Float32Array(frames);

  const chords = [
    [196.0, 246.94, 329.63],
    [220.0, 261.63, 329.63],
    [174.61, 220.0, 293.66],
    [196.0, 246.94, 329.63],
  ];

  const arpPattern = [0, 0.5, 1, 1.5, 2.25, 2.75, 3.25, 3.75];
  const bellBars = [
    [
      { beat: 0.25, note: 392.0, len: 0.75 },
      { beat: 1.5, note: 493.88, len: 0.75 },
      { beat: 2.75, note: 587.33, len: 1.0 },
    ],
    [
      { beat: 0.5, note: 440.0, len: 0.75 },
      { beat: 1.75, note: 523.25, len: 0.75 },
      { beat: 3.0, note: 659.25, len: 0.75 },
    ],
    [
      { beat: 0.25, note: 349.23, len: 0.75 },
      { beat: 1.5, note: 440.0, len: 0.75 },
      { beat: 2.75, note: 523.25, len: 1.0 },
    ],
    [
      { beat: 0.5, note: 392.0, len: 0.75 },
      { beat: 1.75, note: 493.88, len: 0.75 },
      { beat: 3.0, note: 659.25, len: 1.0 },
    ],
  ];

  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * beatsPerBar * beatSec;
    const chord = chords[bar] ?? chords[0];
    if (!chord) continue;

    for (const note of chord) {
      mixNote(out, {
        startSec: barStart,
        durationSec: beatsPerBar * beatSec + 0.08,
        freqHz: note / 2,
        gain: 0.048,
        wave: "triangle",
        env: { attackSec: 0.04, decaySec: 0.2, sustain: 0.82, releaseSec: 0.18 },
        vibratoHz: 3.6,
        vibratoDepth: 0.0022,
      });
      mixNote(out, {
        startSec: barStart,
        durationSec: beatsPerBar * beatSec + 0.08,
        freqHz: note,
        gain: 0.026,
        wave: "sine",
        env: { attackSec: 0.05, decaySec: 0.2, sustain: 0.8, releaseSec: 0.16 },
      });
    }

    for (let i = 0; i < arpPattern.length; i++) {
      const note = chord[i % chord.length];
      mixNote(out, {
        startSec: barStart + arpPattern[i] * beatSec,
        durationSec: beatSec * 0.42,
        freqHz: note * (i % 2 === 0 ? 1 : 2),
        gain: 0.052,
        wave: "triangle",
        env: { attackSec: 0.01, decaySec: 0.08, sustain: 0.34, releaseSec: 0.1 },
      });
    }

    for (const bell of bellBars[bar] ?? []) {
      mixNote(out, {
        startSec: barStart + bell.beat * beatSec,
        durationSec: bell.len * beatSec,
        freqHz: bell.note,
        gain: 0.058,
        wave: "sine",
        env: { attackSec: 0.008, decaySec: 0.1, sustain: 0.24, releaseSec: 0.22 },
        vibratoHz: 5.5,
        vibratoDepth: 0.0025,
      });
      mixNote(out, {
        startSec: barStart + bell.beat * beatSec,
        durationSec: bell.len * beatSec,
        freqHz: bell.note * 2,
        gain: 0.015,
        wave: "triangle",
        env: { attackSec: 0.01, decaySec: 0.08, sustain: 0.18, releaseSec: 0.18 },
      });
    }

    mixKick(out, barStart, 0.42);
    mixKick(out, barStart + beatSec * 2, 0.34);
    mixHat(out, barStart + beatSec * 1.5, 0.06);
    mixHat(out, barStart + beatSec * 3.5, 0.05);
  }

  applyDelay(out, Math.floor(beatSec * SAMPLE_RATE * 0.75), 0.26);
  applyShortCrossfade(out, Math.floor(SAMPLE_RATE * 0.04));

  const rendered = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) rendered[i] = floatToInt16(softClip(out[i] * 0.76));
  return rendered;
}

function mixNote(out, spec) {
  const startFrame = Math.max(0, Math.floor(spec.startSec * SAMPLE_RATE));
  const frames = Math.max(1, Math.floor(spec.durationSec * SAMPLE_RATE));
  let phase = 0;
  const freqBase = spec.freqHz;
  const env = spec.env ?? { attackSec: 0.005, decaySec: 0.04, sustain: 0.5, releaseSec: 0.06 };

  for (let i = 0; i < frames; i++) {
    const frame = startFrame + i;
    if (frame >= out.length) break;

    const t = i / SAMPLE_RATE;
    const amp = envelope(t, spec.durationSec, env);
    const vib =
      spec.vibratoHz && spec.vibratoDepth
        ? 1 + Math.sin(t * Math.PI * 2 * spec.vibratoHz) * spec.vibratoDepth
        : 1;
    const freq = freqBase * vib;
    phase += freq / SAMPLE_RATE;
    out[frame] += waveSample(spec.wave ?? "sine", phase) * spec.gain * amp;
  }
}

function mixKick(out, startSec, gain) {
  const startFrame = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const frames = Math.max(1, Math.floor(0.2 * SAMPLE_RATE));
  let phase = 0;

  for (let i = 0; i < frames; i++) {
    const frame = startFrame + i;
    if (frame >= out.length) break;

    const t = i / SAMPLE_RATE;
    const k = i / Math.max(1, frames - 1);
    const freq = 126 - 82 * Math.pow(k, 0.58);
    phase += freq / SAMPLE_RATE;
    const body = Math.sin(phase * Math.PI * 2);
    const snap = Math.sin(phase * Math.PI * 4) * Math.exp(-t * 28) * 0.24;
    const amp = Math.exp(-t * 13);
    out[frame] += (body + snap) * gain * amp * 0.52;
  }
}

function mixSnare(out, startSec, gain) {
  const startFrame = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const frames = Math.max(1, Math.floor(0.16 * SAMPLE_RATE));
  let phase = 0;

  for (let i = 0; i < frames; i++) {
    const frame = startFrame + i;
    if (frame >= out.length) break;

    const t = i / SAMPLE_RATE;
    phase += 180 / SAMPLE_RATE;
    const tone = waveSample("triangle", phase) * Math.exp(-t * 18) * 0.18;
    const noise = (hashNoise(frame * 0.00023) * 2 - 1) * Math.exp(-t * 24);
    out[frame] += (noise * 0.32 + tone) * gain;
  }
}

function mixHat(out, startSec, gain) {
  const startFrame = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const frames = Math.max(1, Math.floor(0.05 * SAMPLE_RATE));

  for (let i = 0; i < frames; i++) {
    const frame = startFrame + i;
    if (frame >= out.length) break;

    const t = i / SAMPLE_RATE;
    const noise = hashNoise(frame * 0.00071) * 2 - 1;
    out[frame] += noise * Math.exp(-t * 68) * gain * 0.22;
  }
}

function applyDelay(out, delayFrames, feedback) {
  if (delayFrames <= 0) return;
  for (let i = delayFrames; i < out.length; i++) {
    out[i] += out[i - delayFrames] * feedback;
  }
}

function applyShortCrossfade(out, fadeFrames) {
  const frames = Math.max(1, Math.min(fadeFrames, Math.floor(out.length / 4)));
  for (let i = 0; i < frames; i++) {
    const k = i / frames;
    const head = out[i];
    const tailIndex = out.length - frames + i;
    const tail = out[tailIndex];
    out[i] = head * (1 - k) + tail * k;
    out[tailIndex] = tail * (1 - k) + head * k;
  }
}

function waveSample(type, phase) {
  const p = phase - Math.floor(phase);
  if (type === "triangle") return 1 - 4 * Math.abs(p - 0.5);
  if (type === "square") return p < 0.5 ? 1 : -1;
  if (type === "saw") return p * 2 - 1;
  return Math.sin(p * Math.PI * 2);
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
