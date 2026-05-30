// Пересоздаёт видео для Яндекс Игр в release/yandex/videos/.
// Делегирует тяжёлую работу существующему пайплайну проекта (npm run media:yandex:promo),
// затем копирует/перекодирует артефакты в release/yandex/videos с целевыми именами.
//
// Скрипт НЕ меняет код игры и НЕ трогает package.json.
// Запуск: node release/yandex/tools/record-video.mjs

import { spawnSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { docsSourceRoot, repoRoot, videosDir } from "./paths.mjs";

await mkdir(videosDir, { recursive: true });

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

for (const target of ["media:yandex", "media:yandex:promo"]) {
  console.log(`[record-video] running: npm run ${target}`);
  const result = spawnSync(npmCmd, ["run", target], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`[record-video] npm run ${target} exited with`, result.status);
    process.exit(result.status ?? 1);
  }
}

const pairs = [
  ["video/gameplay_1920x1080.mp4", "gameplay-horizontal-16x9.mp4"],
  ["video/gameplay_vertical_1080x1920.mp4", "gameplay-vertical-9x16.mp4"],
  ["video/ad_horizontal_1920x1080.mp4", "promo-horizontal-16x9.mp4"],
  ["video/ad_vertical_1080x1920.mp4", "promo-vertical-9x16.mp4"],
];

for (const [src, dst] of pairs) {
  const from = join(docsSourceRoot, src);
  const to = join(videosDir, dst);
  await copyFile(from, to);
  console.log("[record-video] copied", src, "->", dst);
}

console.log("[record-video] OK");
