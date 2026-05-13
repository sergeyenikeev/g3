import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

if (!ffmpegPath) {
  throw new Error("ffmpeg-static: ffmpeg path not found");
}

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const preferredPort = Number(process.env.PLAYWRIGHT_PORT ?? 4180);
const port = await findAvailablePort(host, preferredPort, preferredPort + 50);
const baseURL = `http://${host}:${port}`;

const rootDir = process.cwd();
const artifactDir = join(rootDir, "artifacts", "yandex-promo-media");
const framesDir = join(artifactDir, "frames");
const outputDir = join(rootDir, "docs", "promo", "yandex", "video");
const UTF8_BOM = "\uFEFF";

const sourceVideo = join(artifactDir, "gameplay_source_1280x720.mp4");
const outputs = {
  gameplayHorizontal: join(outputDir, "gameplay_1920x1080.mp4"),
  gameplayVertical: join(outputDir, "gameplay_vertical_1080x1920.mp4"),
  gameplayGif: join(outputDir, "gameplay_16x9_hq.gif"),
  adHorizontal: join(outputDir, "ad_horizontal_1920x1080.mp4"),
  adVertical: join(outputDir, "ad_vertical_1080x1920.mp4"),
  manifest: join(outputDir, "manifest.json"),
  readme: join(outputDir, "README.md"),
};

const capture = {
  width: 1280,
  height: 720,
  fps: positiveInt(process.env.PROMO_CAPTURE_FPS, 15),
  durationSec: positiveInt(process.env.PROMO_CAPTURE_SECONDS, 18),
};
const gifSettings = {
  width: positiveInt(process.env.PROMO_GIF_WIDTH, 800),
  fps: positiveInt(process.env.PROMO_GIF_FPS, 10),
  durationSec: positiveInt(process.env.PROMO_GIF_SECONDS, 6),
  colors: positiveInt(process.env.PROMO_GIF_COLORS, 160),
};

await rm(artifactDir, { recursive: true, force: true });
await rm(outputDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

const server = spawnCommand("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
  ...process.env,
  VITE_PLATFORM_ADAPTER: "mock",
  VITE_E2E: "1",
});

try {
  await waitForHttp(baseURL, 30_000);
  await captureGameplayFrames(baseURL);
  await encodeSourceVideo();
  await encodeGameplayVideo();
  await encodeGameplayVertical();
  await encodePromoHorizontal();
  await encodePromoVertical();
  await encodeGameplayGif();
  await writeManifest();
  await writeReadme();
  console.log(`capture_yandex_promo_media: OK -> ${outputDir}`);
} finally {
  await stopProcessTree(server);
}

