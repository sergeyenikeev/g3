import { spawn } from "node:child_process";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, relative } from "node:path";
import { chromium } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

const outputDir = join(process.cwd(), "artifacts", "ui-audit", "matrix");
const profiles = [
  {
    id: "desktop",
    label: "Desktop 1600x900",
    viewport: { width: 1600, height: 900 },
    contextOptions: { deviceScaleFactor: 1 },
  },
  {
    id: "mobile",
    label: "Mobile 680x380",
    viewport: { width: 680, height: 380 },
    contextOptions: { deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  },
];
const locales = ["ru", "en"];
const manifest = [];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const server = spawnCommand("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
  ...process.env,
  VITE_PLATFORM_ADAPTER: "mock",
  VITE_E2E: "1",
});

try {
  await waitForHttp(baseURL, 30_000);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const locale of locales) {
      for (const profile of profiles) {
        await captureLocaleProfile(browser, locale, profile, manifest);
      }
    }
  } finally {
    await browser.close();
  }

  await writeGallery(manifest);
  console.log(`capture_ui_audit_matrix: OK -> ${outputDir}`);
} finally {
  server.kill("SIGTERM");
}

async function captureLocaleProfile(browser, locale, profile, auditManifest) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    ...profile.contextOptions,
  });

  try {
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.waitForSelector("canvas");

    const targetDir = join(outputDir, locale, profile.id);
    await mkdir(targetDir, { recursive: true });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeStarterSave(locale),
      shotId: "01_starter_menu",
      title: "Starter menu",
      targetDir,
      auditManifest,
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeGrowingSave(locale),
      shotId: "02_growing_menu",
      title: "Growing menu",
      targetDir,
      auditManifest,
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeGrowingSave(locale),
      shotId: "02b_growing_utility",
      title: "Growing utility panel",
      targetDir,
      auditManifest,
      overlay: "utility",
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeGrowingSave(locale),
      shotId: "03_growing_workshop",
      title: "Growing workshop",
      targetDir,
      auditManifest,
      overlay: "workshop",
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeGrowingSave(locale),
      shotId: "04_growing_leaderboard",
      title: "Growing leaderboard",
      targetDir,
      auditManifest,
      overlay: "leaderboard",
    });

    await captureRunFlow({
      page,
      locale,
      profile,
      save: makeGrowingSave(locale),
      targetDir,
      auditManifest,
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeAdvancedSave(locale),
      shotId: "08_advanced_menu",
      title: "Advanced menu",
      targetDir,
      auditManifest,
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeAdvancedSave(locale),
      shotId: "08b_advanced_utility",
      title: "Advanced utility panel",
      targetDir,
      auditManifest,
      overlay: "utility",
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeAdvancedSave(locale),
      shotId: "09_advanced_workshop",
      title: "Advanced workshop",
      targetDir,
      auditManifest,
      overlay: "workshop",
    });

    await captureMenuState({
      page,
      locale,
      profile,
      save: makeAdvancedSave(locale),
      shotId: "10_advanced_leaderboard",
      title: "Advanced leaderboard",
      targetDir,
      auditManifest,
      overlay: "leaderboard",
    });
  } finally {
    await context.close();
  }
}

async function captureMenuState({ page, locale, profile, save, shotId, title, targetDir, auditManifest, overlay = null }) {
  await seedSaveAndReload(page, save);
  await waitForScene(page, "menu");
  await page.waitForTimeout(250);

  if (overlay === "utility") {
    await clickTopRightMenuButton(page, profile.viewport.width);
    await page.waitForFunction(
      (expected) => {
        const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
        const texts = menu?.children?.list?.filter((obj) => obj?.type === "Text" && obj.visible) ?? [];
        return texts.some((obj) => String(obj.text ?? "").toLowerCase().includes(expected));
      },
      locale === "ru" ? "графика" : "gfx"
    );
    await page.waitForTimeout(250);
  }

  if (overlay === "workshop") {
    await page.evaluate(() => {
      const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
      menu?.showWorkshop?.();
    });
    await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.keys?.menu?.workshopBox?.visible === true);
    await page.waitForTimeout(250);
  }

  if (overlay === "leaderboard") {
    await page.evaluate(() => {
      const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
      menu?.showLeaderboard?.();
    });
    await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.keys?.menu?.leaderboardBox?.visible === true);
    await page.waitForTimeout(450);
  }

  const path = join(targetDir, `${shotId}.png`);
  await page.screenshot({ path });
  auditManifest.push({
    locale,
    profile: profile.id,
    profileLabel: profile.label,
    title,
    shotId,
    path,
  });
}

