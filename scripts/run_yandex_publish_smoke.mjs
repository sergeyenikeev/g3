import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { chromium } from "@playwright/test";
import { buildReleaseTarget, ensureReleaseDirs } from "./release_build_utils.mjs";

const rootDir = process.cwd();
const dirs = await ensureReleaseDirs(rootDir);
const reportDir = join(rootDir, "artifacts", "yandex-publish-pass");
const smokeOutDir = join(dirs.buildsDir, "yandex_smoke");

await rm(reportDir, { recursive: true, force: true });
await rm(smokeOutDir, { recursive: true, force: true });
await mkdir(reportDir, { recursive: true });

const release = await buildReleaseTarget("yandex", dirs, rootDir);
await buildSmokeBundle(smokeOutDir, rootDir);
await injectSdkMarkup(smokeOutDir);

const actualIndexPath = join(release.outDir, "index.html");
const actualIndexHtml = await readFile(actualIndexPath, "utf8");
const sdkTagInjected = actualIndexHtml.includes('src="/sdk.js"');

const host = "127.0.0.1";
const releasePort = await findAvailablePort(host, 4310, 4360);
const smokePort = await findAvailablePort(host, releasePort + 1, 4385);
const releaseUrl = `http://${host}:${releasePort}`;
const smokeUrl = `http://${host}:${smokePort}`;

const releaseServer = createStaticPreviewServer(release.outDir);
const smokeServer = createStaticPreviewServer(smokeOutDir);
await new Promise((resolve) => releaseServer.listen(releasePort, host, resolve));
await new Promise((resolve) => smokeServer.listen(smokePort, host, resolve));

const pageErrors = [];
const checks = [];
const evidence = [];

