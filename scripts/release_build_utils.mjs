import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

export const RELEASE_TARGETS = [
  { id: "web", envValue: "local" },
  { id: "generic", envValue: "generic" },
  { id: "yandex", envValue: "yandex" },
  { id: "vk", envValue: "vk" },
];

export async function runReleaseChecks() {
  await run("npm", ["run", "bom-check"]);
  await run("npm", ["run", "lint"]);
  await run("npm", ["run", "typecheck"]);
  await run("npm", ["run", "test:unit"]);
  await run("npm", ["run", "test:integration"]);
}

export async function ensureReleaseDirs(rootDir = process.cwd()) {
  const distDir = join(rootDir, "dist");
  const buildsDir = join(distDir, "platform_builds");
  const releasesDir = join(distDir, "releases");
  await mkdir(buildsDir, { recursive: true });
  await mkdir(releasesDir, { recursive: true });
  return { distDir, buildsDir, releasesDir };
}

export async function buildReleaseTarget(targetId, dirs, rootDir = process.cwd()) {
  const target = resolveReleaseTarget(targetId);
  const outDir = join(dirs.buildsDir, target.id);
  const zipPath = join(dirs.releasesDir, `magnet-caravan_${target.id}.zip`);

  await run(
    "npx",
    ["vite", "build", "--outDir", outDir],
    {
      ...process.env,
      VITE_PLATFORM_ADAPTER: target.envValue,
    },
    rootDir
  );
  await zipDist(outDir, zipPath);

  return {
    target,
    outDir,
    zipPath,
  };
}

export function resolveReleaseTarget(targetId) {
  const normalizedId = String(targetId ?? "").trim().toLowerCase();
  const target = RELEASE_TARGETS.find((item) => item.id === normalizedId);
  if (!target) {
    const supported = RELEASE_TARGETS.map((item) => item.id).join(", ");
    throw new Error(`Unknown release target "${targetId}". Supported targets: ${supported}`);
  }
  return target;
}

function run(cmd, args, env = process.env, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const p = spawnCommand(cmd, args, env, cwd);
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function spawnCommand(cmd, args, env, cwd) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, { stdio: "inherit", env, cwd });
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], { stdio: "inherit", env, cwd });
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
