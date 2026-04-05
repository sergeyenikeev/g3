# Релиз

## Что делает build_release

Команда: `npm run build:release`

Последовательность:
1) `bom-check`, `lint`, `typecheck`
2) `test:unit` + `test:integration`
3) `vite build` (production) отдельно для активных целей:
   - `web` (`VITE_PLATFORM_ADAPTER=local`)
   - `generic` (`VITE_PLATFORM_ADAPTER=generic`)
   - `yandex`
   - `vk`
   в `dist/platform_builds/<target>/`
4) упаковка каждого билда в ZIP под платформы:
   - `dist/releases/magnet-caravan_web.zip`
   - `dist/releases/magnet-caravan_generic.zip`
   - `dist/releases/magnet-caravan_yandex.zip`
   - `dist/releases/magnet-caravan_vk.zip`

Неподдерживаемые release-режимы:
- `crazygames`
- `poki`
- `itchio`
- `newgrounds`

## Чеклист релиза

- `npm run bom-check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:e2e`
- `npm run build:release`
- проверить запуск `index.html` из архива (локально / на портале)
- убедиться, что музыка не стартует до первого клика/тапа

## Яндекс Игры

Что теперь входит в release-подготовку под Яндекс:
- yandex build по умолчанию грузит SDK через `/sdk.js`, как ожидает архивная публикация в Яндекс Играх
- `LoadingAPI.ready()` отправляется после bootstrap и выхода в главное меню
- `GameplayAPI.start()` и `GameplayAPI.stop()` привязаны к реальному игровому lifecycle: старт забега, пауза, экран апгрейда, revive, results, возврат в меню
- автоязык для режима `auto` берётся из SDK (`environment.i18n.lang`), а daily UTC-дата опирается на `serverTime()`
- сохранения для Яндекса идут через `player.setData()` / `player.getData()` с локальным fallback

Что загружать в консоль:
- архив: `dist/releases/magnet-caravan_yandex.zip`
- тексты: `docs/platform_texts/yandex_ru.md` и `docs/platform_texts/yandex_en.md`

Что важно отметить в карточке игры:
- ориентация: landscape
- платформы: desktop + mobile
- монетизация: только через платформенный SDK
- cloud save: включать, если публикация идёт именно для Яндекс Игр

## Для других площадок

Чтобы поэтапно переносить игру на другие витрины, платформенный контракт теперь опирается не только на рекламу и save/load, но и на:
- language hint
- server time
- loading ready hook
- gameplay start/stop hooks

Для новой площадки достаточно расширить `PlatformAdapter` и не вшивать SDK-логику в Phaser-сцены.

База для следующего порта уже подготовлена:
- архив: `dist/releases/magnet-caravan_generic.zip`
- тексты: `docs/platform_texts/generic_ru.md` и `docs/platform_texts/generic_en.md`
- креативы: `docs/promo/yandex/` как стартовый набор для адаптации под новую витрину