async function captureGameplayFrames(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
  });

  const context = await browser.newContext({
    locale: "ru-RU",
    viewport: { width: capture.width, height: capture.height },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  try {
    await page.addInitScript(() => globalThis.localStorage.clear());
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("canvas");
    await waitForScene(page, "menu");
    await page.waitForTimeout(700);
    await startDailyRun(page);
    await waitForScene(page, "ui");
    await page.waitForTimeout(700);
    await keepCaptureInGameplay(page);

    const totalFrames = capture.fps * capture.durationSec;
    const heldKeys = new Set();
    const startedAt = Date.now();

    for (let frame = 0; frame < totalFrames; frame += 1) {
      const t = frame / capture.fps;
      await keepCaptureInGameplay(page);
      await holdMovementKeys(page, heldKeys, movementKeysAt(t));

      if (frame % Math.max(1, Math.round(capture.fps * 1.6)) === Math.round(capture.fps * 0.5)) {
        await page.keyboard.press("Space");
      }
      if (frame % Math.max(1, Math.round(capture.fps * 4.2)) === Math.round(capture.fps * 2.1)) {
        await page.keyboard.press("Shift");
      }
      if (frame % capture.fps === 0) {
        await seedShowcaseMoment(page, Math.floor(t));
      }
      if (frame % Math.max(1, Math.round(capture.fps / 3)) === 0) {
        await dismissUpgradeIfPresent(page);
      }

      await keepCaptureInGameplay(page);
      await page.screenshot({
        path: join(framesDir, `gameplay_${String(frame).padStart(4, "0")}.jpg`),
        type: "jpeg",
        quality: 88,
      });

      const nextFrameAt = startedAt + ((frame + 1) / capture.fps) * 1000;
      const waitMs = nextFrameAt - Date.now();
      if (waitMs > 0) await page.waitForTimeout(waitMs);
    }

    await holdMovementKeys(page, heldKeys, []);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function startDailyRun(page) {
  await page.evaluate(() => {
    const game = globalThis.__MC_GAME__;
    const menu = game?.scene?.keys?.menu;
    if (menu && typeof menu.startDaily === "function") {
      void menu.startDaily(false);
      return;
    }
    game?.scene?.start?.("game", { mode: "daily" });
    game?.scene?.launch?.("ui");
  });
}

async function keepCaptureInGameplay(page) {
  const status = await page.evaluate(() => {
    const game = globalThis.__MC_GAME__;
    if (!game?.scene) return { restarted: false };

    const stopIfActive = (key) => {
      if (game.scene.isActive?.(key)) game.scene.stop?.(key);
    };

    stopIfActive("results");
    stopIfActive("upgrade");

    let restarted = false;
    if (game.scene.isPaused?.("game")) {
      game.scene.resume?.("game");
    } else if (!game.scene.isActive?.("game")) {
      game.scene.stop?.("ui");
      game.scene.start?.("game", { mode: "run" });
      game.scene.launch?.("ui");
      restarted = true;
    }

    if (!game.scene.isActive?.("ui")) game.scene.launch?.("ui");

    const scene = game.scene.keys?.game;
    const ui = game.scene.keys?.ui;
    const hpMax = scene?.state?.config?.player?.hpMax;
    if (typeof hpMax === "number") {
      scene.state.hp = hpMax;
      scene.state.recentHits = [];
    }
    if (scene) {
      scene.revivePending = false;
      scene.reviveOffered = false;
      scene.playerInvuln = Math.max(scene.playerInvuln ?? 0, 10);
      if (scene.state) scene.state.deathReason = "";
      try {
        scene.physics?.world?.resume?.();
      } catch {
        // Best effort only: this script must not affect the runtime outside capture.
      }
      try {
        if (scene.time) scene.time.paused = false;
      } catch {
        // Best effort only.
      }
    }
    if (ui) {
      ui.modalActive = false;
      ui.reviveBusy = false;
      ui.reviveBox?.setVisible?.(false);
      ui.settingsBox?.setVisible?.(false);
      ui.settingsVisible = false;
    }

    return { restarted };
  });

  if (status?.restarted) {
    await waitForScene(page, "ui");
    await page.waitForTimeout(220);
  }
}

async function holdMovementKeys(page, heldKeys, nextKeys) {
  const next = new Set(nextKeys);
  for (const key of heldKeys) {
    if (!next.has(key)) {
      await page.keyboard.up(key);
      heldKeys.delete(key);
    }
  }
  for (const key of next) {
    if (!heldKeys.has(key)) {
      await page.keyboard.down(key);
      heldKeys.add(key);
    }
  }
}

function movementKeysAt(t) {
  const segment = Math.floor(t / 1.4) % 8;
  switch (segment) {
    case 0:
      return ["ArrowUp"];
    case 1:
      return ["ArrowUp", "ArrowRight"];
    case 2:
      return ["ArrowRight"];
    case 3:
      return ["ArrowDown", "ArrowRight"];
    case 4:
      return ["ArrowDown"];
    case 5:
      return ["ArrowDown", "ArrowLeft"];
    case 6:
      return ["ArrowLeft"];
    default:
      return ["ArrowUp", "ArrowLeft"];
  }
}

async function seedShowcaseMoment(page, tick) {
  await page.evaluate((moment) => {
    const scene = globalThis.__MC_GAME__?.scene?.keys?.game;
    const player = scene?.player;
    if (!scene || !player) return;

    const hpMax = scene.state?.config?.player?.hpMax;
    if (typeof hpMax === "number") scene.state.hp = hpMax;
    scene.playerInvuln = Math.max(scene.playerInvuln ?? 0, 10);

    const baseAngle = moment * 0.73;
    for (let i = 0; i < 8; i += 1) {
      const a = baseAngle + (Math.PI * 2 * i) / 8;
      const r = 110 + (i % 3) * 45;
      const x = player.x + Math.cos(a) * r;
      const y = player.y + Math.sin(a) * r;
      const type = i % 5 === 0 ? "rareShard" : i % 3 === 0 ? "heavy" : "common";
      scene.spawnScrapAt?.(x, y, type);
    }

    if (moment % 2 === 0) {
      const a = baseAngle + Math.PI * 0.35;
      scene.spawnEnemy?.("chaser", player.x + Math.cos(a) * 420, player.y + Math.sin(a) * 420);
    }
    if (moment % 3 === 1) {
      const a = baseAngle - Math.PI * 0.2;
      scene.spawnEnemy?.("shooter", player.x + Math.cos(a) * 500, player.y + Math.sin(a) * 500);
    }
  }, tick);
}

async function dismissUpgradeIfPresent(page) {
  const active = await page.evaluate(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === true);
  if (!active) return;
  await chooseUpgrade(page, capture.width, capture.height);
}

async function chooseUpgrade(page, width, height) {
  const clickTargets = [0.36, 0.51, 0.67, 0.42, 0.58];
  for (const ratio of clickTargets) {
    await page.mouse.click(width / 2, Math.round(height * ratio));
    try {
      await page.waitForFunction(() => globalThis.__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
        timeout: 1_200,
      });
      await page.waitForTimeout(160);
      return;
    } catch {
      // Try another likely card location.
    }
  }
}

async function encodeSourceVideo() {
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-framerate",
    String(capture.fps),
    "-i",
    join(framesDir, "gameplay_%04d.jpg"),
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=44100`,
    "-shortest",
    "-vf",
    "scale=1280:720:flags=lanczos,setsar=1,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    sourceVideo,
  ]);
}

async function encodeGameplayVideo() {
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourceVideo,
    "-vf",
    "scale=1920:1080:flags=lanczos,setsar=1,fps=30,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputs.gameplayHorizontal,
  ]);
}

async function encodeGameplayVertical() {
  const fullFrameFilter = [
    "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos",
    "crop=1080:1920",
    "eq=brightness=0.04:contrast=1.05:saturation=1.06",
    "fade=t=in:st=0:d=0.25",
    `fade=t=out:st=${Math.max(0, capture.durationSec - 0.45)}:d=0.45`,
    "setsar=1",
    "fps=30",
    "format=yuv420p",
  ].join(",");

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourceVideo,
    "-vf",
    fullFrameFilter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputs.gameplayVertical,
  ]);
  if (process.env.PROMO_KEEP_LEGACY_VERTICAL === "1") {

  const backgroundChain =
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=18,eq=brightness=-0.18:saturation=0.9[bg]";
  const foregroundChain = "[0:v]scale=1080:-2:flags=lanczos[fg]";
  const composedChain = [
    "[bg][fg]overlay=(W-w)/2:(H-h)/2",
    "drawbox=x=0:y=0:w=iw:h=320:color=black@0.32:t=fill",
    "drawbox=x=0:y=1600:w=iw:h=320:color=black@0.34:t=fill",
    drawText("Magnet", "(w-text_w)/2", 112, 72, "0xD9F2FF", "arialbd.ttf"),
    drawText("Caravan", "(w-text_w)/2", 194, 72, "0xD9F2FF", "arialbd.ttf"),
    drawText("вертикальное видео игрового процесса", "(w-text_w)/2", 1642, 40, "0x7FDFFF", "arialbd.ttf"),
    drawText("собирай лом и переживи волну", "(w-text_w)/2", 1704, 42, "0xFFFFFF", "arialbd.ttf"),
    "fade=t=in:st=0:d=0.35",
    `fade=t=out:st=${Math.max(0, capture.durationSec - 0.55)}:d=0.55`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");
  const filter = [backgroundChain, foregroundChain, composedChain].join(";");

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourceVideo,
    "-filter_complex",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputs.gameplayVertical,
  ]);
  }
}

async function encodePromoHorizontal() {
  const filter = [
    "scale=1920:1080:flags=lanczos",
    "drawbox=x=0:y=0:w=iw:h=148:color=black@0.36:t=fill:enable='between(t,0,4.2)'",
    "drawbox=x=0:y=ih-128:w=iw:h=128:color=black@0.34:t=fill",
    drawText("Magnet Caravan", 74, 42, 54, "0xD9F2FF", "arialbd.ttf", "between(t,0,4.2)"),
    drawText("Переверни поле. Сдай лом. Переживи натиск.", 78, 108, 30, "0x7FDFFF", "arialbd.ttf", "between(t,0,4.2)"),
    drawText("Собирай металл магнитным караваном", "(w-text_w)/2", "h-92", 36, "0xFFFFFF", "arialbd.ttf", "between(t,0,5.8)"),
    drawText("Включай импульс и выбирай улучшения", "(w-text_w)/2", "h-92", 36, "0xFFD166", "arialbd.ttf", "between(t,6,11.8)"),
    drawText("Выдержи ещё одну волну", "(w-text_w)/2", "h-92", 36, "0x8BE3BC", "arialbd.ttf", "between(t,12,18.3)"),
    "fade=t=in:st=0:d=0.35",
    `fade=t=out:st=${Math.max(0, capture.durationSec - 0.55)}:d=0.55`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourceVideo,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "21",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputs.adHorizontal,
  ]);
}

async function encodePromoVertical() {
  const backgroundChain =
    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=18,eq=brightness=-0.17:saturation=0.92[bg]";
  const foregroundChain = "[0:v]scale=1080:-2:flags=lanczos[fg]";
  const composedChain = [
    "[bg][fg]overlay=(W-w)/2:620",
    "drawbox=x=0:y=0:w=iw:h=354:color=black@0.35:t=fill",
    "drawbox=x=0:y=1508:w=iw:h=412:color=black@0.37:t=fill",
    drawText("Magnet", "(w-text_w)/2", 120, 78, "0xD9F2FF", "arialbd.ttf"),
    drawText("Caravan", "(w-text_w)/2", 206, 78, "0xD9F2FF", "arialbd.ttf"),
    drawText("магнитная аркада на выживание", "(w-text_w)/2", 318, 38, "0x7FDFFF", "arialbd.ttf"),
    drawText("Собирай лом", "(w-text_w)/2", 1572, 58, "0xFFFFFF", "arialbd.ttf", "between(t,0,5.8)"),
    drawText("Отталкивай угрозы", "(w-text_w)/2", 1572, 58, "0xFFD166", "arialbd.ttf", "between(t,6,11.8)"),
    drawText("Выживи в новой волне", "(w-text_w)/2", 1572, 58, "0x8BE3BC", "arialbd.ttf", "between(t,12,18.3)"),
    drawText("Запускай новый забег", "(w-text_w)/2", 1660, 38, "0xD9F2FF", "arialbd.ttf"),
    "fade=t=in:st=0:d=0.35",
    `fade=t=out:st=${Math.max(0, capture.durationSec - 0.55)}:d=0.55`,
    "setsar=1",
    "format=yuv420p",
  ].join(",");
  const filter = [
    backgroundChain,
    foregroundChain,
    composedChain,
  ].join(";");

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    sourceVideo,
    "-filter_complex",
    filter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    outputs.adVertical,
  ]);
}

async function encodeGameplayGif() {
  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    "1.0",
    "-t",
    String(Math.min(gifSettings.durationSec, capture.durationSec)),
    "-i",
    sourceVideo,
    "-vf",
    `fps=${gifSettings.fps},scale=${gifSettings.width}:-2:flags=lanczos,eq=brightness=0.06:contrast=1.08:saturation=1.08,split[s0][s1];[s0]palettegen=max_colors=${gifSettings.colors}:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
    "-loop",
    "0",
    outputs.gameplayGif,
  ]);
}

