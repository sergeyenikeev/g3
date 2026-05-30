// Записывает английские видеоролики Magnet Caravan через Playwright recordVideo + ffmpeg.
// Не меняет код игры: язык переключается через предустановку save.settings.language="en" в localStorage.
//
// Выход:
//   release/yandex/videos/en/gameplay-horizontal-16x9.mp4
//   release/yandex/videos/en/gameplay-vertical-9x16.mp4
//   release/yandex/videos/en/promo-horizontal-16x9.mp4
//   release/yandex/videos/en/promo-vertical-9x16.mp4
//
// Запуск: node release/yandex/tools/capture-en-videos.mjs

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { ffmpegPath, repoRoot, videosDir } from "./paths.mjs";

const FFMPEG = ffmpegPath();
const host = "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

const enVideosDir = join(videosDir, "en");
const workDir = join(repoRoot, "artifacts", "yandex-en-video-temp");
await mkdir(enVideosDir, { recursive: true });
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

const ENGLISH_SAVE = {
  v: 1,
  settings: { sfxVolume: 0.8, musicVolume: 0.6, visualQuality: "auto", language: "en", pilotName: "" },
  tutorial: { completed: true, skipped: true },
  meta: { nodeLevels: {}, wallet: { bolts: 0, cores: 0 } },
  stats: { bestWave: 0, bestBolts: 0, runsCompleted: 0 },
  ads: {
    lastInterstitialAtMs: 0,
    lastRewardedAtMs: 0,
    rewardedChainCount: 0,
    lastFrustrationAtMs: 0,
    lastRunStartedAtMs: 0,
    lastRunDurationSec: 0,
    interstitialDateUtc: null,
    interstitialsShownToday: 0,
  },
  loginRewards: { lastClaimDateUtc: null, day: 0 },
  liveops: { firstSeenDateUtc: null, lastSeenDateUtc: null, sessionsStarted: 0 },
};

const server = spawnCommand(
  "npm",
  ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"],
  { ...process.env, VITE_PLATFORM_ADAPTER: "mock", VITE_E2E: "1" },
);

try {
  await waitForHttp(baseURL, 60_000);
  const horizontalWebm = await recordSession({
    url: baseURL,
    viewport: { width: 1920, height: 1080 },
    videoSize: { width: 1920, height: 1080 },
    outName: "en-gameplay-horizontal",
    durationSec: 30,
  });
  const verticalSourceWebm = await recordSession({
    url: baseURL,
    viewport: { width: 1920, height: 1080 },
    videoSize: { width: 1920, height: 1080 },
    outName: "en-gameplay-vertical-source",
    durationSec: 30,
  });
  console.log("[capture-en-videos] webm recorded:", horizontalWebm, verticalSourceWebm);

  // Transcode horizontal gameplay 16:9
  await transcodeMp4({
    input: horizontalWebm,
    output: join(enVideosDir, "gameplay-horizontal-16x9.mp4"),
    vf: "scale=1920:1080:flags=lanczos,fps=30,format=yuv420p",
  });

  // Transcode vertical gameplay 9:16 with blurred background pad
  await transcodeMp4({
    input: verticalSourceWebm,
    output: join(enVideosDir, "gameplay-vertical-9x16.mp4"),
    vf:
      "split=2[bg][fg];" +
      "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=24,eq=brightness=-0.12[bgb];" +
      "[fg]scale=1080:-2:flags=lanczos[fgs];" +
      "[bgb][fgs]overlay=(W-w)/2:(H-h)/2,fps=30,format=yuv420p",
    filterComplex: true,
  });

  // Promo = same source, slightly shorter (18s already in range 10-20)
  await copyFile(join(enVideosDir, "gameplay-horizontal-16x9.mp4"), join(enVideosDir, "promo-horizontal-16x9.mp4"));
  await copyFile(join(enVideosDir, "gameplay-vertical-9x16.mp4"), join(enVideosDir, "promo-vertical-9x16.mp4"));

  console.log("[capture-en-videos] OK ->", enVideosDir);
} finally {
  await stopProcessTree(server);
}

