import { buildReleaseTarget, ensureReleaseDirs, runReleaseChecks } from "./release_build_utils.mjs";

const targetId = String(process.argv[2] ?? "").trim().toLowerCase();

if (!targetId) {
  throw new Error("Usage: node scripts/build_platform_release.mjs <web|generic|yandex|vk>");
}

await runReleaseChecks();
const dirs = await ensureReleaseDirs();
const { zipPath } = await buildReleaseTarget(targetId, dirs);

console.log(`build_platform_release: OK -> ${zipPath}`);