async function clickTopRightMenuButton(page, viewportWidth) {
  const target = await page.evaluate((width) => {
    const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
    if (!menu) return null;
    const texts = menu.children.list
      .filter((obj) => obj?.type === "Text" && obj.visible)
      .map((obj) => ({
        text: String(obj.text ?? ""),
        x: Number(obj.x ?? 0),
        y: Number(obj.y ?? 0),
      }))
      .filter((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y) && entry.y < 80 && entry.x > width * 0.6)
      .sort((a, b) => b.x - a.x);
    return texts[0] ?? null;
  }, viewportWidth);

  if (!target) {
    throw new Error("top-right menu button not found");
  }

  await page.mouse.click(target.x, target.y);
}

async function captureRunFlow({ page, locale, profile, save, targetDir, auditManifest }) {
  await seedSaveAndReload(page, save);
  await waitForScene(page, "menu");

  await page.evaluate(() => {
    const menu = globalThis.__MC_GAME__?.scene?.keys?.menu;
    void menu?.startDaily?.(false);
  });
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("ui") === true);
  await page.waitForTimeout(350);

  const uiPath = join(targetDir, "05_growing_ui.png");
  await page.screenshot({ path: uiPath });
  auditManifest.push({
    locale,
    profile: profile.id,
    profileLabel: profile.label,
    title: "Growing runtime HUD",
    shotId: "05_growing_ui",
    path: uiPath,
  });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.keys?.ui?.settingsVisible === true);
  await page.waitForTimeout(200);

  const settingsPath = join(targetDir, "06_growing_settings.png");
  await page.screenshot({ path: settingsPath });
  auditManifest.push({
    locale,
    profile: profile.id,
    profileLabel: profile.label,
    title: "Growing settings",
    shotId: "06_growing_settings",
    path: settingsPath,
  });

  await page.keyboard.press("Escape");
  await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.keys?.ui?.settingsVisible === false);

  await page.evaluate(() => {
    const gameScene = globalThis.__MC_GAME__?.scene?.keys?.game;
    gameScene?.onWaveComplete?.();
  });
  await waitForScene(page, "upgrade");
  await page.waitForTimeout(250);

  const upgradePath = join(targetDir, "07_growing_upgrade.png");
  await page.screenshot({ path: upgradePath });
  auditManifest.push({
    locale,
    profile: profile.id,
    profileLabel: profile.label,
    title: "Growing upgrade",
    shotId: "07_growing_upgrade",
    path: upgradePath,
  });

  await chooseUpgrade(page, profile.viewport.width, profile.viewport.height);
  await page.waitForFunction(() => typeof globalThis.__MC_E2E__?.endRun === "function");
  await page.evaluate(() => globalThis.__MC_E2E__.endRun());
  await waitForScene(page, "results");
  await page.waitForTimeout(300);

  const resultsPath = join(targetDir, "07b_growing_results.png");
  await page.screenshot({ path: resultsPath });
  auditManifest.push({
    locale,
    profile: profile.id,
    profileLabel: profile.label,
    title: "Growing results",
    shotId: "07b_growing_results",
    path: resultsPath,
  });
}

async function seedSaveAndReload(page, save) {
  await page.evaluate((payload) => {
    const raw = JSON.stringify(payload);
    globalThis.localStorage.setItem("magnet-caravan:save-mirror", raw);
    globalThis.localStorage.setItem("magnet-caravan:platform-save", raw);
    globalThis.window.location.reload();
  }, save);
  await page.waitForSelector("canvas");
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 15_000 }
  );
}