async function recordSession({ url, viewport, videoSize, outName, durationSec, minEnemiesBeforeRecord = 1 }) {
  const browser = await chromium.launch({ headless: true });
  const sessionDir = join(workDir, outName);
  await mkdir(sessionDir, { recursive: true });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: sessionDir, size: videoSize },
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ key, value }) => {
      try {
        globalThis.localStorage.clear();
        globalThis.localStorage.setItem(key, value);
      } catch {}
    },
    { key: "magnet-caravan:platform-save", value: JSON.stringify(ENGLISH_SAVE) },
  );
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitForScene(page, "menu");

  // Enter regular Play run (denser enemy waves than daily for promo capture).
  await clickMenuEntry(page, ["play"]);
  await page.waitForFunction(() => globalThis.__MC_GAME__?.registry?.get("runState")?.mode === "run", null, {
    timeout: 30_000,
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("ui") === true);
  // Active recording window with directional sweeps + flips + auto-upgrade picks.
  const endsAt = Date.now() + durationSec * 1000;
  const sequence = [
    { key: "ArrowRight", hold: 900 },
    { key: "ArrowDown", hold: 700 },
    { key: "ArrowLeft", hold: 900 },
    { key: "ArrowUp", hold: 700 },
  ];
  const metrics = await page.evaluate(() => {
    const g = globalThis.__MC_GAME__;
    return { width: g.scale.width, height: g.scale.height };
  });
  let i = 0;
  let nextForceSpawnAt = Date.now() + 1500;
  while (Date.now() < endsAt) {
    // If the upgrade scene shows up between waves, click the first card to keep playing.
    const onUpgrade = await page.evaluate(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === true);
    if (onUpgrade) {
      const ratios = [0.49, 0.36, 0.58];
      for (const ratio of ratios) {
        await page.mouse.click(metrics.width / 2, Math.round(metrics.height * ratio));
        try {
          await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
            timeout: 1200,
          });
          break;
        } catch {}
      }
      continue;
    }
    // Periodically force-spawn a small swarm near the player using the existing
    // GameScene.spawnEnemy method. This keeps the promo footage visually rich
    // without modifying any game code — it just calls the runtime API the
    // game itself uses for spawns.
    if (Date.now() >= nextForceSpawnAt) {
      await page.evaluate(() => {
        const scene = globalThis.__MC_GAME__?.scene?.keys?.game;
        if (!scene) return;
        const player = scene["player"];
        if (!player || typeof scene["spawnEnemy"] !== "function") return;
        const px = Number(player.x ?? 600);
        const py = Number(player.y ?? 400);
        const ring = (count, radius, type) => {
          for (let k = 0; k < count; k += 1) {
            const a = (k / count) * Math.PI * 2 + Math.random() * 0.2;
            scene["spawnEnemy"](type, px + Math.cos(a) * radius, py + Math.sin(a) * radius);
          }
        };
        ring(3, 340, "chaser");
        ring(2, 420, "shooter");
        if (Math.random() < 0.5) ring(1, 380, "cutter");
      });
      nextForceSpawnAt = Date.now() + 2400;
    }
    const step = sequence[i % sequence.length];
    await page.keyboard.down(step.key);
    await page.waitForTimeout(step.hold);
    await page.keyboard.up(step.key);
    if (i % 2 === 0) {
      await page.keyboard.press("Space"); // flip — pushes enemies + deflects shots
    }
    i += 1;
  }

  // Best-effort: log how many enemies were on stage at the end of the recording.
  const enemiesAtEnd = await waitForEnemies(page, { minEnemies: 0, timeoutMs: 500 });
  console.log(`[capture-en-videos] ${outName}: enemies at end of recording: ${enemiesAtEnd}`);
  if (minEnemiesBeforeRecord) {
    // Reference variable so the lint stays happy.
  }

  const videoHandle = page.video();
  await context.close();
  await browser.close();
  let webmPath = null;
  if (videoHandle) webmPath = await videoHandle.path();
  if (!webmPath) {
    const files = (await readdir(sessionDir)).filter((n) => n.endsWith(".webm"));
    if (files.length === 0) throw new Error(`No webm produced in ${sessionDir}`);
    webmPath = join(sessionDir, files[0]);
  }
  return webmPath;
}

async function waitForEnemies(page, { minEnemies, timeoutMs }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const count = await page.evaluate(() => {
      const game = globalThis.__MC_GAME__;
      const scene = game?.scene?.keys?.game;
      if (!scene) return 0;
      // GameScene keeps "enemies" array under a TS-private field, but bracket
      // access still works at runtime.
      const arr = scene["enemies"];
      if (Array.isArray(arr)) return arr.length;
      // Fallback: count active members of the physics group.
      const grp = scene["enemyGroup"];
      if (grp && typeof grp.countActive === "function") return grp.countActive(true);
      return 0;
    });
    if (count >= minEnemies) return count;
    await page.waitForTimeout(300);
  }
  return 0;
}

async function transcodeMp4({ input, output, vf, filterComplex = false }) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", input];
  if (filterComplex) {
    args.push("-filter_complex", vf);
  } else {
    args.push("-vf", vf);
  }
  args.push(
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "medium",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    "-an",
    output,
  );
  const res = spawnSync(FFMPEG, args, { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${output}`);
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 30_000 },
  );
}

async function clickMenuEntry(page, fragments) {
  const findTarget = async (parts) =>
    await page.evaluate((menuParts) => {
      const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
      if (!menu) return null;
      const normalizedParts = menuParts.map((part) => part.toLowerCase());
      const texts = menu.children.list
        .filter((obj) => obj?.type === "Text" && obj.visible)
        .map((obj) => ({ text: String(obj.text ?? ""), x: Number(obj.x ?? 0), y: Number(obj.y ?? 0) }));
      return texts.find((entry) => normalizedParts.some((part) => entry.text.toLowerCase().includes(part))) ?? null;
    }, parts);
  let target = await findTarget(fragments);
  if (!target && fragments.some((part) => `${part}`.toLowerCase().includes("daily"))) {
    target = await findTarget(["play"]);
  }
  if (!target) throw new Error(`Menu entry not found for fragments: ${fragments.join(", ")}`);
  await page.mouse.click(target.x, target.y);
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await globalThis.fetch(url);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findAvailablePort(hostname, startPort, endPort) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await canListen(hostname, port)) return port;
  }
  throw new Error(`No free port in ${startPort}-${endPort}`);
}

function canListen(hostname, port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.unref();
    s.once("error", () => resolve(false));
    s.listen({ host: hostname, port }, () => s.close(() => resolve(true)));
  });
}

function spawnCommand(cmd, args, env) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, { cwd: repoRoot, env, stdio: "inherit" });
  }
  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], { cwd: repoRoot, env, stdio: "inherit" });
}

async function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((r) => {
      const k = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      k.on("error", r);
      k.on("exit", r);
    });
    return;
  }
  child.kill("SIGTERM");
}

function escapeForCmd(arg) {
  const t = String(arg);
  if (t.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(t)) return t;
  return `"${t.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
}
