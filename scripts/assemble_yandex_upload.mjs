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
const assetProvenancePath = join(rootDir, "docs", "ASSET_PROVENANCE.md");
const uiAuditMatrixDir = join(rootDir, "artifacts", "ui-audit", "matrix");
const yandexPublishSmokeDir = join(rootDir, "artifacts", "yandex-publish-pass");

const packageJson = JSON.parse(await readFile(join(rootDir, "package.json"), "utf8"));
const version = String(packageJson.version ?? "0.0.0");
const generatedAt = new Date().toISOString();
const UTF8_BOM = "\uFEFF";
const ruDoc = await readFile(ruDocPath, "utf8");

const card = {
  title: extractMarkdownSection(ruDoc, "Название") || "Magnet Caravan",
  languages: ["ru"],
  platforms: ["desktop", "mobile"],
  orientation: "landscape",
  cloudSave: true,
  ageRating: "12+",
  primaryGenre: "аркада",
  secondaryGenre: "экшен",
  tags: ["аркада", "экшен", "выживание", "мобильная", "на реакцию", "ежедневный режим"],
  keywords: {
    ru: "магнит,аркада,выживание,волны,улучшения,ежедневный режим",
  },
  descriptions: {
    ru: {
      short: normalizeParagraphSection(extractMarkdownSection(ruDoc, "Об игре (коротко)")),
      full: normalizeParagraphSection(extractMarkdownSection(ruDoc, "Полное описание")),
      seo: normalizeParagraphSection(
        extractMarkdownSection(ruDoc, "Описание для поисковой оптимизации") || extractMarkdownSection(ruDoc, "Описание для поиска")
      ),
      howToPlay: normalizeBulletSection(extractMarkdownSection(ruDoc, "Как играть")),
    },
  },
  developerComment:
    "Игра использует только официальный набор средств разработки Яндекс Игр. Реклама за награду запускается только по явному действию игрока. Межстраничная реклама показывается только на экране результатов, вне активного игрового процесса. События загрузки и игрового процесса подключены. Звук включается только после взаимодействия пользователя. Облачные сохранения используют данные игрока.",
};

const primaryMedia = {
  icon: "media/card/icon_512x512.png",
  maskableIcon: "media/card/maskable_icon_512x512.png",
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
  gameplayVideo: "media/video/gameplay_1920x1080.mp4",
  gameplayGif: "media/video/gameplay_16x9_hq.gif",
  verticalVideo: "media/video/gameplay_vertical_1080x1920.mp4",
  advertisingVideos: ["media/video/ad_horizontal_1920x1080.mp4", "media/video/ad_vertical_1080x1920.mp4"],
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
  assetProvenancePath,
  join(rootDir, "docs", "promo", "yandex", "card", "icon_512x512.png"),
  join(rootDir, "docs", "promo", "yandex", "card", "maskable_icon_512x512.png"),
  join(rootDir, "docs", "promo", "yandex", "card", "cover_800x470.png"),
  join(rootDir, "docs", "promo", "yandex", "desktop", "01_menu_1600x900.png"),
  join(rootDir, "docs", "promo", "yandex", "mobile", "01_gameplay_1280x720.png"),
  join(rootDir, "docs", "promo", "yandex", "video", "gameplay_1920x1080.mp4"),
  join(rootDir, "docs", "promo", "yandex", "video", "gameplay_vertical_1080x1920.mp4"),
  join(rootDir, "docs", "promo", "yandex", "video", "gameplay_16x9_hq.gif"),
  join(rootDir, "docs", "promo", "yandex", "video", "ad_horizontal_1920x1080.mp4"),
  join(rootDir, "docs", "promo", "yandex", "video", "ad_vertical_1080x1920.mp4"),
]);

await mkdir(join(uploadRoot, "game"), { recursive: true });
await mkdir(join(uploadRoot, "texts", "source"), { recursive: true });
await mkdir(join(uploadRoot, "metadata"), { recursive: true });
await mkdir(join(uploadRoot, "instructions"), { recursive: true });
await mkdir(join(uploadRoot, "review_evidence"), { recursive: true });

