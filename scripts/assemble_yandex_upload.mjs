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
const uploadZip = join(distDir, "upload_ready", "magnet-caravan_yandex_publishing-kit.zip");
const uploadZipChecksum = join(distDir, "upload_ready", "magnet-caravan_yandex_publishing-kit.sha256.txt");
const consoleUploadArchiveName = "UPLOAD_THIS_TO_YANDEX_magnet-caravan_yandex.zip";
const legacyUploadZip = join(distDir, "upload_ready", "magnet-caravan_yandex_upload-ready.zip");
const legacyUploadZipChecksum = join(distDir, "upload_ready", "magnet-caravan_yandex_upload-ready.sha256.txt");
const ruDocPath = join(rootDir, "docs", "platform_texts", "yandex_ru.md");
const enDocPath = join(rootDir, "docs", "platform_texts", "yandex_en.md");
const uiAuditMatrixDir = join(rootDir, "artifacts", "ui-audit", "matrix");
const yandexPublishSmokeDir = join(rootDir, "artifacts", "yandex-publish-pass");

const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
const version = String(packageJson.version ?? "0.0.0");
const generatedAt = new Date().toISOString();
const ruDoc = await readFile(ruDocPath, "utf8");
const enDoc = await readFile(enDocPath, "utf8");

const card = {
  title: extractMarkdownSection(enDoc, "Title") || extractMarkdownSection(ruDoc, "Название"),
  languages: ["ru", "en"],
  platforms: ["desktop", "mobile"],
  orientation: "landscape",
  cloudSave: true,
  ageRating: "12+",
  primaryGenre: "Arcade",
  secondaryGenre: "Action",
  tags: ["arcade", "action", "survival", "mobile", "skill", "daily"],
  keywords: {
    ru: "магнит,аркада,выживание,волны,улучшения,ежедневный режим",
    en: "magnet,arcade,survival,waves,upgrades,daily",
  },
  descriptions: {
    ru: {
      short: normalizeParagraphSection(extractMarkdownSection(ruDoc, "Об игре (коротко)")),
      full: normalizeParagraphSection(extractMarkdownSection(ruDoc, "Полное описание")),
      howToPlay: normalizeBulletSection(extractMarkdownSection(ruDoc, "Как играть")),
    },
    en: {
      short: normalizeParagraphSection(extractMarkdownSection(enDoc, "About (short)")),
      full: normalizeParagraphSection(extractMarkdownSection(enDoc, "Full description")),
      howToPlay: normalizeBulletSection(extractMarkdownSection(enDoc, "How to play")),
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
await rm(legacyUploadZip, { force: true });
await rm(legacyUploadZipChecksum, { force: true });
await mkdir(uploadRoot, { recursive: true });

await ensureFilesExist([
  gameArchivePath,
  ruDocPath,
  enDocPath,
  join(rootDir, "docs", "promo", "yandex", "card", "icon_512x512.png"),
  join(rootDir, "docs", "promo", "yandex", "card", "cover_800x470.png"),
  join(rootDir, "docs", "promo", "yandex", "desktop", "01_menu_1600x900.png"),
  join(rootDir, "docs", "promo", "yandex", "mobile", "01_gameplay_1280x720.png"),
]);

await mkdir(join(uploadRoot, "game"), { recursive: true });
await mkdir(join(uploadRoot, "texts", "source"), { recursive: true });
await mkdir(join(uploadRoot, "metadata"), { recursive: true });
await mkdir(join(uploadRoot, "instructions"), { recursive: true });
await mkdir(join(uploadRoot, "review_evidence"), { recursive: true });

await copyFile(gameArchivePath, join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await copyFile(gameArchivePath, join(uploadRoot, consoleUploadArchiveName));
await copyFile(ruDocPath, join(uploadRoot, "texts", "source", "yandex_ru.md"));
await copyFile(enDocPath, join(uploadRoot, "texts", "source", "yandex_en.md"));
await copyFile(join(rootDir, "docs", "YANDEX_PUBLISH.md"), join(uploadRoot, "instructions", "YANDEX_PUBLISH.md"));
await cp(join(rootDir, "docs", "promo", "yandex"), join(uploadRoot, "media"), { recursive: true });
const reviewEvidence = await copyReviewEvidence(uploadRoot);

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
      preferredConsoleUploadArchive: consoleUploadArchiveName,
      card,
      primaryMedia,
      reviewEvidence,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const archiveStat = await stat(join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await writeFile(join(uploadRoot, "README.md"), buildReadme({ version, generatedAt, archiveSizeBytes: archiveStat.size }), "utf8");
await writeFile(join(uploadRoot, "instructions", "UPLOAD_CHECKLIST.md"), buildUploadChecklist(), "utf8");
await writeFile(join(uploadRoot, "instructions", "MODERATION_EVIDENCE.md"), buildModerationEvidenceMarkdown(reviewEvidence), "utf8");
await writeChecksums(uploadRoot, join(uploadRoot, "metadata", "checksums.sha256"));

await zipDirectory(uploadRoot, uploadZip);
const uploadZipSha256 = await createFileHash(uploadZip);
await writeFile(uploadZipChecksum, `${uploadZipSha256}  magnet-caravan_yandex_publishing-kit.zip\n`, "utf8");

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

## Важно
- В консоль Яндекс Игр загружайте только \`${consoleUploadArchiveName}\`.
- Не загружайте \`../magnet-caravan_yandex_publishing-kit.zip\`: это контейнер со всеми материалами, а не игровой билд.

## Что Внутри
- \`${consoleUploadArchiveName}\` — главный файл для загрузки в консоль.
- \`game/magnet-caravan_yandex.zip\` — игровой архив для загрузки.
- \`texts/\` — готовые тексты по отдельным полям карточки.
- \`texts/source/\` — исходные markdown-версии RU и EN текстов.
- \`media/\` — иконка, обложка, desktop и mobile screenshots.
- \`metadata/yandex_game_card.json\` — те же поля карточки в структурированном виде.
- \`metadata/checksums.sha256\` — контрольные суммы файлов внутри пакета.
- \`instructions/YANDEX_PUBLISH.md\` — полный publish-runbook.
- \`instructions/UPLOAD_CHECKLIST.md\` — короткий порядок действий при ручной публикации.

## Что Загружать В Консоль
1. Архив игры: \`${consoleUploadArchiveName}\`
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
- Архив всего publishing-kit: \`../magnet-caravan_yandex_publishing-kit.zip\`
- SHA256 publishing-kit: \`../magnet-caravan_yandex_publishing-kit.sha256.txt\`
`;
}

function buildUploadChecklist() {
  return `# Upload Checklist

## Перед Загрузкой
1. Откройте \`metadata/yandex_game_card.json\` или \`texts/console_fields_ru.md\`.
2. Подготовьте под рукой \`${consoleUploadArchiveName}\`.
3. Подготовьте медиа из \`media/\`.

## В Консоли Яндекс Игр
1. Создайте новый draft игры.
2. Загрузите \`${consoleUploadArchiveName}\`.
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

## После Прошлых Замечаний
1. Для \`How to play [ru]\` используйте только \`texts/how_to_play_ru.txt\`, без английских вставок и смешения языков.
2. После загрузки архива проверьте preview и убедитесь, что SDK подключён через \`/sdk.js\` и в debug panel loader показывает \`IT\`, а не \`IF\`.
3. Проверьте все rewarded CTA: они должны прямо указывать на рекламу, например \`за рекламу\` или \`Rewarded\`.
4. На десктопе проверьте resize минимум на \`1600x900\`, \`1280x720\`, \`900x500\` и \`680x380\`: HUD, tutorial, settings и results не должны обрезаться или наезжать друг на друга.
5. При кликах, правом клике и удержании по игре не должно открываться контекстное меню браузера или появляться выделение текста.

## Финальная Самопроверка
1. Проверьте, что в preview корректно открывается загрузочный экран и меню.
2. Пройдите короткий smoke test: старт run, rewarded, экран результатов, возврат из background.
3. Сверьте файлы с \`metadata/checksums.sha256\`, если пакет переносился между машинами.
4. Перед отправкой в модерацию при необходимости перечитайте \`instructions/YANDEX_PUBLISH.md\`.
`;
}

function buildModerationEvidenceMarkdown(reviewEvidence) {
  const uiAuditSection = reviewEvidence.uiAudit.present
    ? `- Included visual matrix: \`${reviewEvidence.uiAudit.path}\`\n- Gallery entry point: \`${reviewEvidence.uiAudit.indexPath}\``
    : "- UI audit matrix was not found when the publishing kit was assembled. Run `npm run audit:ui` before `npm run package:yandex` to include it.";

  const publishSmokeSection = reviewEvidence.publishSmoke.present
    ? `- Included publish smoke report: \`${reviewEvidence.publishSmoke.reportPath}\`\n- Included screenshots: \`${reviewEvidence.publishSmoke.path}\``
    : "- Yandex publish smoke evidence was not found when the publishing kit was assembled. Run `npm run audit:yandex` before `npm run package:yandex` to include it.";

  return `# Moderation Evidence

This file maps the historical Yandex moderation issues to the current automated proofs bundled with the publishing kit.

## Included Evidence
${uiAuditSection}
${publishSmokeSection}

## Historical Issues

### 1. Not all language-dependent texts were translated
- Evidence: RU/EN UI matrix in \`${reviewEvidence.uiAudit.path || "review_evidence/ui_audit_matrix"}\`
- Supporting automation: RU/EN viewport smoke in the local test suite
- Notes: key menu, HUD, upgrade, results, and boot/fatal overlays now use the shared i18n layer.

### 2. Elements were clipped after window resize
- Evidence: compact and desktop screenshots in \`${reviewEvidence.uiAudit.path || "review_evidence/ui_audit_matrix"}\`
- Supporting automation: compact viewport bounds assertions in Playwright e2e

### 3. Elements and texts overlapped each other
- Evidence: UI matrix screenshots for menu, workshop, leaderboard, settings, upgrade, and results
- Supporting automation: compact viewport text-bound checks in \`menu\`, \`ui\`, \`upgrade\`, and \`results\`

### 4. Text selection or browser context menu appeared on the playfield
- Evidence: publish smoke report in \`${reviewEvidence.publishSmoke.reportPath || "review_evidence/yandex_publish_smoke/report.md"}\`
- Supporting automation: synthetic \`contextmenu\` and \`selectstart\` prevention checks on the Yandex preview build

### 5. Startup or runtime error appeared in the game
- Evidence: publish smoke report plus screenshots in \`${reviewEvidence.publishSmoke.path || "review_evidence/yandex_publish_smoke"}\`
- Supporting automation: boot without fatal overlay, zero runtime page errors during Yandex preview smoke

### 6. The game looked unfinished or in-development
- Evidence: current promo captures in \`media/\`, localized loading screen, staged menu, and polished overlays in the UI audit matrix
- Supporting automation: build and visual audit artifacts included in this publishing kit

### 7. Text was too small
- Evidence: compact/mobile screenshots in \`${reviewEvidence.uiAudit.path || "review_evidence/ui_audit_matrix"}\`
- Supporting automation: narrow viewport visual matrix and compact moderation smoke

## Recommended Workflow
1. Run \`npm run audit:ui\`.
2. Run \`npm run audit:yandex\`.
3. Run \`npm run package:yandex\`.
4. Review this file and the bundled evidence before uploading the draft.
`;
}

function extractMarkdownSection(markdown, heading) {
  const marker = `## ${heading}`;
  const startIndex = markdown.indexOf(marker);
  if (startIndex === -1) return "";

  const lineEndIndex = markdown.indexOf("\n", startIndex);
  if (lineEndIndex === -1) return "";

  const sectionStart = lineEndIndex + 1;
  const remaining = markdown.slice(sectionStart);
  const nextHeadingOffset = remaining.search(/\r?\n## /);
  const rawSection = nextHeadingOffset === -1 ? remaining : remaining.slice(0, nextHeadingOffset);
  return rawSection.trim();
}

function normalizeParagraphSection(section) {
  return section
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" "))
    .filter(Boolean)
    .join("\n\n");
}

function normalizeBulletSection(section) {
  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .join(" ");
}

async function copyReviewEvidence(uploadDir) {
  const reviewRoot = join(uploadDir, "review_evidence");
  const uiAuditPresent = await pathExists(uiAuditMatrixDir);
  const publishSmokePresent = await pathExists(yandexPublishSmokeDir);

  if (uiAuditPresent) {
    await cp(uiAuditMatrixDir, join(reviewRoot, "ui_audit_matrix"), { recursive: true });
  }

  if (publishSmokePresent) {
    await cp(yandexPublishSmokeDir, join(reviewRoot, "yandex_publish_smoke"), { recursive: true });
  }

  return {
    uiAudit: {
      present: uiAuditPresent,
      path: uiAuditPresent ? "review_evidence/ui_audit_matrix" : null,
      indexPath: uiAuditPresent ? "review_evidence/ui_audit_matrix/index.html" : null,
    },
    publishSmoke: {
      present: publishSmokePresent,
      path: publishSmokePresent ? "review_evidence/yandex_publish_smoke" : null,
      reportPath: publishSmokePresent ? "review_evidence/yandex_publish_smoke/report.md" : null,
    },
  };
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
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
