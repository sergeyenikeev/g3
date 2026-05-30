// Проверяет картинки в release/yandex/images по требованиям Яндекс Игр.
// Запуск: node release/yandex/tools/check-images.mjs

import { execFileSync } from "node:child_process";
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checklistsDir, ffmpegPath, imagesDir, repoRoot, screenshotsDir } from "./paths.mjs";

const FFMPEG = ffmpegPath();

const REQUIRED = [
  { rel: "icon-512.png", expect: { width: 512, height: 512, format: "png" }, kind: "icon" },
  { rel: "cover-800x470.png", expect: { width: 800, height: 470, format: "png" }, kind: "cover" },
];

const OPTIONAL = [
  { rel: "icon-512-alt-01.png", expect: { width: 512, height: 512, format: "png" }, kind: "icon-alt" },
  { rel: "cover-800x470-alt-01.png", expect: { width: 800, height: 470, format: "png" }, kind: "cover-alt" },
  { rel: "hero-1560x520.png", expect: { width: 1560, height: 520, format: "png" }, kind: "hero" },
  { rel: "en/icon-512.png", expect: { width: 512, height: 512, format: "png" }, kind: "icon-en" },
  { rel: "en/cover-800x470.png", expect: { width: 800, height: 470, format: "png" }, kind: "cover-en" },
];

const SCREENSHOT_RULES = {
  minLong: 1280,
  maxLong: 2560,
  formats: new Set(["png", "mjpeg", "jpeg"]),
  aspect: 16 / 9,
  aspectTolerance: 0.02,
};

const issues = [];
const rows = [];

function probe(absPath) {
  const out = execFileSync(FFMPEG, ["-hide_banner", "-i", absPath], { stdio: ["ignore", "pipe", "pipe"] });
  const stderr = out.toString("utf8");
  return parseFfmpegOutput(stderr);
}

function parseFfmpegOutput(stderr) {
  // ffmpeg always prints to stderr; with -i and no output we just look for first Video stream.
  // But execFileSync throws on non-zero exit. We instead use spawnSync below.
  return parseStream(stderr);
}

function parseStream(text) {
  const line = text.split(/\r?\n/).find((l) => l.includes("Stream #0") && l.toLowerCase().includes("video"));
  if (!line) return null;
  const codec = (line.match(/Video:\s*([a-zA-Z0-9_]+)/) ?? [])[1] ?? null;
  const resMatch = line.match(/(\d{2,5})x(\d{2,5})/);
  return {
    codec,
    width: resMatch ? Number(resMatch[1]) : null,
    height: resMatch ? Number(resMatch[2]) : null,
    raw: line.trim(),
  };
}

import { spawnSync } from "node:child_process";

function probeSafe(absPath) {
  const res = spawnSync(FFMPEG, ["-hide_banner", "-i", absPath], { stdio: ["ignore", "pipe", "pipe"] });
  const text = `${res.stdout?.toString("utf8") ?? ""}${res.stderr?.toString("utf8") ?? ""}`;
  return parseStream(text);
}

function checkSingle(rel, expect, kind, required) {
  const abs = join(imagesDir, rel);
  let size = 0;
  try {
    size = statSync(abs).size;
  } catch {
    const issue = `${kind}: file not found: ${rel}`;
    rows.push({ rel, status: required ? "FAIL" : "skip", note: "missing" });
    if (required) issues.push(issue);
    return;
  }
  const info = probeSafe(abs);
  if (!info) {
    const issue = `${kind}: cannot probe ${rel}`;
    rows.push({ rel, status: "FAIL", note: "no probe" });
    issues.push(issue);
    return;
  }
  const okFormat = String(info.codec).toLowerCase() === expect.format;
  const okWidth = info.width === expect.width;
  const okHeight = info.height === expect.height;
  const ok = okFormat && okWidth && okHeight;
  rows.push({
    rel,
    status: ok ? "OK" : required ? "FAIL" : "WARN",
    note: `${info.width}x${info.height} ${info.codec} ${(size / 1024).toFixed(1)} KB`,
  });
  if (!ok && required) {
    issues.push(`${kind}: ${rel} expected ${expect.width}x${expect.height} ${expect.format}, got ${info.width}x${info.height} ${info.codec}`);
  }
}

function checkScreenshotsAt(label, dir) {
  let entries;
  try {
    entries = readdirSync(dir).filter((n) => /\.(png|jpe?g)$/i.test(n));
  } catch {
    issues.push(`${label}: directory missing: ${dir}`);
    return;
  }
  if (entries.length === 0) {
    issues.push(`${label}: directory is empty`);
    return;
  }
  for (const name of entries) {
    const abs = join(dir, name);
    const size = statSync(abs).size;
    const info = probeSafe(abs);
    const relName = `${label}/${name}`;
    if (!info) {
      rows.push({ rel: relName, status: "FAIL", note: "no probe" });
      issues.push(`${label}: cannot probe ${name}`);
      continue;
    }
    const long = Math.max(info.width, info.height);
    const aspect = info.width / info.height;
    const aspectOk = Math.abs(aspect - SCREENSHOT_RULES.aspect) <= SCREENSHOT_RULES.aspectTolerance;
    const lenOk = long >= SCREENSHOT_RULES.minLong && long <= SCREENSHOT_RULES.maxLong;
    const fmtOk = SCREENSHOT_RULES.formats.has(String(info.codec).toLowerCase());
    const ok = aspectOk && lenOk && fmtOk;
    const note = `${info.width}x${info.height} ${info.codec} ${(size / 1024).toFixed(1)} KB aspect=${aspect.toFixed(3)}`;
    rows.push({ rel: relName, status: ok ? "OK" : "FAIL", note });
    if (!ok) issues.push(`${relName}: ${note} (aspectOk=${aspectOk}, lenOk=${lenOk}, fmtOk=${fmtOk})`);
  }
}

function checkScreenshots() {
  checkScreenshotsAt("screenshots", screenshotsDir);
  const enDir = join(screenshotsDir, "en");
  try {
    if (readdirSync(enDir).length > 0) checkScreenshotsAt("screenshots/en", enDir);
  } catch {}
}

for (const r of REQUIRED) checkSingle(r.rel, r.expect, r.kind, true);
for (const r of OPTIONAL) checkSingle(r.rel, r.expect, r.kind, false);
checkScreenshots();

const lines = [];
lines.push("# image-check-report.md");
lines.push("");
lines.push(`Сгенерировано: ${new Date().toISOString()}`);
lines.push("");
lines.push("| Файл | Статус | Параметры |");
lines.push("|------|--------|-----------|");
for (const row of rows) {
  lines.push(`| \`${row.rel}\` | ${row.status} | ${row.note} |`);
}
lines.push("");
if (issues.length === 0) {
  lines.push("Проблем не найдено.");
} else {
  lines.push("## Проблемы");
  for (const it of issues) lines.push(`- ${it}`);
}

const outPath = join(checklistsDir, "image-check-report.md");
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`[check-images] report -> ${relative(repoRoot, outPath)}`);
console.log(`[check-images] issues: ${issues.length}`);
process.exit(issues.length === 0 ? 0 : 1);
