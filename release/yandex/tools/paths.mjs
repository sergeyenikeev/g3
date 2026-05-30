import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "..", "..", "..");
export const releaseRoot = resolve(repoRoot, "release", "yandex");
export const imagesDir = join(releaseRoot, "images");
export const screenshotsDir = join(imagesDir, "screenshots");
export const videosDir = join(releaseRoot, "videos");
export const checklistsDir = join(releaseRoot, "checklists");
export const docsSourceRoot = join(repoRoot, "docs", "promo", "yandex");

const require = createRequire(import.meta.url);
export function ffmpegPath() {
  return require("ffmpeg-static");
}