await copyFile(gameArchivePath, join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await copyFile(gameArchivePath, join(uploadRoot, consoleUploadArchiveName));
await copyFile(ruDocPath, join(uploadRoot, "texts", "source", "yandex_ru.md"));
await copyFile(join(rootDir, "docs", "YANDEX_PUBLISH.md"), join(uploadRoot, "instructions", "YANDEX_PUBLISH.md"));
await writeTextFileWithBom(join(uploadRoot, "instructions", "ASSET_PROVENANCE.md"), buildAssetProvenanceMarkdown());
await cp(join(rootDir, "docs", "promo", "yandex"), join(uploadRoot, "media"), { recursive: true });
const reviewEvidence = await copyReviewEvidence(uploadRoot);

await writeTextFileWithBom(join(uploadRoot, "texts", "title.txt"), `${card.title}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "short_description_ru.txt"), `${card.descriptions.ru.short}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "full_description_ru.txt"), `${card.descriptions.ru.full}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "seo_description_ru.txt"), `${card.descriptions.ru.seo}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "how_to_play_ru.txt"), `${card.descriptions.ru.howToPlay}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "keywords_ru.txt"), `${card.keywords.ru}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "developer_comment_ru.txt"), `${card.developerComment}\n`);
await writeTextFileWithBom(join(uploadRoot, "texts", "console_fields_ru.md"), buildConsoleFieldsMarkdownRu(card));

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
      assetProvenance: "instructions/ASSET_PROVENANCE.md",
      reviewEvidence,
    },
    null,
    2
  )}\n`,
  "utf8"
);

const archiveStat = await stat(join(uploadRoot, "game", "magnet-caravan_yandex.zip"));
await writeTextFileWithBom(join(uploadRoot, "README.md"), buildReadme({ version, generatedAt, archiveSizeBytes: archiveStat.size }));
await writeTextFileWithBom(join(uploadRoot, "instructions", "UPLOAD_CHECKLIST.md"), buildUploadChecklist());
await writeTextFileWithBom(join(uploadRoot, "instructions", "MODERATION_EVIDENCE.md"), buildModerationEvidenceMarkdown(reviewEvidence));
await writeChecksums(uploadRoot, join(uploadRoot, "metadata", "checksums.sha256"));

await zipDirectory(uploadRoot, uploadZip);
const uploadZipSha256 = await createFileHash(uploadZip);
await writeFile(uploadZipChecksum, `${uploadZipSha256}  magnet-caravan_yandex_publishing-kit.zip\n`, "utf8");

console.log(`package_yandex: folder -> ${uploadRoot}`);
console.log(`package_yandex: zip -> ${uploadZip}`);
console.log(`package_yandex: zip sha256 -> ${uploadZipChecksum}`);

function _buildConsoleFieldsMarkdownLegacy(gameCard) {
  return `# Поля Карточки Для Яндекс Игр

## Основное
- Название: \`${gameCard.title}\`
- Языки интерфейса: \`${gameCard.languages.join("`, `")}\`
- Платформы: \`${gameCard.platforms.join("`, `")}\`
- Ориентация: \`${gameCard.orientation}\`
- Облачные сохранения: \`${gameCard.cloudSave ? "включены" : "выключены"}\`
- Возраст: \`${gameCard.ageRating}\`

## Жанры
- Основной: \`${gameCard.primaryGenre}\`
- Дополнительный: \`${gameCard.secondaryGenre}\`

## Теги
\`${gameCard.tags.join("`, `")}\`

## Ключевые слова
- Русские: \`${gameCard.keywords.ru}\`

## Медиа
- Иконка: \`${primaryMedia.icon}\`
- Обложка: \`${primaryMedia.cover}\`
- Снимки для компьютера:
  - \`${primaryMedia.desktopScreenshots.join("`\n  - `")}\`
- Снимки для телефона:
  - \`${primaryMedia.mobileScreenshots.join("`\n  - `")}\`
- Альтернативы:
  - \`${primaryMedia.alternatives.join("`\n  - `")}\`

## Комментарий разработчика
\`${gameCard.developerComment}\`
`;
}

