# Релиз

## Что делает build_release

Команда: `npm run build:release`

Последовательность:
1) `bom-check`, `lint`, `typecheck`
2) `test:unit` + `test:integration`
3) `vite build` (production)
4) упаковка `dist/` в ZIP под платформы:
   - `dist/releases/magnet-caravan_crazygames.zip`
   - `dist/releases/magnet-caravan_poki.zip`
   - `dist/releases/magnet-caravan_yandex.zip`
   - `dist/releases/magnet-caravan_vk.zip`

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