try {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });

    const releasePage = await context.newPage();
    wirePageDiagnostics(releasePage, "release", pageErrors);
    await installOneTimeStorageReset(releasePage, "__mc_yandex_publish_release_boot");
    await installYandexSdkRoute(releasePage);

    await releasePage.goto(releaseUrl, { waitUntil: "domcontentloaded" });
    await waitForCanvas(releasePage);
    await releasePage.waitForFunction(() => Number(globalThis.window.__YA_STUB_STATE__?.loadingReadyCalls ?? 0) >= 1);
    await releasePage.waitForTimeout(400);

    const releaseShot = join(reportDir, "00_release_menu_boot.png");
    await releasePage.screenshot({ path: releaseShot });
    evidence.push(releaseShot);

    const releaseStartupState = await releasePage.evaluate(() => ({
      fatalOverlay: Boolean(globalThis.document.getElementById("mc-fatal-overlay")),
      documentLang: globalThis.document.documentElement.lang || null,
      loadingReadyCalls: Number(globalThis.window.__YA_STUB_STATE__?.loadingReadyCalls ?? 0),
      hasCanvas: Boolean(globalThis.document.querySelector("canvas")),
      title: globalThis.document.title || null,
    }));

    await seedStubSaveAndReload(releasePage, makeLegacyBrokenSave("ru"), `${releaseUrl}?mc_bootdiag=1`);
    await waitForCanvas(releasePage);
    await releasePage.waitForTimeout(500);

    const recoveryShot = join(reportDir, "00b_release_recovery.png");
    await releasePage.screenshot({ path: recoveryShot });
    evidence.push(recoveryShot);

    const recoveryState = await releasePage.evaluate(() => {
      const rawReport = globalThis.localStorage.getItem("magnet_caravan.boot_report");
      let report = null;
      try {
        report = rawReport ? JSON.parse(rawReport) : null;
      } catch {
        report = null;
      }
      return {
        fatalOverlay: Boolean(globalThis.document.getElementById("mc-fatal-overlay")),
        documentLang: globalThis.document.documentElement.lang || null,
        loadingReadyCalls: Number(globalThis.window.__YA_STUB_STATE__?.loadingReadyCalls ?? 0),
        playerDataReads: Number(globalThis.window.__YA_STUB_STATE__?.playerDataReads ?? 0),
        hasCanvas: Boolean(globalThis.document.querySelector("canvas")),
        report,
      };
    });

    const smokePage = await context.newPage();
    wirePageDiagnostics(smokePage, "smoke", pageErrors);
    await installOneTimeStorageReset(smokePage, "__mc_yandex_publish_smoke_boot");
    await installYandexSdkRoute(smokePage);

    await smokePage.goto(smokeUrl, { waitUntil: "domcontentloaded" });
    await waitForCanvas(smokePage);
    await waitForScene(smokePage, "menu");
    await smokePage.waitForTimeout(500);

    const starterShot = join(reportDir, "01_starter_menu.png");
    await smokePage.screenshot({ path: starterShot });
    evidence.push(starterShot);

    const startupState = await smokePage.evaluate(() => {
      const fatalOverlay = Boolean(globalThis.document.getElementById("mc-fatal-overlay"));
      const stub = globalThis.window.__YA_STUB_STATE__;
      return {
        fatalOverlay,
        documentLang: globalThis.document.documentElement.lang || null,
        loadingReadyCalls: Number(stub?.loadingReadyCalls ?? 0),
        gameplayStartCalls: Number(stub?.gameplayStartCalls ?? 0),
        gameplayStopCalls: Number(stub?.gameplayStopCalls ?? 0),
        menuLocale: globalThis.window.__MC_GAME__?.registry?.get?.("locale") ?? null,
      };
    });

    const browserGuards = await smokePage.evaluate(() => {
      const canvas = globalThis.document.querySelector("canvas");
      const contextEvent = new globalThis.MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
      const selectionEvent = new globalThis.Event("selectstart", { bubbles: true, cancelable: true });
      canvas?.dispatchEvent(contextEvent);
      globalThis.document.body.dispatchEvent(selectionEvent);
      return {
        contextMenuPrevented: contextEvent.defaultPrevented,
        selectStartPrevented: selectionEvent.defaultPrevented,
      };
    });

    const postBootRuntimeErrorState = await smokePage.evaluate(() => {
      try {
        const event = new globalThis.ErrorEvent("error", {
          message: "Synthetic post-boot runtime smoke error",
          error: new Error("Synthetic post-boot runtime smoke error"),
        });
        globalThis.window.dispatchEvent(event);
      } catch {
        // ignore
      }

      const rawReport = globalThis.localStorage.getItem("magnet_caravan.boot_report");
      let report = null;
      try {
        report = rawReport ? JSON.parse(rawReport) : null;
      } catch {
        report = null;
      }

      return {
        fatalOverlay: Boolean(globalThis.document.getElementById("mc-fatal-overlay")),
        report,
      };
    });

    await smokePage.evaluate(() => {
      globalThis.window.__YA_STUB_API__?.emit?.("game_api_pause");
      globalThis.window.__YA_STUB_API__?.emit?.("game_api_resume");
    });
    await smokePage.waitForTimeout(150);

    const lifecycleState = await smokePage.evaluate(() => {
      const stub = globalThis.window.__YA_STUB_STATE__;
      return {
        fatalOverlay: Boolean(globalThis.document.getElementById("mc-fatal-overlay")),
        pauseEvents: Number(stub?.pauseEvents ?? 0),
        resumeEvents: Number(stub?.resumeEvents ?? 0),
      };
    });

    await seedStubSaveAndReload(smokePage, makeGrowingSave("ru"));
    await waitForScene(smokePage, "menu");
    await smokePage.waitForTimeout(350);

    await smokePage.evaluate(() => {
      const menu = globalThis.window.__MC_GAME__?.scene?.keys?.menu;
      void menu?.startDaily?.(false);
    });
    await waitForScene(smokePage, "ui");
    await smokePage.waitForTimeout(350);

    const gameplayShot = join(reportDir, "02_runtime_ui.png");
    await smokePage.screenshot({ path: gameplayShot });
    evidence.push(gameplayShot);

    await smokePage.evaluate(() => {
      const gameScene = globalThis.window.__MC_GAME__?.scene?.keys?.game;
      gameScene?.onWaveComplete?.();
    });
    await waitForScene(smokePage, "upgrade");
    await smokePage.waitForTimeout(300);

    const upgradeShot = join(reportDir, "03_upgrade.png");
    await smokePage.screenshot({ path: upgradeShot });
    evidence.push(upgradeShot);

    await chooseUpgrade(smokePage, 1600, 900);
    await smokePage.waitForFunction(() => typeof globalThis.window.__MC_E2E__?.endRun === "function");
    await smokePage.evaluate(() => globalThis.window.__MC_E2E__.endRun());
    await waitForScene(smokePage, "results");
    await smokePage.waitForTimeout(350);

    const resultsBeforeAd = join(reportDir, "04_results_before_rewarded.png");
    await smokePage.screenshot({ path: resultsBeforeAd });
    evidence.push(resultsBeforeAd);

    const rewardedVisible = await smokePage.evaluate(() => {
      const results = globalThis.window.__MC_GAME__?.scene?.keys?.results;
      return Boolean(results?.x2Btn?.visible);
    });

    if (rewardedVisible) {
      await smokePage.evaluate(() => {
        const results = globalThis.window.__MC_GAME__?.scene?.keys?.results;
        void results?.handleX2?.();
      });
      await smokePage.waitForFunction(() => Number(globalThis.window.__YA_STUB_STATE__?.rewardedCalls ?? 0) >= 1);
      await smokePage.waitForTimeout(250);
    }

    const resultsAfterAd = join(reportDir, "05_results_after_rewarded.png");
    await smokePage.screenshot({ path: resultsAfterAd });
    evidence.push(resultsAfterAd);

    const interstitialBeforeExit = await smokePage.evaluate(() => Number(globalThis.window.__YA_STUB_STATE__?.interstitialCalls ?? 0));

    await smokePage.evaluate(() => {
      const results = globalThis.window.__MC_GAME__?.scene?.keys?.results;
      void results?.exitTo?.("menu");
    });
    await waitForScene(smokePage, "menu");
    await smokePage.waitForTimeout(250);

    const interstitialBeforeManual = await smokePage.evaluate(() => Number(globalThis.window.__YA_STUB_STATE__?.interstitialCalls ?? 0));
    await smokePage.evaluate(async () => {
      const adapter = globalThis.window.__MC_GAME__?.registry?.get("platformAdapter");
      return await adapter?.showInterstitial?.();
    });
    await smokePage.waitForFunction((before) => Number(globalThis.window.__YA_STUB_STATE__?.interstitialCalls ?? 0) > before, interstitialBeforeManual);
    await smokePage.waitForTimeout(100);

    const finalState = await smokePage.evaluate(() => {
      const stub = globalThis.window.__YA_STUB_STATE__;
      return {
        loadingReadyCalls: Number(stub?.loadingReadyCalls ?? 0),
        gameplayStartCalls: Number(stub?.gameplayStartCalls ?? 0),
        gameplayStopCalls: Number(stub?.gameplayStopCalls ?? 0),
        rewardedCalls: Number(stub?.rewardedCalls ?? 0),
        interstitialCalls: Number(stub?.interstitialCalls ?? 0),
      };
    });

    checks.push(check("SDK script injected into release index.html", sdkTagInjected, actualIndexPath));
    checks.push(check("Release Yandex bundle boots without fatal overlay", !releaseStartupState.fatalOverlay && releaseStartupState.hasCanvas, releaseShot));
    checks.push(check("Release bundle sends LoadingAPI.ready on startup", releaseStartupState.loadingReadyCalls >= 1, releaseShot));
    checks.push(
      check(
        "Release bundle honors the platform language hint during boot",
        releaseStartupState.documentLang === "ru" && releaseStartupState.title === "Magnet Caravan",
        `document.lang=${releaseStartupState.documentLang}, title=${releaseStartupState.title}`
      )
    );
    checks.push(
      check(
        "Release bundle recovers from a failing platform save by bypassing cloud data once",
        !recoveryState.fatalOverlay &&
          recoveryState.hasCanvas &&
          recoveryState.playerDataReads >= 1 &&
          recoveryState.report?.status === "recovered" &&
          recoveryState.report?.recoveredFromPlatformSave === true &&
          recoveryState.report?.recoveryAttempted === true &&
          recoveryState.report?.stage === "save-load",
        recoveryState.report ? JSON.stringify(recoveryState.report) : "missing boot report"
      )
    );
    checks.push(check("AUTO smoke build boots without fatal overlay", !startupState.fatalOverlay, starterShot));
    checks.push(
      check(
        "Platform locale hint overrides browser locale on the AUTO smoke build",
        startupState.documentLang === "ru" && startupState.menuLocale === "ru",
        `document.lang=${startupState.documentLang}, menuLocale=${startupState.menuLocale}`
      )
    );
    checks.push(check("LoadingAPI.ready is called on the AUTO smoke build", startupState.loadingReadyCalls >= 1, starterShot));
    checks.push(check("Browser context menu is prevented on the playfield", browserGuards.contextMenuPrevented, starterShot));
    checks.push(check("Browser text selection is prevented on the playfield", browserGuards.selectStartPrevented, starterShot));
    checks.push(
      check(
        "Post-boot global runtime errors are logged without showing the fatal startup overlay",
        !postBootRuntimeErrorState.fatalOverlay &&
          postBootRuntimeErrorState.report?.stage === "menu-start" &&
          postBootRuntimeErrorState.report?.status === "fatal",
        postBootRuntimeErrorState.report ? JSON.stringify(postBootRuntimeErrorState.report) : "missing runtime report"
      )
    );
    checks.push(
      check(
        "Yandex stub pause/resume events can be emitted against the AUTO smoke build",
        !lifecycleState.fatalOverlay && lifecycleState.pauseEvents >= 1 && lifecycleState.resumeEvents >= 1,
        JSON.stringify(lifecycleState)
      )
    );
    checks.push(check("GameplayAPI.start is called during a run", finalState.gameplayStartCalls >= 1, gameplayShot));
    checks.push(check("GameplayAPI.stop is called for pauses/results", finalState.gameplayStopCalls >= 1, resultsBeforeAd));
    checks.push(check("Rewarded flow can be completed from the results screen", finalState.rewardedCalls >= (rewardedVisible ? 1 : 0), resultsAfterAd));
    checks.push(check("Results exit returns to menu without fatal errors", true, starterShot));
    checks.push(
      check(
        "Interstitial SDK path can be completed on the Yandex adapter",
        finalState.interstitialCalls > interstitialBeforeManual,
        `before exit: ${interstitialBeforeExit}, before manual smoke: ${interstitialBeforeManual}, final: ${finalState.interstitialCalls}`
      )
    );
    checks.push(check("No runtime page errors were captured during smoke", pageErrors.length === 0, pageErrors.length > 0 ? pageErrors.join(" | ") : "none"));

    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  await new Promise((resolve) => releaseServer.close(resolve));
  await new Promise((resolve) => smokeServer.close(resolve));
}

