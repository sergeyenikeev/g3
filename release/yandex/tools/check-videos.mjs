// Проверяет видео в release/yandex/videos по требованиям Яндекс Игр.
// Запуск: node release/yandex/tools/check-videos.mjs

import { spawnSync } from "node:child_process";
import { statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ffmpegPath, repoRoot, videosDir } from "./paths.mjs";

const FFMPEG = ffmpegPath();

const BASE_TARGETS = [
  { file: "gameplay-horizontal-16x9.mp4", aspect: 16 / 9, maxDurationSec: 28, minDurationSec: 5, minHeight: 400, role: "gameplay" },
  { file: "gameplay-vertical-9x16.mp4", aspect: 9 / 16, maxDurationSec: 28, minDurationSec: 5, minHeight: 400, role: "gameplay" },
  { file: "promo-horizontal-16x9.mp4", aspect: 16 / 9, maxDurationSec: 20, minDurationSec: 10, minHeight: 400, role: "promo" },
  { file: "promo-vertical-9x16.mp4", aspect: 9 / 16, maxDurationSec: 20, minDurationSec: 10, minHeight: 400, role: "promo" },
];
const TARGETS = [
  ...BASE_TARGETS.map((t) => ({ ...t, locale: "ru", subdir: "" })),
  ...BASE_TARGETS.map((t) => ({ ...t, locale: "en", subdir: "en" })),
];

const MAX_BYTES = 100 * 1024 * 1024;

function probe(absPath) {
  const res = spawnSync(FFMPEG, ["-hide_banner", "-i", absPath], { stdio: ["ignore", "pipe", "pipe"] });
  const text = `${res.stdout?.toString("utf8") ?? ""}${res.stderr?.toString("utf8") ?? ""}`;
  const lines = text.split(/\r?\n/);
  const videoLine = lines.find((l) => l.includes("Stream #0") && l.toLowerCase().includes("video:"));
  const audioLine = lines.find((l) => l.includes("Stream #0") && l.toLowerCase().includes("audio:"));
  const durMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const duration = durMatch ? Number(durMatch[1]) * 3600 + Number(durMatch[2]) * 60 + Number(durMatch[3]) : null;
  let width = null;
  let height = null;
  let codec = null;
  if (videoLine) {
    const res2 = videoLine.match(/(\d{2,5})x(\d{2,5})/);
    if (res2) {
      width = Number(res2[1]);
      height = Number(res2[2]);
    }
    const codecMatch = videoLine.match(/Video:\s*([a-zA-Z0-9_]+)/);
    if (codecMatch) codec = codecMatch[1];
  }
  return {
    duration,
    width,
    height,
    codec,
    hasVideo: Boolean(videoLine),
    hasAudio: Boolean(audioLine),
  };
}

const rows = [];
const issues = [];

for (const t of TARGETS) {
  const relPath = t.subdir ? `${t.subdir}/${t.file}` : t.file;
  const abs = join(videosDir, t.subdir, t.file);
  let size = 0;
  try {
    size = statSync(abs).size;
  } catch {
    rows.push({ file: relPath, status: "FAIL", note: "file missing" });
    issues.push(`${relPath}: missing`);
    continue;
  }
  const info = probe(abs);
  const aspect = info.width && info.height ? info.width / info.height : null;
  const aspectOk = aspect !== null && Math.abs(aspect - t.aspect) <= 0.02;
  const durationOk =
    info.duration !== null && info.duration <= t.maxDurationSec && info.duration >= t.minDurationSec;
  const heightOk = info.height !== null && info.height >= t.minHeight;
  const codecOk = String(info.codec).toLowerCase() === "h264";
  const sizeOk = size <= MAX_BYTES;
  const ok = info.hasVideo && aspectOk && durationOk && heightOk && codecOk && sizeOk;
  const note = `[${t.locale}] ${info.width}x${info.height} ${info.codec} dur=${info.duration?.toFixed(2)}s size=${(size / 1024 / 1024).toFixed(2)} MB audio=${info.hasAudio}`;
  rows.push({ file: relPath, status: ok ? "OK" : "FAIL", note });
  if (!ok) {
    issues.push(
      `${relPath}: aspectOk=${aspectOk} durationOk=${durationOk} heightOk=${heightOk} codecOk=${codecOk} sizeOk=${sizeOk} hasVideo=${info.hasVideo}`,
    );
  }
}

const lines = [];
lines.push("# video-check-report.md");
lines.push("");
lines.push(`Сгенерировано: ${new Date().toISOString()}`);
lines.push("");
lines.push("| Файл | Статус | Параметры |");
lines.push("|------|--------|-----------|");
for (const r of rows) {
  lines.push(`| \`${r.file}\` | ${r.status} | ${r.note} |`);
}
lines.push("");
if (issues.length === 0) {
  lines.push("Проблем не найдено.");
} else {
  lines.push("## Проблемы");
  for (const it of issues) lines.push(`- ${it}`);
}

const outPath = join(videosDir, "video-check-report.md");
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`[check-videos] report -> ${relative(repoRoot, outPath)}`);
console.log(`[check-videos] issues: ${issues.length}`);
process.exit(issues.length === 0 ? 0 : 1);
