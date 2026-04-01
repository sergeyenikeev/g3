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

const builds = [
  { id: "web", envValue: "local" },
  { id: "yandex", envValue: "yandex" },
  { id: "vk", envValue: "vk" },
];

for (const build of builds) {
  const zipPath = join(releasesDir, `magnet-caravan_${build.id}.zip`);
  const outDir = join(buildsDir, build.id);
  await run("npx", ["vite", "build", "--outDir", outDir], {
    ...process.env,
    VITE_PLATFORM_ADAPTER: build.envValue,
  });
  await zipDist(outDir, zipPath);
  console.log(`release: ${zipPath}`);
}

console.log("build_release: OK");

function run(cmd, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const p = spawnCommand(cmd, args, env);
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function spawnCommand(cmd, args, env) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, { stdio: "inherit", env });
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], { stdio: "inherit", env });
}

function escapeForCmd(arg) {
  const text = String(arg);
  if (text.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(text)) return text;
  return `"${text.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
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