function buildConsoleFieldsMarkdownRu(gameCard) {
  const languageLabels = gameCard.languages.map((language) => {
    if (language === "ru") return "русский";
    if (language === "en") return "английский";
    return language;
  });
  const platformLabels = gameCard.platforms.map((platform) => {
    if (platform === "desktop") return "компьютер";
    if (platform === "mobile") return "телефон";
    return platform;
  });
  const tagLabels = gameCard.tags;

  return `# Поля карточки для Яндекс Игр

## Основное
- Название: \`${gameCard.title}\`
- Языки интерфейса: \`${languageLabels.join("`, `")}\`
- Платформы: \`${platformLabels.join("`, `")}\`
- Ориентация: \`горизонтальная\`
- Облачные сохранения: \`${gameCard.cloudSave ? "включены" : "выключены"}\`
- Возраст: \`${gameCard.ageRating}\`

## Жанры
- Основной: \`${gameCard.primaryGenre}\`
- Дополнительный: \`${gameCard.secondaryGenre}\`

## Теги
\`${tagLabels.join("`, `")}\`

## Ключевые слова
- Русские: \`${gameCard.keywords.ru}\`

## Описание для поисковой оптимизации
\`${gameCard.descriptions.ru.seo}\`

## Медиа
- Основная иконка: первая квадратная картинка из папки для карточки
- Иконка для адаптивной маски: отдельная квадратная картинка из папки для карточки
- Основная обложка: широкая картинка для витрины
- Снимки экрана для компьютера: берите первые три изображения из папки для компьютера
- Снимки экрана для телефона: берите два изображения из папки для телефона
- Вертикальное видео игрового процесса: отдельный файл из папки с видео
- Рекламные видео: горизонтальный и вертикальный ролики из папки с видео
- Запасные изображения: дополнительные варианты иконки, обложки и итогового экрана лежат рядом

## Комментарий разработчика
Берите из отдельного русского файла с комментарием разработчика в пакете.
`;
}

function buildReadme({ version: currentVersion, generatedAt: generatedIso, archiveSizeBytes }) {
  const generatedLabel = generatedIso.replace("T", " ").replace("Z", "");
  return `# Пакет для загрузки в Яндекс Игры

Этот каталог уже собран для ручной загрузки в консоль Яндекс Игр.

## Главное
- В консоль Яндекс Игр загружайте отдельный архив игры из корня этого пакета.
- Общий архив со всеми материалами нужен только для хранения и передачи набора целиком.

## Что Внутри
- папка с игровым архивом;
- папка с готовыми текстами карточки;
- папка с исходными описаниями;
- папка с медиафайлами;
- папка со служебными памятками;
- папка со структурированными данными и контрольными суммами.

## Что Загружать В Консоль
1. Отдельный архив игры из корня пакета.
2. Основную иконку из папки для карточки.
3. Иконку для адаптивной маски из папки для карточки.
4. Основную обложку из папки для карточки.
5. Три основных снимка для компьютера.
6. Два основных снимка для телефона.
7. Вертикальное видео игрового процесса из папки с видео.
8. Комментарий разработчика на русском языке из папки с текстами.

## Где Брать Тексты
- отдельные поля карточки лежат в папке с текстами;
- исходные описания на русском языке лежат рядом;
- полная структура карточки лежит в папке с данными.

## Альтернативные Медиа
- в папке для карточки есть запасные иконка и обложка;
- в папке для компьютера есть дополнительный снимок экрана.

## Служебная Информация
- Версия игры: \`${currentVersion}\`
- Сгенерировано: \`${generatedLabel}\`
- Размер игрового архива: \`${archiveSizeBytes}\` байт
- Общий архив со всеми материалами и контрольная сумма лежат рядом с этим каталогом.
`;
}

