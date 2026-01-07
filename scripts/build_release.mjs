import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

await run("npm", ["run", "bom-check"]);
await run("npm", ["run", "lint"]);
await run("npm", ["run", "typecheck"]);
await run("npm", ["run", "test:unit"]);
await run("npm", ["run", "test:integration"]);

const distDir = join(process.cwd(), "dist");
const buildsDir = join(distDir, "platform_builds");
const releasesDir = join(distDir, "releases");
await mkdir(buildsDir, { recursive: true });
await mkdir(releasesDir, { recursive: true });

const platforms = ["crazygames", "poki", "yandex", "vk"];
for (const p of platforms) {
  const zipPath = join(releasesDir, `magnet-caravan_${p}.zip`);
  const outDir = join(buildsDir, p);
  await run(
    "npx",
    ["vite", "build", "--outDir", outDir],
    {
      ...process.env,
      VITE_PLATFORM_ADAPTER: p,
    }
  );
  await zipDist(outDir, zipPath);
  console.log(`release: ${zipPath}`);
}

console.log("build_release: OK");

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", env });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function zipDist(distDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.glob("**/*", { cwd: distDir, ignore: ["releases/**"] });
    archive.finalize();
  });
}