async function writeManifest() {
  const media = {
    generatedAt: new Date().toISOString(),
    source: {
      path: normalizePath(sourceVideo),
      capture,
      note: "Источник записан из реального игрового процесса в локальной тестовой сборке для Яндекс Игр.",
    },
    files: {
      gameplayVideo: await describeFile(outputs.gameplayHorizontal, {
        purpose: "Видео игрового процесса",
        format: "MP4/H.264/AAC",
        dimensions: "1920x1080",
        aspectRatio: "16:9",
        durationSec: capture.durationSec,
      }),
      gameplayVertical: await describeFile(outputs.gameplayVertical, {
        purpose: "Вертикальное видео игрового процесса",
        format: "MP4/H.264/AAC",
        dimensions: "1080x1920",
        aspectRatio: "9:16",
        durationSec: capture.durationSec,
      }),
      gif: await describeFile(outputs.gameplayGif, {
        purpose: "Анимированное изображение для дополнительного поля медиа в Яндекс Играх",
        format: "анимированное изображение",
        dimensions: `${gifSettings.width}x${Math.round((gifSettings.width * 9) / 16)}`,
        aspectRatio: "16:9",
        fps: gifSettings.fps,
        durationSec: Math.min(gifSettings.durationSec, capture.durationSec),
      }),
      adHorizontal: await describeFile(outputs.adHorizontal, {
        purpose: "Рекламное видео, горизонтальный формат",
        format: "MP4/H.264/AAC",
        dimensions: "1920x1080",
        aspectRatio: "16:9",
        durationSec: capture.durationSec,
      }),
      adVertical: await describeFile(outputs.adVertical, {
        purpose: "Рекламное видео, вертикальный формат",
        format: "MP4/H.264/AAC",
        dimensions: "1080x1920",
        aspectRatio: "9:16",
        durationSec: capture.durationSec,
      }),
    },
  };

  await writeFile(outputs.manifest, `${JSON.stringify(media, null, 2)}\n`, "utf8");
}