const reportPath = join(reportDir, "report.md");
await writeFile(
  reportPath,
  buildReport({
    releaseZip: release.zipPath,
    releaseIndexPath: actualIndexPath,
    smokeDir: smokeOutDir,
    releaseUrl,
    smokeUrl,
    checks,
    evidence,
    pageErrors,
  }),
  "utf8"
);

console.log(`yandex_publish_smoke: OK -> ${reportPath}`);

function createStaticPreviewServer(root) {
  return createHttpServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new globalThis.URL(req.url ?? "/", "http://localhost").pathname);
      let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      relativePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
      const filePath = join(root, relativePath);
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, { "content-type": getContentType(filePath) });
      res.end(await readFile(filePath));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}

async function installOneTimeStorageReset(page, sessionKey) {
  await page.addInitScript((key) => {
    try {
      if (!globalThis.sessionStorage.getItem(key)) {
        globalThis.localStorage.clear();
        globalThis.sessionStorage.setItem(key, "1");
      }
    } catch {
      // ignore
    }
  }, sessionKey);
}

async function installYandexSdkRoute(page) {
  await page.route("**/sdk.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: buildYandexSdkStub(),
    });
  });
}

function wirePageDiagnostics(page, label, pageErrors) {
  page.on("pageerror", (error) => pageErrors.push(`${label}: ${String(error?.message ?? error)}`));
}