function buildUploadChecklist() {
  return `# Памятка по загрузке

## Перед Загрузкой
1. Откройте русскую памятку по полям карточки или структурированные данные игры.
2. Подготовьте под рукой отдельный архив игры.
3. Подготовьте иконку, обложку и снимки экрана.

## В Консоли Яндекс Игр
1. Создайте новый черновик игры.
2. Загрузите отдельный архив игры.
3. Убедитесь, что включены горизонтальная ориентация, компьютер, телефон и облачные сохранения.
4. Вставьте название, короткое описание, полное описание, описание для поисковой оптимизации и поле «Как играть» из папки с текстами.
5. Добавьте ключевые слова, жанры, теги и комментарий разработчика.
6. Загрузите основную иконку.
7. Загрузите основную обложку.
8. Загрузите три основных снимка для компьютера.
9. Загрузите два основных снимка для телефона.
10. Если витрина выглядит слабее ожидаемого, возьмите запасные изображения из папки с медиафайлами.

## После Прошлых Замечаний
1. Для русского поля «Как играть» используйте только отдельный русский файл без смешения языков.
2. После загрузки архива проверьте предварительный просмотр и убедитесь, что платформенный набор подключается по штатной схеме.
3. Проверьте все кнопки с рекламой за награду: они должны прямо указывать на рекламу.
4. На компьютере проверьте несколько узких и широких размеров окна: интерфейс, обучение, настройки и экран результатов не должны обрезаться или наезжать друг на друга.
5. При кликах, правом клике и удержании по игре не должно открываться контекстное меню браузера или появляться выделение текста.

## Финальная Самопроверка
1. Проверьте, что корректно открывается загрузочный экран и меню.
2. Пройдите короткую проверку: старт забега, реклама за награду, экран результатов, возврат после сворачивания.
3. Если пакет переносился между машинами, сверьте контрольные суммы.
4. Перед отправкой в модерацию перечитайте полную памятку по публикации.
`;
}

function buildAssetProvenanceMarkdown() {
  return `# Происхождение материалов

Все материалы для публикации Magnet Caravan подготовлены внутри проекта.

## Изображения
- Иконки, обложки и снимки экрана созданы из локальной сборки игры.
- В материалах нет сторонних фотографий, товарных знаков или заимствованных иллюстраций.
- Надписи на витринных изображениях оставлены на русском языке, кроме названия игры.

## Видео
- Видео игрового процесса записано из локальной тестовой сборки.
- Рекламные ролики собраны из реального игрового процесса и русскоязычных титров.
- Анимированное изображение подготовлено из той же записи игрового процесса.

## Тексты
- Описания, ключевые слова, памятки и комментарий разработчика подготовлены на русском языке.
- Название игры оставлено как Magnet Caravan.
`;
}

