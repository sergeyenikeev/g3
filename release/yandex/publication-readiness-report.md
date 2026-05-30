# Готовность к публикации в Яндекс Игры — Magnet Caravan

Дата: 2026-05-27.
Версия карточки: 1.0.0.
Локализации: RU + EN.
Готовность: **READY**.

## Сводный результат

| Раздел | Проверка | Результат |
|--------|----------|-----------|
| Тексты | `release/yandex/tools/check-texts.mjs` | 0 проблем |
| Картинки | `release/yandex/tools/check-images.mjs` | 0 проблем |
| Видео | `release/yandex/tools/check-videos.mjs` | 0 проблем |

Все три раздела автогенерируемых отчётов закрыты без замечаний:

- [`checklists/text-check-report.md`](./checklists/text-check-report.md)
- [`checklists/image-check-report.md`](./checklists/image-check-report.md)
- [`videos/video-check-report.md`](./videos/video-check-report.md)

Аудит проекта: [`publication-audit.md`](./publication-audit.md).

## Что готово и что грузить в консоль Яндекс Игр

| Поле / артефакт | Файл |
|-----------------|------|
| Карточные тексты RU (markdown) | `texts/yandex-draft-ru.md` |
| Карточные тексты RU (JSON для копипасты) | `texts/yandex-draft-ru.json` |
| Карточные тексты EN (markdown) | `texts/yandex-draft-en.md` |
| Карточные тексты EN (JSON для копипасты) | `texts/yandex-draft-en.json` |
| Иконка карточки | `images/icon-512.png` |
| Альтернативная иконка | `images/icon-512-alt-01.png` |
| Обложка карточки | `images/cover-800x470.png` |
| Альтернативная обложка | `images/cover-800x470-alt-01.png` |
| Hero-баннер (опционально) | `images/hero-1560x520.png` |
| Скриншоты Desktop RU (4 шт.) | `images/screenshots/screenshot-desktop-0{1..4}.png` |
| Скриншоты Mobile landscape RU (2 шт.) | `images/screenshots/screenshot-mobile-landscape-0{1,2}.png` |
| Иконка/обложка EN | `images/en/icon-512.png`, `images/en/cover-800x470.png` |
| Скриншоты Desktop EN (4 шт.) | `images/screenshots/en/screenshot-desktop-0{1..4}.png` |
| Скриншоты Mobile landscape EN (2 шт.) | `images/screenshots/en/screenshot-mobile-landscape-0{1,2}.png` |
| Геймплейное видео RU 16:9 | `videos/gameplay-horizontal-16x9.mp4` |
| Геймплейное видео RU 9:16 | `videos/gameplay-vertical-9x16.mp4` |
| Рекламный ролик RU 16:9 | `videos/promo-horizontal-16x9.mp4` |
| Рекламный ролик RU 9:16 | `videos/promo-vertical-9x16.mp4` |
| Геймплейное видео EN 16:9 | `videos/en/gameplay-horizontal-16x9.mp4` |
| Геймплейное видео EN 9:16 | `videos/en/gameplay-vertical-9x16.mp4` |
| Рекламный ролик EN 16:9 | `videos/en/promo-horizontal-16x9.mp4` |
| Рекламный ролик EN 9:16 | `videos/en/promo-vertical-9x16.mp4` |

Для основного черновика берите:
- иконку `icon-512.png`,
- обложку `cover-800x470.png`,
- 4 скриншота десктопа RU (`01..04`),
- 2 скриншота мобильного режима RU,
- 4 видео RU (два геймплея + два промо).

Для английской локализации в консоли черновика подложите:
- 4 EN-скриншота десктопа из `screenshots/en/`,
- 2 EN-скриншота мобильного режима из `screenshots/en/`,
- 4 EN-видео из `videos/en/`,
- при желании — EN-обложку/иконку из `images/en/` (отличаются цветом меню).

## Оставшиеся риски

