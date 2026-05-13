import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

const rootDir = process.cwd();
const outputDir = join(rootDir, "docs", "promo", "yandex");
const desktopDir = join(outputDir, "desktop");
const mobileDir = join(outputDir, "mobile");
const cardDir = join(outputDir, "card");

await mkdir(desktopDir, { recursive: true });
await mkdir(mobileDir, { recursive: true });
await mkdir(cardDir, { recursive: true });

const server = spawnCommand("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
  ...process.env,
  VITE_PLATFORM_ADAPTER: "mock",
  VITE_E2E: "1",
});

try {
  await waitForHttp(baseURL, 30_000);
  await captureDesktop(baseURL, desktopDir, cardDir);
  await captureMobile(baseURL, mobileDir);
  await renderCardAssets(cardDir);
  console.log(`capture_yandex_media: OK -> ${outputDir}`);
} finally {
  await stopProcessTree(server);
}

async function captureDesktop(url, desktopDir, cardDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.addInitScript(() => globalThis.localStorage.clear());
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitForScene(page, "menu");

  await page.screenshot({ path: join(desktopDir, "01_menu_1600x900.png") });
  await page.screenshot({
    path: join(cardDir, "cover_menu_alt_800x470.png"),
    clip: { x: 260, y: 100, width: 800, height: 470 },
  });
  await page.screenshot({
    path: join(cardDir, "icon_menu_alt_512x512.png"),
    clip: { x: 856, y: 170, width: 512, height: 512 },
  });

  const metrics = await page.evaluate(() => {
    const g = globalThis.__MC_GAME__;
    return {
      width: g.scale.width,
      height: g.scale.height,
    };
  });

  await clickMenuEntry(page, ["daily", "ежеднев"]);
  await page.waitForFunction(() => {
    const s = globalThis.__MC_GAME__?.registry?.get("runState");
    return s?.mode === "run";
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("ui") === true);
  await page.waitForTimeout(1800);
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(desktopDir, "02_gameplay_1600x900.png") });
  await page.screenshot({
    path: join(cardDir, "cover_800x470.png"),
    clip: { x: 400, y: 170, width: 800, height: 470 },
  });
  await page.screenshot({
    path: join(cardDir, "icon_512x512.png"),
    clip: { x: 544, y: 138, width: 512, height: 512 },
  });

  await moveToUpgrade(page);
  await waitForScene(page, "upgrade");
  await page.screenshot({ path: join(desktopDir, "03_upgrade_1600x900.png") });

  await chooseUpgrade(page, metrics.width, metrics.height);
  await page.waitForFunction(() => typeof globalThis.__MC_E2E__?.endRun === "function");
  await page.evaluate(() => globalThis.__MC_E2E__.endRun());
  await waitForScene(page, "results");
  await page.screenshot({ path: join(desktopDir, "04_results_1600x900.png") });

  await context.close();
  await browser.close();
}