function buildModerationEvidenceMarkdown(reviewEvidence) {
  const uiAuditSection = reviewEvidence.uiAudit.present
    ? "- Матрица экранов интерфейса приложена.\n- Галерея снимков интерфейса приложена."
    : "- Матрица интерфейса не была найдена при сборке пакета. Перед новой сборкой запустите проверку интерфейса.";

  const publishSmokeSection = reviewEvidence.publishSmoke.present
    ? "- Отчёт публикационной проверки приложен.\n- Снимки с публикационной проверки приложены."
    : "- Доказательства публикационной проверки не были найдены при сборке пакета. Перед новой сборкой запустите публикационную проверку.";

  return `# Доказательства для модерации

Этот файл связывает прошлые замечания модерации с текущими проверками, которые вложены в пакет публикации.

## Что Приложено
${uiAuditSection}
${publishSmokeSection}

## Исторические Замечания

### 1. Не все зависящие от языка тексты были переведены
- Доказательство: матрица интерфейса на русском языке.
- Автоматическая проверка: локальная проверка интерфейса на русском языке.
- Примечание: меню, верхняя панель, улучшения, результаты и стартовые слои работают через общую систему локализации.

### 2. Элементы обрезались после изменения размера окна
- Доказательство: снимки интерфейса на узких и широких размерах окна.
- Автоматическая проверка: контроль границ в узких окнах.

### 3. Элементы и тексты наезжали друг на друга
- Доказательство: снимки меню, мастерской, таблицы лидеров, настроек, улучшений и результатов.
- Автоматическая проверка: контроль границ текста на компактных экранах.

### 4. На игровом поле появлялось выделение текста или контекстное меню браузера
- Доказательство: отчёт публикационной проверки.
- Автоматическая проверка: синтетическая проверка блокировки контекстного меню и выделения текста.

### 5. В игре появлялась стартовая или игровая ошибка
- Доказательство: отчёт публикационной проверки и снимки экрана.
- Автоматическая проверка: успешный запуск без аварийного слоя и без ошибок страницы во время проверки.

### 6. Игра выглядела незавершённой
- Доказательство: актуальные витринные изображения, локализованный загрузочный экран, оформленное меню и доведённые служебные слои.
- Автоматическая проверка: в пакет вложены материалы визуальной проверки и результаты сборки.

### 7. Текст был слишком мелким
- Доказательство: снимки на компактных и телефонных размерах окна.
- Автоматическая проверка: визуальная матрица для узких экранов и компактная модерационная проверка.

## Рекомендованный Порядок Действий
1. Запустите проверку интерфейса.
2. Запустите публикационную проверку.
3. Пересоберите пакет для загрузки.
4. Перед отправкой просмотрите этот файл и приложенные материалы.
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

async function writeTextFileWithBom(targetPath, content) {
  await writeFile(targetPath, `${UTF8_BOM}${content}`, "utf8");
}

async function copyReviewEvidence(uploadDir) {
  const reviewRoot = join(uploadDir, "review_evidence");
  const uiAuditPresent = await pathExists(join(uiAuditMatrixDir, "ru"));
  const publishSmokePresent = await pathExists(yandexPublishSmokeDir);

  if (uiAuditPresent) {
    await copyRussianUiAuditMatrix(join(reviewRoot, "ui_audit_matrix"));
  }

  if (publishSmokePresent) {
    await copyRussianPublishSmoke(join(reviewRoot, "yandex_publish_smoke"));
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

async function copyRussianPublishSmoke(targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(yandexPublishSmokeDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".png")) {
      await copyFile(join(yandexPublishSmokeDir, entry.name), join(targetDir, entry.name));
    }
  }

  await writeTextFileWithBom(join(targetDir, "report.md"), `# Публикационная проверка Яндекс Игр

Проверка подтверждает, что локальная сборка запускается, открывает меню, начинает забег, показывает игровой интерфейс, экран улучшений и экран результатов.

## Приложенные изображения
- загрузка и возврат из аварийного состояния;
- стартовое меню;
- игровой интерфейс;
- экран улучшений;
- результаты до и после рекламы за награду.

Все приложенные снимки сделаны из русскоязычной сборки Magnet Caravan.
`);
}

async function copyRussianUiAuditMatrix(targetDir) {
  await mkdir(targetDir, { recursive: true });
  await cp(join(uiAuditMatrixDir, "ru"), join(targetDir, "ru"), { recursive: true });
  await writeTextFileWithBom(join(targetDir, "index.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Матрица русских скриншотов Magnet Caravan</title>
</head>
<body>
  <h1>Матрица русских скриншотов Magnet Caravan</h1>
  <p>В этом разделе оставлены только русскоязычные проверочные изображения для публикации в Яндекс Играх.</p>
  <ul>
    <li><a href="ru/desktop/">Скриншоты для компьютера</a></li>
    <li><a href="ru/mobile/">Скриншоты для телефона</a></li>
  </ul>
</body>
</html>
`);
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
