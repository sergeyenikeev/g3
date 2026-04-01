# Тестирование

## Unit (Vitest)

Запуск: `npm run test:unit`

Покрывает:
- PRNG/seed (детерминизм)
- применение эффектов (`add/mul/set/heal/grant_perk`) по `path`
- ролл редкости апгрейдов + pity
- выбор апгрейдов (без дублей, maxStacks)
- pressure вычисление + targetMin/Max

## Integration (Vitest)

Запуск: `npm run test:integration`

Покрывает:
- загрузку JSON и сборку RuntimeConfig (preset/meta/daily modifiers)
- генерацию волны (wave_sets + patterns + director rules)
- сохранение/загрузка (через mock adapter)
- daily attempts: free vs rewarded vs boosted entry planning

## E2E (Playwright)

Запуск: `npm run test:e2e`

Скрипт автоматически подбирает свободный локальный порт для Vite dev server, чтобы e2e не падали, если `4173` уже занят другой вкладкой или процессом.

Сценарий:
- вход в отдельный `TRAINING` и выход обратно в меню
- старт игры
- flip
- сдача хвоста в recycler (bank)
- выход на экран выбора апгрейда

E2E режим включает ускорение волн через `VITE_E2E=1` (используется в `playwright.config.ts`).

## CI

GitHub Actions запускает:
- `bom-check`
- `lint`
- `typecheck`
- unit + integration
- e2e (Playwright chromium)