function buildYandexSdkStub() {
  return `
(function () {
  const storage = window.localStorage;
  const playerIdKey = "__mc_ya_stub_player_id";
  const playerDataPrefix = "__mc_ya_stub_player_data:";
  const leaderboardsPrefix = "__mc_ya_stub_leaderboard:";
  const languageKey = "__mc_ya_stub_lang";
  const listeners = new Map();

  function getCurrentPlayerId() {
    const value = storage.getItem(playerIdKey);
    return value && value.length > 0 ? value : "stub-player";
  }

  function getPlayerDataKey(playerId) {
    return playerDataPrefix + playerId;
  }

  function readJson(key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const state = (window.__YA_STUB_STATE__ = window.__YA_STUB_STATE__ || {
    loadingReadyCalls: 0,
    gameplayStartCalls: 0,
    gameplayStopCalls: 0,
    rewardedCalls: 0,
    interstitialCalls: 0,
    pauseEvents: 0,
    resumeEvents: 0,
    playerDataReads: 0,
    playerId: getCurrentPlayerId(),
  });

  const api = (window.__YA_STUB_API__ = window.__YA_STUB_API__ || {});
  api.emit = (eventName) => {
    if (eventName === "game_api_pause") state.pauseEvents += 1;
    if (eventName === "game_api_resume") state.resumeEvents += 1;
    const handlers = listeners.get(eventName);
    if (!handlers) return;
    for (const listener of Array.from(handlers)) {
      try {
        listener();
      } catch {
        // ignore
      }
    }
  };
  api.setLanguage = (lang) => {
    storage.setItem(languageKey, String(lang || "ru"));
  };
  api.setPlayerId = (playerId) => {
    storage.setItem(playerIdKey, String(playerId || "stub-player"));
    state.playerId = getCurrentPlayerId();
    return state.playerId;
  };
  api.setPlayerData = (data, playerId) => {
    const targetId = String(playerId || getCurrentPlayerId());
    storage.setItem(getPlayerDataKey(targetId), JSON.stringify(data));
  };
  api.getPlayerData = (playerId) => readJson(getPlayerDataKey(String(playerId || getCurrentPlayerId())));
  api.clearPlayerData = (playerId) => {
    const targetId = String(playerId || getCurrentPlayerId());
    storage.removeItem(getPlayerDataKey(targetId));
  };
  api.openAccountSelection = (nextPlayerId) => {
    api.emit("account_open");
    if (nextPlayerId) api.setPlayerId(nextPlayerId);
    api.emit("account_close");
  };

  const player = {
    async getData() {
      state.playerDataReads += 1;
      const data = api.getPlayerData();
      if (data && data.__smokeThrowOnRead) {
        throw new Error("Legacy platform save failed to deserialize");
      }
      return data;
    },
    async setData(data) {
      api.setPlayerData(data);
      return null;
    },
    getUniqueID() {
      return getCurrentPlayerId();
    },
    getID() {
      return getCurrentPlayerId();
    },
  };

  const ysdk = {
    adv: {
      showFullscreenAdv(opts) {
        state.interstitialCalls += 1;
        setTimeout(() => opts?.callbacks?.onClose?.(true), 30);
      },
      showRewardedVideo(opts) {
        state.rewardedCalls += 1;
        setTimeout(() => opts?.callbacks?.onRewarded?.(), 20);
        setTimeout(() => opts?.callbacks?.onClose?.(true), 40);
      },
    },
    environment: {
      i18n: {
        lang: storage.getItem(languageKey) || "ru",
        tld: "ru",
      },
      app: {
        id: "magnet-caravan-smoke",
      },
      payload: "",
    },
    features: {
      GameplayAPI: {
        start() {
          state.gameplayStartCalls += 1;
        },
        stop() {
          state.gameplayStopCalls += 1;
        },
      },
      LoadingAPI: {
        ready() {
          state.loadingReadyCalls += 1;
        },
      },
    },
    async getPlayer() {
      state.playerId = getCurrentPlayerId();
      return player;
    },
    async getLeaderboards() {
      return {
        async setLeaderboardScore(name, score) {
          const key = leaderboardsPrefix + name;
          const current = Number.parseInt(storage.getItem(key) || "0", 10);
          storage.setItem(key, String(Math.max(current || 0, Math.floor(score || 0))));
        },
        async getLeaderboardEntries(name) {
          const key = leaderboardsPrefix + name;
          const score = Number.parseInt(storage.getItem(key) || "0", 10);
          const entries = score > 0 ? [{ rank: 1, score, player: { publicName: "AXLE-7" } }] : [];
          return {
            entries,
            userRank: score > 0 ? 1 : null,
            userScore: score > 0 ? score : null,
          };
        },
      };
    },
    on(eventName, listener) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(listener);
      return () => listeners.get(eventName)?.delete(listener);
    },
    off(eventName, listener) {
      listeners.get(eventName)?.delete(listener);
    },
    serverTime() {
      return Date.now();
    },
    EVENTS: {
      ACCOUNT_SELECTION_DIALOG_OPENED: "account_open",
      ACCOUNT_SELECTION_DIALOG_CLOSED: "account_close",
    },
  };

  window.YaGames = {
    async init() {
      return ysdk;
    },
  };
})();
`;
}

