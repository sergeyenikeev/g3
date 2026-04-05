import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { buildReleaseTarget, ensureReleaseDirs, runReleaseChecks } from "./release_build_utils.mjs";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(rootDir, "dist");
const uploadRoot = join(distDir, "upload_ready", "yandex");
const uploadZip = join(distDir, "upload_ready", "magnet-caravan_yandex_upload-ready.zip");
const uploadZipChecksum = join(distDir, "upload_ready", "magnet-caravan_yandex_upload-ready.sha256.txt");

const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
const version = String(packageJson.version ?? "0.0.0");
const generatedAt = new Date().toISOString();

const card = {
  title: "Magnet Caravan",
  languages: ["ru", "en"],
  platforms: ["desktop", "mobile"],
  orientation: "landscape",
  cloudSave: true,
  ageRating: "12+",
  primaryGenre: "Arcade",
  secondaryGenre: "Action",
  tags: ["arcade", "action", "survival", "mobile", "skill", "daily"],
  keywords: {
    ru: "магнит,аркада,выживание,волны,апгрейды,ежедневка",
    en: "magnet,arcade,survival,waves,upgrades,daily",
  },
  descriptions: {
    ru: {
      short:
        "Собирайте scrap магнитом, выстраивайте хвост-караван и сдавайте его в переработчик. Flip помогает оттолкнуть врагов и отразить снаряды.",
      full:
        "Magnet Caravan — мобильная аркада в ландшафте: управление через виртуальный джойстик и кнопку Flip. Собирайте scrap, наращивайте хвост и в нужный момент сдавайте добычу в Recycler Zone, получая bolts и лечение.\n\nВраги появляются волнами по директору сложности: учитываются safe spawn distance, телеграф перед появлением, caps по типам врагов и pressure gating. Между волнами — выбор апгрейдов, влияющих на конфиг забега.\n\nЕсть Daily режим с UTC seed и модификаторами дня.",
      howToPlay:
        "Ведите персонажа джойстиком или WASD. Собирайте scrap, чтобы увеличить хвост. Используйте Flip для импульса и дефлекта снарядов. Сдавайте хвост в Recycler Zone, чтобы получать награды и восстановление. После волн выбирайте апгрейды и собирайте билд под свой стиль.",
    },
    en: {
      short:
        "Collect scrap with a magnet, grow a caravan tail, bank it for bolts and healing, and survive waves with a powerful Flip pulse.",
      full:
        "Magnet Caravan is a landscape-friendly mobile-first top-down arcade. Use the virtual joystick and Flip button to dodge danger, pull scrap into your tail, and bank it at the Recycler Zone.\n\nWaves are driven by a fairness-first director: safe spawn distance, spawn telegraph, caps per enemy type, and pressure gating. Between waves you pick upgrades that apply to the run configuration.\n\nDaily mode uses a UTC seed with unique modifiers and rules.",
      howToPlay:
        "Move with the joystick or WASD. Collect scrap to grow your tail. Press Flip to pulse and deflect shots. Stay in the Recycler Zone to bank your haul. Pick upgrades between waves and adapt your build to the current run.",
    },
  },
  developerComment:
    "The game uses the official Yandex Games SDK only. Rewarded ads are user-initiated. Interstitial ads are shown only on the results screen, outside active gameplay. Game loading and gameplay hooks are integrated. Audio starts only after user interaction. Cloud save uses player data.",
};

const primaryMedia = {
  icon: "media/card/icon_512x512.png",
  cover: "media/card/cover_800x470.png",
  desktopScreenshots: [
    "media/desktop/01_menu_1600x900.png",
    "media/desktop/02_gameplay_1600x900.png",
    "media/desktop/03_upgrade_1600x900.png",
  ],
  mobileScreenshots: [
    "media/mobile/01_gameplay_1280x720.png",
    "media/mobile/02_results_1280x720.png",
  ],
  alternatives: [
    "media/card/icon_menu_alt_512x512.png",
    "media/card/cover_menu_alt_800x470.png",
    "media/desktop/04_results_1600x900.png",
  ],
};

await runReleaseChecks();
const releaseDirs = await ensureReleaseDirs(rootDir);
const { zipPath: gameArchivePath } = await buildReleaseTarget("yandex", releaseDirs, rootDir);

await rm(uploadRoot, { recursive: true, force: true });
await mkdir(uploadRoot, { recursive: true });

await ensureFilesExist([
  gameArchivePath,
  join(rootDir, "docs", "platform_texts", "yandex_ru.md"),
  join(rootDir, "docs", "platform_texts", "yandex_en.md"),
  join(rootDir, "docs", "promo", "yandex", "card", "icon_512x512.png"),
  join(rootDir, "docs", "promo", "yandex", "card", "cover_800x470.png"),
  join(rootDir, "docs", "promo", "yandex", "desktop", "01_menu_1600x900.png"),
  join(rootDir, "docs", "promo", "yandex", "mobile", "01_gameplay_1280x720.png"),
]);