async function chooseUpgrade(page, width, height) {
  const targets = await page.evaluate(() => {
    const upgrade = globalThis.__MC_GAME__?.scene?.keys?.upgrade;
    const cards = Array.isArray(upgrade?.cards) ? upgrade.cards : [];
    return cards
      .filter((card) => card?.visible && card?.active)
      .map((card) => ({
        x: Number(card.x ?? 0),
        y: Number(card.y ?? 0),
      }))
      .filter((card) => Number.isFinite(card.x) && Number.isFinite(card.y))
      .sort((a, b) => a.y - b.y);
  });

  for (const target of targets) {
    await page.mouse.click(target.x, target.y);
    try {
      await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
        timeout: 1_500,
      });
      return;
    } catch {
      // try the next card
    }
  }

  throw new Error("Unable to dismiss upgrade scene during UI audit capture");
}

async function writeGallery(auditManifest) {
  const indexPath = join(outputDir, "index.html");
  const grouped = new Map();

  for (const entry of auditManifest) {
    const key = `${entry.locale}:${entry.profile}`;
    const current = grouped.get(key) ?? [];
    current.push(entry);
    grouped.set(key, current);
  }

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entries]) => {
      const [locale, profile] = key.split(":");
      const profileLabel = entries[0]?.profileLabel ?? profile;
      const cards = entries
        .map((entry) => {
          const src = relative(outputDir, entry.path).replaceAll("\\", "/");
          return `
            <figure class="shot">
              <img src="${src}" alt="${escapeHtml(entry.title)}" loading="lazy" />
              <figcaption><strong>${escapeHtml(entry.shotId)}</strong><span>${escapeHtml(entry.title)}</span></figcaption>
            </figure>
          `;
        })
        .join("\n");

      return `
        <section class="group">
          <h2>${escapeHtml(locale.toUpperCase())} · ${escapeHtml(profileLabel)}</h2>
          <div class="grid">
            ${cards}
          </div>
        </section>
      `;
    })
    .join("\n");

  await writeFile(
    indexPath,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Magnet Caravan UI Audit Matrix</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #071018;
        --panel: #10202c;
        --line: rgba(92, 200, 255, 0.24);
        --text: #d9f2ff;
        --muted: #98b7c7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 28px;
        background:
          radial-gradient(circle at top right, rgba(92, 200, 255, 0.08), transparent 24%),
          linear-gradient(180deg, #08111a, var(--bg));
        color: var(--text);
        font-family: Georgia, Cambria, "Times New Roman", serif;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 36px;
        line-height: 1;
      }
      .lead {
        margin: 0 0 24px;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.45;
      }
      .group {
        margin: 0 0 28px;
        padding: 18px;
        border: 1px solid var(--line);
        background: rgba(8, 17, 26, 0.82);
      }
      h2 {
        margin: 0 0 14px;
        font-size: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 14px;
      }
      .shot {
        margin: 0;
        border: 1px solid rgba(255, 209, 102, 0.24);
        background: var(--panel);
        overflow: hidden;
      }
      .shot img {
        display: block;
        width: 100%;
        height: auto;
        background: #020508;
      }
      figcaption {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px 12px;
        font-size: 13px;
      }
      figcaption span {
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <h1>Magnet Caravan UI Audit Matrix</h1>
    <p class="lead">Generated from the local mock platform build. The gallery covers staged menu disclosure, workshop, leaderboard, runtime HUD, settings, upgrade, and results in RU/EN across desktop and compact mobile viewports.</p>
    ${sections}
  </body>
</html>`,
    "utf8"
  );
}

function makeStarterSave(language = "ru") {
  const save = makeBaseSave(language);
  save.liveops.sessionsStarted = 1;
  save.stats.bestWave = 0;
  save.stats.bestBolts = 0;
  save.stats.runsCompleted = 0;
  save.tutorial.completed = false;
  save.tutorial.skipped = false;
  save.meta.wallet = { bolts: 36, cores: 0 };
  save.loginRewards = {
    lastClaimDateUtc: "2026-04-15",
    day: 1,
  };
  save.leaderboard.entries = [];
  save.liveops.weeklyLeaderboard.entries = [];
  return save;
}

function makeGrowingSave(language = "ru") {
  const save = makeBaseSave(language);
  save.tutorial.completed = true;
  save.stats.bestWave = 11;
  save.stats.bestBolts = 180;
  save.stats.runsCompleted = 4;
  save.meta.wallet = { bolts: 220, cores: 2 };
  save.loginRewards = {
    lastClaimDateUtc: "2026-04-16",
    day: 2,
  };
  save.liveops.sessionsStarted = 4;
  save.liveops.firstSeenDateUtc = "2026-04-10";
  save.liveops.lastSeenDateUtc = "2026-04-16";
  save.liveops.missions = {
    daily: {
      dateUtc: "2026-04-16",
      progress: {},
      claimedIds: [],
    },
    weekly: {
      weekKey: "2026-W16",
      progress: {},
      claimedIds: [],
    },
  };
  save.leaderboard.entries = createLeaderboardEntries(language, "growing");
  save.liveops.weeklyLeaderboard = {
    weekKey: "2026-W16",
    entries: createWeeklyEntries(language, "growing"),
    highestDivision: "scrapper",
    claimedRewardDivisions: [],
    claimedRewardWeekKeys: [],
  };
  return save;
}

function makeAdvancedSave(language = "ru") {
  const save = makeBaseSave(language);
  save.tutorial.completed = true;
  save.stats.bestWave = 24;
  save.stats.bestBolts = 760;
  save.stats.runsCompleted = 12;
  save.meta.nodeLevels = {
    meta_frame_1: 1,
    meta_core_1: 1,
    meta_coil_1: 1,
    meta_tail_1: 1,
    meta_salvage_routes: 1,
    meta_core_2: 1,
    meta_coil_2: 1,
    meta_frame_2: 1,
    meta_tail_2: 1,
    meta_dash_unlock: 1,
  };
  save.meta.wallet = { bolts: 890, cores: 7 };
  save.loginRewards = {
    lastClaimDateUtc: "2026-04-16",
    day: 6,
  };
  save.liveops.sessionsStarted = 12;
  save.liveops.firstSeenDateUtc = "2026-03-28";
  save.liveops.lastSeenDateUtc = "2026-04-16";
  save.liveops.streak = {
    day: 6,
    claimedDateUtc: "2026-04-16",
  };
  save.liveops.comeback = {
    lastClaimDateUtc: "2026-04-11",
    lastEligibleGapDays: 3,
  };
  save.liveops.missions = {
    daily: {
      dateUtc: "2026-04-16",
      progress: {
        daily_wave_10: 7,
        daily_flip_20: 12,
      },
      claimedIds: [],
    },
    weekly: {
      weekKey: "2026-W16",
      progress: {
        weekly_bank_12: 8,
        weekly_salvage_500: 286,
      },
      claimedIds: [],
    },
  };
  save.daily = {
    lastDateUtc: "2026-04-16",
    attemptsUsed: 0,
    bestWave: 13,
    bestBolts: 320,
  };
  save.leaderboard = {
    entries: createLeaderboardEntries(language, "advanced"),
    highestDivision: "elite",
    claimedRewardDivisions: ["raider", "ace"],
    claimedMilestones: ["score_25000"],
  };
  save.liveops.weeklyLeaderboard = {
    weekKey: "2026-W16",
    entries: createWeeklyEntries(language, "advanced"),
    highestDivision: "elite",
    claimedRewardDivisions: ["raider", "ace"],
    claimedRewardWeekKeys: [],
  };
  return save;
}

function makeBaseSave(language) {
  return {
    v: 1,
    settings: {
      sfxVolume: 0.8,
      musicVolume: 0.6,
      visualQuality: "auto",
      language,
      pilotName: language === "ru" ? "RIG-24" : "AXLE-7",
    },
    tutorial: {
      completed: true,
      skipped: false,
    },
    meta: {
      nodeLevels: {
        meta_frame_1: 1,
        meta_core_1: 1,
        meta_coil_1: 1,
      },
      wallet: {
        bolts: 120,
        cores: 1,
      },
    },
    stats: {
      bestWave: 0,
      bestBolts: 0,
      runsCompleted: 0,
    },
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
    loginRewards: {
      lastClaimDateUtc: "2026-04-16",
      day: 1,
    },
    liveops: {
      firstSeenDateUtc: "2026-04-16",
      lastSeenDateUtc: "2026-04-16",
      sessionsStarted: 1,
      lastReturnGapDays: 0,
      activation: {
        firstScrapTracked: true,
        firstBankTracked: true,
        firstUpgradeTracked: true,
      },
      onboarding: {
        freeBoostsUsed: 1,
      },
      streak: {
        day: 1,
        claimedDateUtc: "2026-04-16",
      },
      comeback: {
        lastClaimDateUtc: null,
        lastEligibleGapDays: 0,
      },
      missions: {
        daily: {
          dateUtc: "2026-04-16",
          progress: {},
          claimedIds: [],
        },
        weekly: {
          weekKey: "2026-W16",
          progress: {},
          claimedIds: [],
        },
      },
      claimedEventRewardIds: [],
      weeklyLeaderboard: {
        weekKey: "2026-W16",
        entries: [],
        highestDivision: "scrapper",
        claimedRewardDivisions: [],
        claimedRewardWeekKeys: [],
      },
    },
    daily: {
      lastDateUtc: "2026-04-16",
      attemptsUsed: 0,
      bestWave: 0,
      bestBolts: 0,
    },
    leaderboard: {
      entries: [],
      highestDivision: "raider",
      claimedRewardDivisions: [],
      claimedMilestones: [],
    },
  };
}

function createLeaderboardEntries(language, stage) {
  const pilot = language === "ru" ? "RIG-24" : "AXLE-7";
  if (stage === "advanced") {
    return [
      { id: "adv-run-1", pilot: "ION-9", score: 31800, wave: 25, mode: "run", createdAtMs: 1713224001000 },
      { id: "adv-run-2", pilot: pilot, score: 28640, wave: 24, mode: "run", createdAtMs: 1713224002000 },
      { id: "adv-run-3", pilot: "NOVA-3", score: 27420, wave: 22, mode: "run", createdAtMs: 1713224003000 },
      { id: "adv-daily-1", pilot: "MICA-6", score: 19800, wave: 19, mode: "daily", createdAtMs: 1713224004000 },
      { id: "adv-daily-2", pilot: "FLUX-8", score: 18420, wave: 18, mode: "daily", createdAtMs: 1713224005000 },
    ];
  }

  return [
    { id: "grow-run-1", pilot: "ION-9", score: 11840, wave: 12, mode: "run", createdAtMs: 1713224001000 },
    { id: "grow-run-2", pilot: pilot, score: 10420, wave: 11, mode: "run", createdAtMs: 1713224002000 },
    { id: "grow-daily-1", pilot: "NOVA-3", score: 9620, wave: 10, mode: "daily", createdAtMs: 1713224003000 },
  ];
}

function createWeeklyEntries(language, stage) {
  const pilot = language === "ru" ? "RIG-24" : "AXLE-7";
  if (stage === "advanced") {
    return [
      { id: "week-adv-1", pilot: "ION-9", score: 30200, wave: 24, mode: "run", createdAtMs: 1713224001000 },
      { id: "week-adv-2", pilot: pilot, score: 28640, wave: 24, mode: "run", createdAtMs: 1713224002000 },
      { id: "week-adv-3", pilot: "NOVA-3", score: 26410, wave: 21, mode: "run", createdAtMs: 1713224003000 },
    ];
  }

  return [
    { id: "week-grow-1", pilot: "ION-9", score: 11840, wave: 12, mode: "run", createdAtMs: 1713224001000 },
    { id: "week-grow-2", pilot: pilot, score: 10420, wave: 11, mode: "run", createdAtMs: 1713224002000 },
    { id: "week-grow-3", pilot: "NOVA-3", score: 9620, wave: 10, mode: "run", createdAtMs: 1713224003000 },
  ];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function escapeForCmd(arg) {
  const text = String(arg);
  if (text.length === 0) return '""';
  if (!/[\s"&<>|^%]/.test(text)) return text;
  return `"${text.replace(/[%"]/g, (m) => (m === "%" ? "%%" : '\\"'))}"`;
}
