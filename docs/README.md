# Magnet Caravan — документация проекта

## Быстрый старт

Требования:
- Node.js 22+ (рекомендуется)

Установка:
1) `npm install`
2) (опционально) сгенерировать аудио: `npm run audio:generate`
3) запуск: `npm run dev`

Сборка:
- production: `npm run build`
- preview: `npm run preview`

## Что есть в меню

- Быстрые настройки `GFX / SFX / MUSIC` сохраняются в сейв и применяются в следующих запусках.
- Daily режим показывает текущий seed/вариант дня, best за сегодня и статус следующего старта: free / rewarded / locked.

## Тесты и проверки

- Проверка BOM/UTF-8: `npm run bom-check`
- Авто-исправление BOM: `npm run fix-bom`
- Линтер: `npm run lint`
- TypeScript: `npm run typecheck`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- E2E (Playwright): `npm run test:e2e`

## Скрипты сборки

- Для тестирования с моками: `npm run build:test-mock`
  - включает mock-адаптер платформ
  - прогоняет `bom-check`, `lint`, `typecheck`, unit+integration+e2e
  - собирает `dist-mock/`

- Для релиза: `npm run build:release`
  - прогоняет `bom-check`, `lint`, `typecheck`, unit+integration
  - делает production build
  - формирует ZIP архивы в `dist/releases/`

## Структура проекта (коротко)

- `public/assets/data/` — все JSON конфиги (баланс/враги/волны/апгрейды/daily и т.д.)
- `public/assets/audio/` — MP3 (генерируются скриптом и коммитятся)
- `src/` — исходники игры (Phaser 3 + TS)
- `tests/` — unit/integration (Vitest)
- `e2e/` — e2e (Playwright)
- `scripts/` — сборка/релиз/кодировка/аудио
- `docs/` — документация (UTF-8 с BOM)

## Кодировка (важно)

Все русскоязычные `.md` файлы в `docs/` должны быть в UTF-8 с BOM.
- Проверка: `npm run bom-check`
- Исправление: `npm run fix-bom`

См. также:
- `docs/ARCHITECTURE.md`
- `docs/DATA_FORMATS.md`
- `docs/TESTING.md`
- `docs/RELEASE.md`
