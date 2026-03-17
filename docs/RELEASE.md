# Релиз

## Что делает build_release

Команда: `npm run build:release`

Последовательность:
1) `bom-check`, `lint`, `typecheck`
2) `test:unit` + `test:integration`
3) `vite build` (production) отдельно для активных целей:
   - `web` (`VITE_PLATFORM_ADAPTER=local`)
   - `yandex`
   - `vk`
   в `dist/platform_builds/<target>/`
4) упаковка каждого билда в ZIP под платформы:
   - `dist/releases/magnet-caravan_web.zip`
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