async function renderCardAssets(cardDir) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 470 } });
  await page.setContent(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #081018;
            font-family: Georgia, Cambria, "Times New Roman", serif;
          }
          .cover {
            position: relative;
            width: 800px;
            height: 470px;
            background:
              radial-gradient(circle at 76% 34%, rgba(92, 200, 255, 0.18), transparent 20%),
              radial-gradient(circle at 72% 72%, rgba(255, 209, 102, 0.12), transparent 24%),
              linear-gradient(180deg, rgba(10, 18, 28, 0.96), rgba(7, 13, 20, 0.98)),
              repeating-linear-gradient(
                180deg,
                rgba(255,255,255,0.015) 0 58px,
                rgba(255,255,255,0.0) 58px 116px
              ),
              repeating-linear-gradient(
                90deg,
                rgba(255,255,255,0.018) 0 104px,
                rgba(255,255,255,0.0) 104px 208px
              );
          }
          .grain {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(circle at 30% 30%, rgba(255,255,255,0.045), transparent 20%),
              radial-gradient(circle at 70% 60%, rgba(255,255,255,0.035), transparent 18%);
            mix-blend-mode: screen;
            pointer-events: none;
          }
          .copy {
            position: absolute;
            left: 42px;
            top: 0;
            width: 348px;
            height: 100%;
            display: flex;
            align-items: center;
            color: #e8f6ff;
            z-index: 2;
          }
          h1 {
            margin: 0;
            font-size: 56px;
            line-height: 0.94;
            letter-spacing: 1.5px;
            font-weight: 700;
            text-shadow: 0 0 24px rgba(92, 200, 255, 0.18);
          }
          .hero {
            position: absolute;
            right: 34px;
            top: 54px;
            width: 350px;
            height: 350px;
            border: 1px solid rgba(255, 209, 102, 0.24);
            background:
              radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05), transparent 58%),
              linear-gradient(180deg, rgba(8, 14, 22, 0.84), rgba(8, 14, 22, 0.48));
            box-shadow:
              0 18px 40px rgba(0, 0, 0, 0.28),
              inset 0 0 0 1px rgba(92, 200, 255, 0.08);
            z-index: 2;
            overflow: hidden;
          }
          .hero::before {
            content: "";
            position: absolute;
            inset: 18px;
            border: 1px solid rgba(255, 209, 102, 0.22);
          }
          .ring {
            position: absolute;
            left: 124px;
            top: 92px;
            width: 132px;
            height: 132px;
            border-radius: 50%;
            border: 6px solid #2f76ff;
            box-shadow: 0 0 40px rgba(47, 118, 255, 0.24);
          }
          .ring::before {
            content: "";
            position: absolute;
            inset: 12px;
            border-radius: 50%;
            border: 10px solid #727882;
            box-shadow: inset 0 0 0 12px #3a3128;
          }
          .ring::after {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            border: 4px solid #2fd7f0;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 28px rgba(47, 215, 240, 0.16);
          }
          .cross-h, .cross-v {
            position: absolute;
            background: #2fd7f0;
            box-shadow: 0 0 12px rgba(47, 215, 240, 0.18);
          }
          .cross-h {
            left: 158px;
            top: 154px;
            width: 66px;
            height: 4px;
          }
          .cross-v {
            left: 189px;
            top: 123px;
            width: 4px;
            height: 66px;
          }
          .arrow {
            position: absolute;
            width: 0;
            height: 0;
            border-left: 13px solid transparent;
            border-right: 13px solid transparent;
            border-bottom: 24px solid #f1b13e;
            filter: drop-shadow(0 0 8px rgba(241, 177, 62, 0.18));
          }
          .arrow.top { left: 177px; top: 71px; }
          .arrow.bottom { left: 177px; top: 221px; transform: rotate(180deg); }
          .arrow.left { left: 106px; top: 147px; transform: rotate(-90deg); }
          .arrow.right { left: 248px; top: 147px; transform: rotate(90deg); }
          .player {
            position: absolute;
            left: 140px;
            top: 234px;
            width: 92px;
            height: 58px;
            border-radius: 18px;
            background: linear-gradient(90deg, #cfd7df 0 24%, #41464d 24% 52%, #dde5ef 52% 100%);
            box-shadow: 0 0 26px rgba(255,255,255,0.1);
          }
          .player::before {
            content: "";
            position: absolute;
            left: 30px;
            top: 14px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: #f0aa2d;
            box-shadow: 0 0 18px rgba(240, 170, 45, 0.24);
          }
          .player::after {
            content: "";
            position: absolute;
            right: -12px;
            top: 7px;
            width: 18px;
            height: 44px;
            border-radius: 4px;
            background: #39d9f3;
          }
          .wheel, .escort, .enemy, .shard {
            position: absolute;
          }
          .wheel {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #050505;
          }
          .wheel.a { left: 150px; top: 228px; }
          .wheel.b { left: 210px; top: 228px; }
          .wheel.c { left: 150px; top: 278px; }
          .wheel.d { left: 210px; top: 278px; }
          .escort {
            left: 108px;
            top: 202px;
            width: 22px;
            height: 22px;
            border-radius: 5px;
            background: #6b4b24;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
          }
          .escort::before {
            content: "";
            position: absolute;
            left: 6px;
            top: 8px;
            width: 10px;
            height: 3px;
            background: #f1b13e;
            box-shadow: 0 -6px 0 #f1b13e;
          }
          .enemy {
            left: 86px;
            top: 92px;
            width: 34px;
            height: 22px;
            border-radius: 8px;
            background: #d64734;
            transform: rotate(-24deg);
          }
          .enemy::before, .enemy::after {
            content: "";
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #0b0b0b;
            top: -4px;
          }
          .enemy::before { left: 4px; }
          .enemy::after { right: 4px; }
          .enemy-tip {
            position: absolute;
            left: 116px;
            top: 94px;
            width: 0;
            height: 0;
            border-top: 9px solid transparent;
            border-bottom: 9px solid transparent;
            border-left: 16px solid #ff664a;
            transform: rotate(-24deg);
          }
          .shard {
            left: 274px;
            top: 148px;
            width: 18px;
            height: 18px;
            background: #ef34d1;
            transform: rotate(45deg);
            box-shadow: 0 0 18px rgba(239, 52, 209, 0.22);
          }
          .shard::before {
            content: "";
            position: absolute;
            inset: 3px;
            border: 2px solid #8cefff;
          }
          .fog {
            position: absolute;
            left: 110px;
            top: 188px;
            width: 150px;
            height: 120px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 62%);
            filter: blur(10px);
          }
        </style>
      </head>
      <body>
        <div class="cover">
          <div class="grain"></div>
          <div class="copy">
            <h1>Magnet Caravan</h1>
          </div>
          <div class="hero">
            <div class="fog"></div>
            <div class="ring"></div>
            <div class="cross-h"></div>
            <div class="cross-v"></div>
            <div class="arrow top"></div>
            <div class="arrow bottom"></div>
            <div class="arrow left"></div>
            <div class="arrow right"></div>
            <div class="enemy"></div>
            <div class="enemy-tip"></div>
            <div class="escort"></div>
            <div class="shard"></div>
            <div class="player"></div>
            <div class="wheel a"></div>
            <div class="wheel b"></div>
            <div class="wheel c"></div>
            <div class="wheel d"></div>
          </div>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: join(cardDir, "cover_800x470.png") });

  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <style>
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background:
              radial-gradient(circle at 52% 40%, rgba(92, 200, 255, 0.16), transparent 22%),
              radial-gradient(circle at 50% 74%, rgba(255, 209, 102, 0.1), transparent 24%),
              linear-gradient(180deg, #09121d, #060d16);
          }
          .icon {
            position: relative;
            width: 512px;
            height: 512px;
            background:
              repeating-linear-gradient(
                180deg,
                rgba(255,255,255,0.018) 0 66px,
                rgba(255,255,255,0.0) 66px 128px
              ),
              repeating-linear-gradient(
                90deg,
                rgba(255,255,255,0.014) 0 96px,
                rgba(255,255,255,0.0) 96px 192px
              );
          }
          .ring {
            position: absolute;
            left: 182px;
            top: 126px;
            width: 150px;
            height: 150px;
            border-radius: 50%;
            border: 7px solid #2f76ff;
            box-shadow: 0 0 46px rgba(47, 118, 255, 0.24);
          }
          .ring::before {
            content: "";
            position: absolute;
            inset: 14px;
            border-radius: 50%;
            border: 12px solid #727882;
            box-shadow: inset 0 0 0 14px #3a3128;
          }
          .ring::after {
            content: "";
            position: absolute;
            left: 50%;
            top: 50%;
            width: 62px;
            height: 62px;
            border-radius: 50%;
            border: 5px solid #2fd7f0;
            transform: translate(-50%, -50%);
          }
          .cross-h, .cross-v {
            position: absolute;
            background: #2fd7f0;
          }
          .cross-h {
            left: 221px;
            top: 198px;
            width: 72px;
            height: 5px;
          }
          .cross-v {
            left: 255px;
            top: 164px;
            width: 5px;
            height: 72px;
          }
          .arrow {
            position: absolute;
            width: 0;
            height: 0;
            border-left: 15px solid transparent;
            border-right: 15px solid transparent;
            border-bottom: 28px solid #f1b13e;
          }
          .arrow.top { left: 240px; top: 100px; }
          .arrow.bottom { left: 240px; top: 273px; transform: rotate(180deg); }
          .arrow.left { left: 157px; top: 185px; transform: rotate(-90deg); }
          .arrow.right { left: 324px; top: 185px; transform: rotate(90deg); }
          .enemy {
            position: absolute;
            left: 128px;
            top: 104px;
            width: 42px;
            height: 26px;
            border-radius: 10px;
            background: #d64734;
            transform: rotate(-24deg);
          }
          .enemy::before, .enemy::after {
            content: "";
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #050505;
            top: -3px;
          }
          .enemy::before { left: 5px; }
          .enemy::after { right: 5px; }
          .enemy-tip {
            position: absolute;
            left: 162px;
            top: 108px;
            width: 0;
            height: 0;
            border-top: 10px solid transparent;
            border-bottom: 10px solid transparent;
            border-left: 18px solid #ff664a;
            transform: rotate(-24deg);
          }
          .escort {
            position: absolute;
            left: 174px;
            top: 254px;
            width: 26px;
            height: 26px;
            border-radius: 6px;
            background: #6b4b24;
          }
          .escort::before {
            content: "";
            position: absolute;
            left: 7px;
            top: 10px;
            width: 12px;
            height: 3px;
            background: #f1b13e;
            box-shadow: 0 -7px 0 #f1b13e;
          }
          .shard {
            position: absolute;
            left: 357px;
            top: 182px;
            width: 22px;
            height: 22px;
            background: #ef34d1;
            transform: rotate(45deg);
            box-shadow: 0 0 18px rgba(239, 52, 209, 0.22);
          }
          .shard::before {
            content: "";
            position: absolute;
            inset: 4px;
            border: 2px solid #8cefff;
          }
          .player {
            position: absolute;
            left: 195px;
            top: 292px;
            width: 110px;
            height: 66px;
            border-radius: 21px;
            background: linear-gradient(90deg, #cfd7df 0 24%, #41464d 24% 52%, #dde5ef 52% 100%);
          }
          .player::before {
            content: "";
            position: absolute;
            left: 35px;
            top: 15px;
            width: 27px;
            height: 27px;
            border-radius: 50%;
            background: #f0aa2d;
            box-shadow: 0 0 18px rgba(240, 170, 45, 0.24);
          }
          .player::after {
            content: "";
            position: absolute;
            right: -14px;
            top: 8px;
            width: 22px;
            height: 50px;
            border-radius: 5px;
            background: #39d9f3;
          }
          .wheel {
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #050505;
          }
          .wheel.a { left: 208px; top: 286px; }
          .wheel.b { left: 280px; top: 286px; }
          .wheel.c { left: 208px; top: 344px; }
          .wheel.d { left: 280px; top: 344px; }
          .fog {
            position: absolute;
            left: 134px;
            top: 202px;
            width: 230px;
            height: 180px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 62%);
            filter: blur(14px);
          }
          .icon::after {
            content: "";
            position: absolute;
            inset: 0;
            box-shadow:
              inset 0 0 0 6px rgba(92, 200, 255, 0.18),
              inset 0 0 90px rgba(0, 0, 0, 0.22);
          }
        </style>
      </head>
      <body>
        <div class="icon">
          <div class="fog"></div>
          <div class="ring"></div>
          <div class="cross-h"></div>
          <div class="cross-v"></div>
          <div class="arrow top"></div>
          <div class="arrow bottom"></div>
          <div class="arrow left"></div>
          <div class="arrow right"></div>
          <div class="enemy"></div>
          <div class="enemy-tip"></div>
          <div class="escort"></div>
          <div class="shard"></div>
          <div class="player"></div>
          <div class="wheel a"></div>
          <div class="wheel b"></div>
          <div class="wheel c"></div>
          <div class="wheel d"></div>
        </div>
      </body>
    </html>
  `);
  await page.screenshot({ path: join(cardDir, "icon_512x512.png") });
  await page.addStyleTag({
    content: `
      .icon.maskable::after {
        box-shadow: inset 0 0 110px rgba(0, 0, 0, 0.22);
      }
      .icon.maskable .ring,
      .icon.maskable .cross-h,
      .icon.maskable .cross-v,
      .icon.maskable .arrow,
      .icon.maskable .enemy,
      .icon.maskable .enemy-tip,
      .icon.maskable .escort,
      .icon.maskable .shard,
      .icon.maskable .player,
      .icon.maskable .wheel {
        filter: drop-shadow(0 0 8px rgba(143, 231, 255, 0.12));
      }
    `,
  });
  await page.locator(".icon").evaluate((node) => node.classList.add("maskable"));
  await page.screenshot({ path: join(cardDir, "maskable_icon_512x512.png") });

  await browser.close();
}

async function captureMobile(url, mobileDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.addInitScript(() => globalThis.localStorage.clear());
  await page.goto(url);
  await page.waitForSelector("canvas");
  await waitForScene(page, "menu");

  const metrics = await page.evaluate(() => {
    const g = globalThis.__MC_GAME__;
    return {
      width: g.scale.width,
      height: g.scale.height,
    };
  });

  await clickMenuEntry(page, ["daily", "ежеднев"]);
  await page.waitForFunction(() => {
    const s = globalThis.__MC_GAME__?.registry?.get("runState");
    return s?.mode === "run";
  });
  await page.waitForTimeout(1600);
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(mobileDir, "01_gameplay_1280x720.png") });

  await moveToUpgrade(page);
  await waitForScene(page, "upgrade");
  await chooseUpgrade(page, metrics.width, metrics.height);
  await page.waitForFunction(() => typeof globalThis.__MC_E2E__?.endRun === "function");
  await page.evaluate(() => globalThis.__MC_E2E__.endRun());
  await waitForScene(page, "results");
  await page.screenshot({ path: join(mobileDir, "02_results_1280x720.png") });

  await context.close();
  await browser.close();
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 15_000 }
  );
}

async function moveToUpgrade(page) {
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1000);
  await page.keyboard.up("ArrowUp");
  await page.waitForFunction(() => {
    const state = globalThis.__MC_GAME__?.registry?.get("runState");
    return Boolean(state && typeof state.bolts === "number" && state.bolts > 0);
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === true, null, { timeout: 20_000 });
}

async function clickMenuEntry(page, fragments) {
  const findTarget = async (parts) =>
    await page.evaluate((menuParts) => {
      const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
      if (!menu) return null;
      const normalizedParts = menuParts.map((part) => part.toLowerCase());
      const texts = menu.children.list
        .filter((obj) => obj?.type === "Text" && obj.visible)
        .map((obj) => ({
          text: String(obj.text ?? ""),
          x: Number(obj.x ?? 0),
          y: Number(obj.y ?? 0),
        }));

      return texts.find((entry) => normalizedParts.some((part) => entry.text.toLowerCase().includes(part))) ?? null;
    }, parts);

  let target = await findTarget(fragments);
  if (!target && fragments.some((part) => `${part}`.toLowerCase().includes("daily") || `${part}`.toLowerCase().includes("ежед"))) {
    target = await findTarget(["play", "играт"]);
  }

  if (!target) {
    throw new Error(`Menu entry not found for fragments: ${fragments.join(", ")}`);
  }

  await page.mouse.click(target.x, target.y);
}

async function chooseUpgrade(page, width, height) {
  const clickTargets = [0.49, 0.36, 0.58];
  for (const ratio of clickTargets) {
    await page.mouse.click(width / 2, Math.round(height * ratio));
    try {
      await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
        timeout: 1_500,
      });
      return;
    } catch {
      // Try the next card position if the current click misses the offer hitbox.
    }
  }

  throw new Error("Unable to dismiss upgrade scene during Yandex media capture");
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await globalThis.fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function findAvailablePort(hostname, startPort, endPort) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await canListen(hostname, port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${endPort}`);
}

function canListen(hostname, port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: hostname, port }, () => {
      server.close(() => resolve(true));
    });
  });
}

function spawnCommand(cmd, args, env) {
  if (process.platform !== "win32") {
    return spawn(cmd, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    });
  }

  const shell = process.env.ComSpec ?? "cmd.exe";
  const commandLine = [cmd, ...args].map(escapeForCmd).join(" ");
  return spawn(shell, ["/d", "/s", "/c", commandLine], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}

async function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("error", resolve);
      killer.on("exit", resolve);
    });
    return;
  }

  child.kill("SIGTERM");
}

function escapeForCmd(arg) {
  const text = String(arg);
  if (text.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(text)) return text;
  return `"${text.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
}