async function writeReadme() {
  const lines = [
    "# Видеоматериалы для Яндекс Игр",
    "",
    "Готовые файлы:",
    "",
    "- `gameplay_1920x1080.mp4` - видео игрового процесса, 16:9.",
    "- `gameplay_vertical_1080x1920.mp4` - вертикальное видео игрового процесса, 9:16.",
    "- `gameplay_16x9_hq.gif` - качественное анимированное изображение 16:9.",
    "- `ad_horizontal_1920x1080.mp4` - горизонтальное рекламное видео.",
    "- `ad_vertical_1080x1920.mp4` - вертикальное рекламное видео.",
    "- `manifest.json` - размеры файлов и параметры генерации.",
    "",
    "Видеофайлы короче 28 секунд и собраны из записи реального игрового процесса.",
    "",
  ];
  await writeFile(outputs.readme, `${UTF8_BOM}${lines.join("\n")}`, "utf8");
}

async function describeFile(filePath, extra) {
  const info = await stat(filePath);
  return {
    path: normalizePath(filePath).replace(`${normalizePath(rootDir)}/`, ""),
    bytes: info.size,
    mib: Number((info.size / 1024 / 1024).toFixed(2)),
    ...extra,
  };
}

function drawText(text, x, y, size, color, fontName, enable = null) {
  const fontFile = resolveFont(fontName);
  const parts = [
    `fontfile=${escapeDrawtextValue(fontFile)}`,
    `text=${escapeDrawtextValue(text)}`,
    `x=${x}`,
    `y=${y}`,
    `fontsize=${size}`,
    `fontcolor=${color}`,
    "shadowcolor=0x000000@0.75",
    "shadowx=3",
    "shadowy=3",
  ];
  if (enable) parts.push(`enable='${enable}'`);
  return `drawtext=${parts.join(":")}`;
}

function resolveFont(fontName) {
  const windowsFont = `C:/Windows/Fonts/${fontName}`;
  return process.platform === "win32" ? windowsFont : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
}

function escapeDrawtextValue(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,");
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

async function waitForScene(page, sceneKey) {
  await page.waitForFunction(
    (expected) => globalThis.__MC_GAME__?.scene?.isActive(expected) === true,
    sceneKey,
    { timeout: 20_000 }
  );
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

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizePath(pathValue) {
  return pathValue.split("\\").join("/");
}
