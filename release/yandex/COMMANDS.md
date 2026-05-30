# Команды пересборки материалов Яндекс Игр

`package.json` намеренно НЕ менялся — все команды для публикационных материалов вынесены сюда. Скрипты лежат в `release/yandex/tools/` и не влияют на runtime игры.

## Зависимости

- Node 18+ (репозиторий).
- `node_modules/ffmpeg-static/ffmpeg.exe` — уже установлен (часть devDependencies).
- Playwright (`@playwright/test`) — уже установлен.

## Пересоздать скриншоты (RU)

```bash
# Поднимает Vite (mock-адаптер), снимает геймплей в docs/promo/yandex/,
# затем копирует в release/yandex/images/ под целевыми именами.
node release/yandex/tools/capture-screenshots.mjs
```

## Пересоздать скриншоты (EN)

```bash
# Поднимает Vite, заранее ставит save.settings.language="en" в localStorage,
# снимает 4 desktop + 2 mobile EN-скриншота в release/yandex/images/screenshots/en/
# и доп. EN icon/cover в release/yandex/images/en/.
node release/yandex/tools/capture-en-screenshots.mjs
```

## Пересоздать видео (RU)

```bash
# Прогоняет существующий пайплайн media:yandex + media:yandex:promo,
# затем копирует ролики в release/yandex/videos/ под целевыми именами.
node release/yandex/tools/record-video.mjs
```

## Пересоздать видео (EN)

```bash
# Поднимает Vite с английской локалью, через Playwright recordVideo пишет
# 18–20-секундный геймплей, ffmpeg перекодирует в:
#   release/yandex/videos/en/gameplay-horizontal-16x9.mp4
#   release/yandex/videos/en/gameplay-vertical-9x16.mp4
#   release/yandex/videos/en/promo-horizontal-16x9.mp4
#   release/yandex/videos/en/promo-vertical-9x16.mp4
node release/yandex/tools/capture-en-videos.mjs
```

При желании можно запустить только базовый геймплей без рекламных вариантов:

```bash
npm run media:yandex
node release/yandex/tools/record-video.mjs
```

## Проверки

```bash
# Длины и язык карточных текстов
node release/yandex/tools/check-texts.mjs

# Размер, формат, пропорции картинок и скриншотов
node release/yandex/tools/check-images.mjs

# Контейнер, кодек, длительность, разрешение, размер файлов
node release/yandex/tools/check-videos.mjs

# Все проверки разом + итоговый отчёт publication-readiness-report.md
node release/yandex/tools/generate-report.mjs
```

## Точечные ffmpeg-команды (если нужно ручное вмешательство)

Создание hero-баннера 1560×520 из обложки:

```bash
node_modules/ffmpeg-static/ffmpeg.exe -y -i docs/promo/yandex/card/cover_800x470.png \
  -vf "scale=1560:-1:flags=lanczos,crop=1560:520:0:(in_h-520)/2,format=rgb24" \
  release/yandex/images/hero-1560x520.png
```

Перекодировка готового MOV/MP4 в формат, точно проходящий проверку Яндекс Игр:

```bash
node_modules/ffmpeg-static/ffmpeg.exe -y -i input.mp4 \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 22 \
  -movflags +faststart -c:a aac -b:a 96k -ac 2 -ar 44100 \
  release/yandex/videos/output.mp4
```

Обрезка длительности (для рекламы, 10–20 сек):

```bash
node_modules/ffmpeg-static/ffmpeg.exe -y -ss 0 -t 18 -i input.mp4 -c copy output.mp4
```

## Если нужно добавить в package.json (по отдельному разрешению)

Безопасный набор команд для `package.json["scripts"]` (нынешний проект НЕ модифицирован):

```json
"yandex:screenshots":          "node release/yandex/tools/capture-screenshots.mjs",
"yandex:video:all":            "node release/yandex/tools/record-video.mjs",
"yandex:check:texts":          "node release/yandex/tools/check-texts.mjs",
"yandex:check:images":         "node release/yandex/tools/check-images.mjs",
"yandex:check:videos":         "node release/yandex/tools/check-videos.mjs",
"yandex:check:all":            "node release/yandex/tools/generate-report.mjs"
```

Эти строки не влияют на runtime и build. Добавление потребует отдельного разрешения по правилам задачи.