async function buildSmokeBundle(outDir, cwd) {
  await run(
    "npx",
    ["vite", "build", "--outDir", outDir],
    {
      ...process.env,
      VITE_PLATFORM_ADAPTER: "yandex",
      VITE_SMOKE_TEST: "1",
    },
    cwd
  );
}

async function injectSdkMarkup(outDir) {
  const indexPath = join(outDir, "index.html");
  let html = await readFile(indexPath, "utf8");
  if (html.includes('src="/sdk.js"')) return;
  html = html.replace('<script type="module"', '<!-- Yandex Games SDK -->\n    <script async src="/sdk.js"></script>\n    <script type="module"');
  await writeFile(indexPath, html, "utf8");
}

async function seedStubSaveAndReload(page, save, nextUrl = null) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.evaluate(
      ({ payload, url }) => {
        globalThis.window.__YA_STUB_API__?.setPlayerData?.(payload);
        globalThis.window.__YA_STUB_API__?.setLanguage?.(String(payload?.settings?.language ?? "ru"));
        if (url) globalThis.window.location.href = url;
        else globalThis.window.location.reload();
      },
      { payload: save, url: nextUrl }
    ),
  ]);
}

async function waitForCanvas(page) {
  await page.waitForSelector("canvas", { timeout: 15_000 });
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.window.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 15_000 }
  );
}

