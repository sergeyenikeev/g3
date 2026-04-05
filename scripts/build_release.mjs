import { buildReleaseTarget, ensureReleaseDirs, RELEASE_TARGETS, runReleaseChecks } from "./release_build_utils.mjs";

await runReleaseChecks();
const dirs = await ensureReleaseDirs();

for (const target of RELEASE_TARGETS) {
  const { zipPath } = await buildReleaseTarget(target.id, dirs);
  console.log(`release: ${zipPath}`);
}

console.log("build_release: OK");