await mkdir(join(uploadRoot, "game"), { recursive: true });
await mkdir(join(uploadRoot, "texts", "source"), { recursive: true });
await mkdir(join(uploadRoot, "metadata"), { recursive: true });
await mkdir(join(uploadRoot, "instructions"), { recursive: true });

await copyFile(gameArchivePath, join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await copyFile(
  join(rootDir, "docs", "platform_texts", "yandex_ru.md"),
  join(uploadRoot, "texts", "source", "yandex_ru.md")
);
await copyFile(
  join(rootDir, "docs", "platform_texts", "yandex_en.md"),
  join(uploadRoot, "texts", "source", "yandex_en.md")
);
await copyFile(join(rootDir, "docs", "YANDEX_PUBLISH.md"), join(uploadRoot, "instructions", "YANDEX_PUBLISH.md"));
await cp(join(rootDir, "docs", "promo", "yandex"), join(uploadRoot, "media"), { recursive: true });

await writeFile(join(uploadRoot, "texts", "title.txt"), `${card.title}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "short_description_ru.txt"), `${card.descriptions.ru.short}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "short_description_en.txt"), `${card.descriptions.en.short}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "full_description_ru.txt"), `${card.descriptions.ru.full}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "full_description_en.txt"), `${card.descriptions.en.full}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "how_to_play_ru.txt"), `${card.descriptions.ru.howToPlay}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "how_to_play_en.txt"), `${card.descriptions.en.howToPlay}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "keywords_ru.txt"), `${card.keywords.ru}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "keywords_en.txt"), `${card.keywords.en}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "developer_comment_en.txt"), `${card.developerComment}\n`, "utf8");
await writeFile(join(uploadRoot, "texts", "console_fields_ru.md"), buildConsoleFieldsMarkdown(card), "utf8");

await writeFile(
  join(uploadRoot, "metadata", "yandex_game_card.json"),
  `${JSON.stringify(
    {
      generatedAt,
      version,
      buildArchive: "game/magnet-caravan_yandex.zip",
      card,
      primaryMedia,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const archiveStat = await stat(join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await writeFile(join(uploadRoot, "README.md"), buildReadme({ version, generatedAt, archiveSizeBytes: archiveStat.size }), "utf8");
await writeFile(join(uploadRoot, "instructions", "UPLOAD_CHECKLIST.md"), buildUploadChecklist(), "utf8");
await writeChecksums(uploadRoot, join(uploadRoot, "metadata", "checksums.sha256"));

await zipDirectory(uploadRoot, uploadZip);
const uploadZipSha256 = await createFileHash(uploadZip);
await writeFile(uploadZipChecksum, `${uploadZipSha256}  magnet-caravan_yandex_upload-ready.zip\n`, "utf8");

console.log(`package_yandex: folder -> ${uploadRoot}`);
console.log(`package_yandex: zip -> ${uploadZip}`);
console.log(`package_yandex: zip sha256 -> ${uploadZipChecksum}`);

function buildConsoleFieldsMarkdown(gameCard) {
  return `# Поля Карточки Для Яндекс Игр

## Основное
- Название: \`${gameCard.title}\`
- Языки интерфейса: \`${gameCard.languages.join("`, `")}\`
- Платформы: \`${gameCard.platforms.join("`, `")}\`
- Ориентация: \`${gameCard.orientation}\`
- Cloud save: \`${gameCard.cloudSave ? "enabled" : "disabled"}\`
- Возраст: \`${gameCard.ageRating}\`

## Жанры
- Основной: \`${gameCard.primaryGenre}\`
- Дополнительный: \`${gameCard.secondaryGenre}\`

## Теги
\`${gameCard.tags.join("`, `")}\`

## Keywords
- RU: \`${gameCard.keywords.ru}\`
- EN: \`${gameCard.keywords.en}\`

## Media
- Иконка: \`${primaryMedia.icon}\`
- Обложка: \`${primaryMedia.cover}\`
- Desktop screenshots:
  - \`${primaryMedia.desktopScreenshots.join("`\n  - `")}\`
- Mobile screenshots:
  - \`${primaryMedia.mobileScreenshots.join("`\n  - `")}\`
- Альтернативы:
  - \`${primaryMedia.alternatives.join("`\n  - `")}\`

## Developer Comment
\`${gameCard.developerComment}\`
`;
}

function buildReadme({ version: currentVersion, generatedAt: generatedIso, archiveSizeBytes }) {
  return `# Yandex Upload Package

Этот каталог уже собран для ручной загрузки в консоль Яндекс Игр.

## Что Внутри
- \`game/magnet-caravan_yandex.zip\` — игровой архив для загрузки.
- \`texts/\` — готовые тексты по отдельным полям карточки.
- \`texts/source/\` — исходные markdown-версии RU и EN текстов.
- \`media/\` — иконка, обложка, desktop и mobile screenshots.
- \`metadata/yandex_game_card.json\` — те же поля карточки в структурированном виде.
- \`metadata/checksums.sha256\` — контрольные суммы файлов внутри пакета.
- \`instructions/YANDEX_PUBLISH.md\` — полный publish-runbook.
- \`instructions/UPLOAD_CHECKLIST.md\` — короткий порядок действий при ручной публикации.

## Что Загружать В Консоль
1. Архив игры: \`game/magnet-caravan_yandex.zip\`
2. Иконка: \`${primaryMedia.icon}\`
3. Обложка: \`${primaryMedia.cover}\`
4. Desktop screenshots:
   - \`${primaryMedia.desktopScreenshots.join("`\n   - `")}\`
5. Mobile screenshots:
   - \`${primaryMedia.mobileScreenshots.join("`\n   - `")}\`
6. Developer comment: \`texts/developer_comment_en.txt\`

## Где Брать Тексты
- краткие/полные описания и how to play: \`texts/*.txt\`
- карточка целиком: \`metadata/yandex_game_card.json\`
- исходные описания RU/EN: \`texts/source/yandex_ru.md\`, \`texts/source/yandex_en.md\`

## Альтернативные Медиа
- \`${primaryMedia.alternatives.join("`\n- `")}\`

## Служебная Информация
- Версия игры: \`${currentVersion}\`
- Сгенерировано: \`${generatedIso}\`
- Размер игрового архива: \`${archiveSizeBytes}\` bytes
- Архив всего upload-пакета: \`../magnet-caravan_yandex_upload-ready.zip\`
- SHA256 upload-пакета: \`../magnet-caravan_yandex_upload-ready.sha256.txt\`
`;
}

function buildUploadChecklist() {
  return `# Upload Checklist

## Перед Загрузкой
1. Откройте \`metadata/yandex_game_card.json\` или \`texts/console_fields_ru.md\`.
2. Подготовьте под рукой \`game/magnet-caravan_yandex.zip\`.
3. Подготовьте медиа из \`media/\`.

## В Консоли Яндекс Игр
1. Создайте новый draft игры.
2. Загрузите \`game/magnet-caravan_yandex.zip\`.
3. Убедитесь, что у игры включены \`landscape\`, \`desktop\`, \`mobile\`, \`cloud save\`.
4. Вставьте название, short/full description и how to play из \`texts/\`.
5. Добавьте keywords, жанры, теги и developer comment.
6. Загрузите \`media/card/icon_512x512.png\`.
7. Загрузите \`media/card/cover_800x470.png\`.
8. Загрузите desktop screenshots:
   - \`media/desktop/01_menu_1600x900.png\`
   - \`media/desktop/02_gameplay_1600x900.png\`
   - \`media/desktop/03_upgrade_1600x900.png\`
9. Загрузите mobile screenshots:
   - \`media/mobile/01_gameplay_1280x720.png\`
   - \`media/mobile/02_results_1280x720.png\`
10. Если основной icon или cover не устраивает по витрине, возьмите варианты из \`media/card/*_alt_*.png\`.

## Финальная Самопроверка
1. Проверьте, что в preview корректно открывается загрузочный экран и меню.
2. Пройдите короткий smoke test: старт run, rewarded, экран результатов, возврат из background.
3. Сверьте файлы с \`metadata/checksums.sha256\`, если пакет переносился между машинами.
4. Перед отправкой в модерацию при необходимости перечитайте \`instructions/YANDEX_PUBLISH.md\`.
`;
}

async function ensureFilesExist(paths) {
  await Promise.all(
    paths.map(async (targetPath) => {
      await stat(targetPath);
    })
  );
}

async function writeChecksums(baseDir, outputPath) {
  const files = await collectFiles(baseDir);
  const checksumLines = [];

  for (const filePath of files) {
    const relativePath = normalizePath(relative(baseDir, filePath));
    if (relativePath === "metadata/checksums.sha256") continue;
    const hash = await createFileHash(filePath);
    checksumLines.push(`${hash}  ${relativePath}`);
  }

  await writeFile(outputPath, `${checksumLines.join("\n")}\n`, "utf8");
}

async function collectFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }
    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

async function createFileHash(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

function normalizePath(pathValue) {
  return pathValue.split("\\").join("/");
}

function zipDirectory(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, "yandex");
    archive.finalize();
  });
}
