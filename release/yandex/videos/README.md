# Видео для Яндекс Игр

Все четыре ролика собраны из реального геймплея Magnet Caravan, без фейковой механики и без debug-оверлеев.

## Состав

### Русская версия (корень `videos/`)

| Файл | Назначение | Формат | Разрешение | Длительность |
|------|------------|--------|------------|--------------|
| `gameplay-horizontal-16x9.mp4` | Горизонтальное видео геймплея, RU UI | MP4 / H.264 | 1920×1080 | 18 сек |
| `gameplay-vertical-9x16.mp4` | Вертикальное видео геймплея, RU UI | MP4 / H.264 | 1080×1920 | 18 сек |
| `promo-horizontal-16x9.mp4` | Горизонтальный рекламный ролик, RU UI | MP4 / H.264 | 1920×1080 | 18 сек |
| `promo-vertical-9x16.mp4` | Вертикальный рекламный ролик, RU UI | MP4 / H.264 | 1080×1920 | 18 сек |

### Английская версия (`videos/en/`)

| Файл | Назначение | Формат | Разрешение | Длительность |
|------|------------|--------|------------|--------------|
| `en/gameplay-horizontal-16x9.mp4` | Горизонтальный геймплей, EN UI | MP4 / H.264 | 1920×1080 | 20 сек |
| `en/gameplay-vertical-9x16.mp4` | Вертикальный геймплей (blurred-pad из 16:9), EN UI | MP4 / H.264 | 1080×1920 | 20 сек |
| `en/promo-horizontal-16x9.mp4` | Горизонтальный рекламный ролик, EN UI | MP4 / H.264 | 1920×1080 | 18 сек |
| `en/promo-vertical-9x16.mp4` | Вертикальный рекламный ролик, EN UI | MP4 / H.264 | 1080×1920 | 18 сек |

Все файлы укладываются в лимиты Яндекс Игр: длительность ≤ 28 сек для геймплейных, 10–20 сек для рекламных, размер ≤ 100 MB.

## Сценарии

См. `storyboards.md`.

## Проверка

См. `video-check-report.md` (создаётся командой `node release/yandex/tools/check-videos.mjs`).

## Пересборка

См. корневой `release/yandex/COMMANDS.md`.

Кратко, минимальный путь:

```bash
# RU: снять реальный геймплей через готовый pipeline проекта
npm run media:yandex
npm run media:yandex:promo
node release/yandex/tools/record-video.mjs

# EN: записать английский геймплей через Playwright + ffmpeg
node release/yandex/tools/capture-en-videos.mjs

# Проверить оба набора
node release/yandex/tools/check-videos.mjs
```
