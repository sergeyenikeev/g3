// Снимает скриншоты Magnet Caravan в английской локали через Playwright + mock-адаптер.
// Не меняет код игры: язык переключается через предустановку save в localStorage
// (ключ "magnet-caravan:platform-save", settings.language = "en").
//
// Запуск: node release/yandex/tools/capture-en-screenshots.mjs

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { imagesDir, repoRoot, screenshotsDir } from "./paths.mjs";

const host = "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

const enScreenshotsDir = join(screenshotsDir, "en");
await mkdir(enScreenshotsDir, { recursive: true });
const enImagesDir = join(imagesDir, "en");
await mkdir(enImagesDir, { recursive: true });

const server = spawnCommand(
  "npm",
  ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"],
  { ...process.env, VITE_PLATFORM_ADAPTER: "mock", VITE_E2E: "1" },
);

const ENGLISH_SAVE = {
  v: 1,
  settings: {
    sfxVolume: 0.8,
    musicVolume: 0.6,
    visualQuality: "auto",
    language: "en",
    pilotName: "",
  },
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

try {
  await waitForHttp(baseURL, 60_000);
  await captureDesktop(baseURL);
  await captureMobile(baseURL);
  console.log(`[capture-en-screenshots] OK -> ${enScreenshotsDir}`);
} finally {
  await stopProcessTree(server);
}

async function preinstallLocaleEn(page) {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        globalThis.localStorage.clear();
        globalThis.localStorage.setItem(key, value);
      } catch {}
    },
    { key: "magnet-caravan:platform-save", value: JSON.stringify(ENGLISH_SAVE) },
  );
}

async function captureDesktop(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await preinstallLocaleEn(page);
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitForScene(page, "menu");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-desktop-01.png") });

  // Optional EN cover/icon clips from the same menu frame
  await page.screenshot({
    path: join(enImagesDir, "cover-800x470.png"),
    clip: { x: 260, y: 100, width: 800, height: 470 },
  });
  await page.screenshot({
    path: join(enImagesDir, "icon-512.png"),
    clip: { x: 856, y: 170, width: 512, height: 512 },
  });

  const metrics = await page.evaluate(() => {
    const g = globalThis.__MC_GAME__;
    return { width: g.scale.width, height: g.scale.height };
  });

  await clickMenuEntry(page, ["daily"]);
  await page.waitForFunction(() => {
    const s = globalThis.__MC_GAME__?.registry?.get("runState");
    return s?.mode === "run";
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("ui") === true);
  await page.waitForTimeout(1800);
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-desktop-02.png") });

  await moveToUpgrade(page);
  await waitForScene(page, "upgrade");
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-desktop-03.png") });

  await chooseUpgrade(page, metrics.width, metrics.height);
  await page.waitForFunction(() => typeof globalThis.__MC_E2E__?.endRun === "function");
  await page.evaluate(() => globalThis.__MC_E2E__.endRun());
  await waitForScene(page, "results");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-desktop-04.png") });

  await context.close();
  await browser.close();
}

async function captureMobile(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await preinstallLocaleEn(page);
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitForScene(page, "menu");

  const metrics = await page.evaluate(() => {
    const g = globalThis.__MC_GAME__;
    return { width: g.scale.width, height: g.scale.height };
  });

  await clickMenuEntry(page, ["daily"]);
  await page.waitForFunction(() => {
    const s = globalThis.__MC_GAME__?.registry?.get("runState");
    return s?.mode === "run";
  });
  await page.waitForTimeout(1600);
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-mobile-landscape-01.png") });

  await moveToUpgrade(page);
  await waitForScene(page, "upgrade");
  await chooseUpgrade(page, metrics.width, metrics.height);
  await page.waitForFunction(() => typeof globalThis.__MC_E2E__?.endRun === "function");
  await page.evaluate(() => globalThis.__MC_E2E__.endRun());
  await waitForScene(page, "results");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(enScreenshotsDir, "screenshot-mobile-landscape-02.png") });

  await context.close();
  await browser.close();
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 25_000 },
  );
}

async function moveToUpgrade(page) {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1200);
  await page.keyboard.up("ArrowUp");
  await page.waitForFunction(() => {
    const state = globalThis.__MC_GAME__?.registry?.get("runState");
    return Boolean(state && typeof state.bolts === "number" && state.bolts > 0);
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === true, null, {
    timeout: 30_000,
  });
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

async function chooseUpgrade(page, width, height) {
  const clickTargets = [0.49, 0.36, 0.58];
  for (const ratio of clickTargets) {
    await page.mouse.click(width / 2, Math.round(height * ratio));
    try {
      await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
        timeout: 1500,
      });
      return;
    } catch {}
  }
  throw new Error("Unable to dismiss upgrade scene during EN capture");
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
