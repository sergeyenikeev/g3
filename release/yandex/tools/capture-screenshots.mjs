// Пересоздаёт скриншоты под Яндекс Игры в release/yandex/images/.
// Делегирует тяжёлую работу существующему пайплайну проекта (npm run media:yandex),
// затем копирует артефакты в release/yandex/images с целевыми именами.
//
// Скрипт НЕ меняет код игры и НЕ трогает package.json.
// Запуск: node release/yandex/tools/capture-screenshots.mjs

import { spawnSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { docsSourceRoot, imagesDir, repoRoot, screenshotsDir } from "./paths.mjs";

await mkdir(screenshotsDir, { recursive: true });
await mkdir(imagesDir, { recursive: true });

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
console.log("[capture-screenshots] running: npm run media:yandex");
const result = spawnSync(npmCmd, ["run", "media:yandex"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: false,
});

if (result.status !== 0) {
  console.error("[capture-screenshots] npm run media:yandex exited with", result.status);
  process.exit(result.status ?? 1);
}

const pairs = [
  ["card/icon_512x512.png", "icon-512.png"],
  ["card/icon_menu_alt_512x512.png", "icon-512-alt-01.png"],
  ["card/cover_800x470.png", "cover-800x470.png"],
  ["card/cover_menu_alt_800x470.png", "cover-800x470-alt-01.png"],
  ["desktop/01_menu_1600x900.png", "screenshots/screenshot-desktop-01.png"],
  ["desktop/02_gameplay_1600x900.png", "screenshots/screenshot-desktop-02.png"],
  ["desktop/03_upgrade_1600x900.png", "screenshots/screenshot-desktop-03.png"],
  ["desktop/04_results_1600x900.png", "screenshots/screenshot-desktop-04.png"],
  ["mobile/01_gameplay_1280x720.png", "screenshots/screenshot-mobile-landscape-01.png"],
  ["mobile/02_results_1280x720.png", "screenshots/screenshot-mobile-landscape-02.png"],
];

for (const [src, dst] of pairs) {
  const from = join(docsSourceRoot, src);
  const to = join(imagesDir, dst);
  await copyFile(from, to);
  console.log("[capture-screenshots] copied", src, "->", dst);
}

console.log("[capture-screenshots] OK");