| Риск | Уровень | Что делать |
|------|---------|------------|
| Тихая аудиодорожка в видеороликах (~2 kb/s) | низкий | Допустимо: в текущей версии не используются внешние треки. При желании можно подмешать музыкальный луп `public/assets/audio/music_loop.mp3` через `release/yandex/tools/record-video.mjs` — потребует отдельной правки команды ffmpeg. |
| `docs/platform_texts/yandex_en.md` содержит русский текст | средний | Сами тексты карточки взяты из `release/yandex/texts/yandex-draft-en.md`. Если модерация захочет «английский файл в repo» — можно отдельным PR синхронизировать `docs/platform_texts/yandex_en.md` с новым английским драфтом. См. раздел «Требуется отдельное разрешение». |
| Версия карточки 1.0.0 vs `package.json` 0.1.0 | низкий | Версия карточки уведомительная; внутренний `package.json` оставлен без изменений. |

## Найденные проблемы в самой игре

Код игры в рамках этой задачи не правился. Зафиксированные косвенные дефекты только описаны:

1. `docs/platform_texts/yandex_en.md` — англоязычная версия отсутствует (внутри — русский текст). Не блокирует публикацию: в карточке используется `release/yandex/texts/yandex-draft-en.md`.
2. `scripts/assemble_yandex_upload.mjs` — внутри строки в нечистой UTF-8 (видны как «РЇ…», «РђР…»). Скрипт работает, но при правке текста карточки внутри `package.json` или `assemble_yandex_upload` нужно прогнать `npm run fix-bom` и сохранить в UTF-8 с BOM.

## Что нужно сделать вручную

1. Открыть консоль Яндекс Игр → создать новую игру или открыть существующий черновик.
2. В разделе «Локализация» создать два языка: Русский и Английский.
3. Для Русского вставить значения из `texts/yandex-draft-ru.json` (или скопировать руками из `.md`).
4. Для Английского — `texts/yandex-draft-en.json` / `.md`.
5. Загрузить файлы:
   - Иконка: `images/icon-512.png`
   - Обложка: `images/cover-800x470.png`
   - 4 скриншота RU: `images/screenshots/screenshot-desktop-01..04.png`
   - 2 мобильных скриншота RU: `images/screenshots/screenshot-mobile-landscape-01..02.png`
   - 2 геймплейных видео RU: `videos/gameplay-horizontal-16x9.mp4`, `videos/gameplay-vertical-9x16.mp4`
   - 2 промо-видео RU: `videos/promo-horizontal-16x9.mp4`, `videos/promo-vertical-9x16.mp4`
   - В EN-локализацию: 6 скриншотов из `images/screenshots/en/` и 4 видео из `videos/en/`.
6. Поставить чекбоксы: «Облачные сохранения — включено», «Платформы — Компьютер + Телефон», «Ориентация — Горизонтальная», «Возраст — 12+».
7. Категории: «Аркады», «Экшен». Теги — из `tags` в JSON. Ключевые слова — из `keywords`.
8. В поле «Комментарий разработчика» вставить значение `moderationComment` из JSON.
9. Загрузить архив самой игры командой `npm run package:yandex` (это не часть данной задачи — управляется существующим пайплайном репозитория).

## Что точно не делалось

- Не менялся код игры.
- Не менялся `package.json`.
- Не менялись `dependencies` / `devDependencies` / runtime-конфиги.
- Не вносились правки в SDK-интеграцию, UI, игровую логику и production build.

Все добавленные файлы лежат изолированно в `release/yandex/` и в `release/yandex/tools/`. Удаление этой папки полностью обнуляет вклад задачи.

## Требуется отдельное разрешение (если захотите сделать)

1. Заменить русский текст в `docs/platform_texts/yandex_en.md` на полноценный английский (готовый текст — `release/yandex/texts/yandex-draft-en.md`).
2. Прогнать `npm run fix-bom` и пересохранить `scripts/assemble_yandex_upload.mjs` в UTF-8 с BOM, чтобы убрать артефакты кодировки в служебных строках.
3. При желании — расширить `package.json["scripts"]` командами из `release/yandex/COMMANDS.md` (`yandex:check:*`, `yandex:screenshots`, `yandex:video:all`). Это не влияет на runtime.
