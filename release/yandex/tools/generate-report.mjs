// Запускает все проверки и собирает итоговый отчёт publication-readiness-report.md.
// Запуск: node release/yandex/tools/generate-report.mjs

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { checklistsDir, releaseRoot, repoRoot, videosDir } from "./paths.mjs";

const here = new URL(".", import.meta.url).pathname.replace(/^\/(\w):/, "$1:");
const node = process.execPath;

function runStep(name, scriptRel) {
  const abs = join(repoRoot, "release", "yandex", "tools", scriptRel);
  console.log(`[generate-report] running ${name}`);
  const res = spawnSync(node, [abs], { cwd: repoRoot, stdio: "inherit" });
  return res.status ?? 1;
}

const statuses = {
  texts: runStep("check-texts", "check-texts.mjs"),
  images: runStep("check-images", "check-images.mjs"),
  videos: runStep("check-videos", "check-videos.mjs"),
};

function readMaybe(absPath) {
  try {
    return readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

const textReport = readMaybe(join(checklistsDir, "text-check-report.md"));
const imageReport = readMaybe(join(checklistsDir, "image-check-report.md"));
const videoReport = readMaybe(join(videosDir, "video-check-report.md"));

const lines = [];
lines.push("# publication-readiness-report.md");
lines.push("");
lines.push(`Сгенерировано: ${new Date().toISOString()}`);
lines.push("");
lines.push("## Итог по проверкам");
lines.push("");
lines.push("| Раздел | Код возврата | Статус |");
lines.push("|--------|--------------|--------|");
lines.push(`| Тексты | ${statuses.texts} | ${statuses.texts === 0 ? "OK" : "FAIL"} |`);
lines.push(`| Картинки | ${statuses.images} | ${statuses.images === 0 ? "OK" : "FAIL"} |`);
lines.push(`| Видео | ${statuses.videos} | ${statuses.videos === 0 ? "OK" : "FAIL"} |`);
lines.push("");
const overallOk = Object.values(statuses).every((c) => c === 0);
lines.push(`Готовность к публикации: **${overallOk ? "READY" : "BLOCKERS"}**.`);
lines.push("");
lines.push("Полные отчёты:");
lines.push("");
lines.push("- [text-check-report.md](./checklists/text-check-report.md)");
lines.push("- [image-check-report.md](./checklists/image-check-report.md)");
lines.push("- [video-check-report.md](./videos/video-check-report.md)");
lines.push("- [publication-audit.md](./publication-audit.md)");
lines.push("");
lines.push("## Сводка");
lines.push("");
if (textReport) lines.push("### Тексты", "", textReport.trim(), "");
if (imageReport) lines.push("### Картинки", "", imageReport.trim(), "");
if (videoReport) lines.push("### Видео", "", videoReport.trim(), "");

const outPath = join(releaseRoot, "publication-readiness-report.md");
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`[generate-report] -> ${outPath}`);
process.exit(overallOk ? 0 : 1);