async function chooseUpgrade(page, width, height) {
  const clickTargets = [0.49, 0.36, 0.58];
  for (const ratio of clickTargets) {
    await page.mouse.click(width / 2, Math.round(height * ratio));
    try {
      await page.waitForFunction(() => globalThis.window.__MC_GAME__?.scene?.isActive("upgrade") === false, null, { timeout: 1_500 });
      return;
    } catch {
      // try the next target
    }
  }

  throw new Error("Unable to dismiss upgrade scene during Yandex publish smoke");
}

function check(label, ok, details) {
  return { label, ok, details };
}

function buildReport({ releaseZip, releaseIndexPath, smokeDir, releaseUrl, smokeUrl, checks, evidence, pageErrors }) {
  const evidenceList = evidence.map((item) => `- ${item}`).join("\n");
  const summaryLines = checks
    .map((item) => {
      const prefix = `- ${item.ok ? "PASS" : "FAIL"}: ${item.label}`;
      return item.details ? `${prefix} - ${item.details}` : prefix;
    })
    .join("\n");
  const errorsSection = pageErrors.length > 0 ? pageErrors.map((item) => `- ${item}`).join("\n") : "- none";

  return `# Yandex Publish Smoke

Generated: ${new Date().toISOString()}

## Build Targets
- Release zip: ${releaseZip}
- Release index: ${releaseIndexPath}
- AUTO smoke preview dir: ${smokeDir}
- Release preview URL: ${releaseUrl}
- AUTO smoke preview URL: ${smokeUrl}

## Automated Checks
${summaryLines}

## Evidence
${evidenceList}

## Runtime Errors
${errorsSection}

## Moderation Mapping
- Release startup stability: verified on the production Yandex bundle with routed SDK stubs.
- Cloud-save recovery: verified on the production Yandex bundle through a failing platform save followed by automatic safe recovery.
- Runtime interaction coverage: verified on the AUTO smoke build with exposed automation hooks and routed SDK stubs.
- Browser interaction guards: verified through synthetic contextmenu/selectstart prevention checks.
- Rewarded and interstitial flows: verified through results-screen interaction on the AUTO smoke build.
`;
}

function makeGrowingSave(language = "ru") {
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
        bolts: 220,
        cores: 2,
      },
    },
    stats: {
      bestWave: 11,
      bestBolts: 180,
      runsCompleted: 4,
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
      day: 2,
    },
    liveops: {
      firstSeenDateUtc: "2026-04-10",
      lastSeenDateUtc: "2026-04-16",
      sessionsStarted: 4,
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
        day: 2,
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

function makeLegacyBrokenSave(language = "ru") {
  return {
    ...makeGrowingSave(language),
    __smokeThrowOnRead: true,
    legacyProfileVersion: 0,
    legacyDailyStats: {
      bestStreak: 2,
      totalAttempts: 5,
    },
    legacyInventory: {
      scrap: 999,
      magnets: 3,
    },
  };
}

async function findAvailablePort(hostname, startPort, endPort) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await canListen(hostname, port)) return port;
  }
  throw new Error(`No free port found in range ${startPort}-${endPort}`);
}

function canListen(hostname, port) {
  return new Promise((resolve) => {
    const server = createNetServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: hostname, port }, () => {
      server.close(() => resolve(true));
    });
  });
}

function run(cmd, args, env = process.env, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(cmd, args, env, cwd);
    child.on("error", reject);
    child.on("exit", (code) => {
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

function getContentType(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "application/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
}
