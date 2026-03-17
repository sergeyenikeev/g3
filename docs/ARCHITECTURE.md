# Архитектура Magnet Caravan

## Технологии

- Phaser 3
- TypeScript
- Vite
- Vitest (unit/integration)
- Playwright (e2e)

## Data-driven

Базовый принцип: баланс и поведение тюнятся через JSON из `public/assets/data/`.
Код не содержит «магических» чисел баланса (скорости/радиусы/кд/таблицы редкости и т.п.) — всё берётся из конфигов и модифицируется через эффекты (`add/mul/set` по `path`).

## Основные подсистемы

### RuntimeConfig

`src/data/runtimeConfig.ts` собирает конфигурацию из:
- `balances.json` (база)
- `enemies.json`
- `wave_sets.json` + `patterns.json`
- `daily.json`
- `run_upgrades.json`
- `balance_presets.json` (preset overrides)
- `meta_tree.json` (meta effects)

Далее поверх RuntimeConfig применяются:
- daily modifiers (в daily-режиме)
- эффекты апгрейдов (внутри забега)

### Директор волн

Логика генерации волны находится в `src/game/director/`.
Ключевые правила:
- safe spawn distance от игрока и recycler
- telegraph перед спавном
- caps по shooters/cutters/total
- pressure gating: если pressure > targetMax — уменьшение спавнов и компенсация scrap
- breather каждые N волн
- anti-snowball при низком HP

### PlatformAdapter

`src/platform/` содержит слой адаптации под порталы:
- `showInterstitial()`
- `showRewarded(placement)`
- `save()/load()`

Для разработки/тестов используется mock-адаптер.
Активно поддерживаемые release-цели: `web`, `yandex`, `vk`.
`scripts/build_release.mjs` собирает отдельные ZIP только для этих целей, а `src/platform/sdk/loadPlatformSdk.ts` подгружает SDK только там, где они ещё используются.

### Сохранения

`src/platform/save/saveManager.ts`:
- версионирование схемы
- хранение настроек (звук), статов, tutorial-флагов, meta уровней

## Сцены Phaser

- `BootScene`: загрузка JSON + audio, инициализация адаптера/сейва
- `MenuScene`: старт обычного/дневного забега и отдельного `TRAINING`
- `GameScene`: основной геймплей (магнит, хвост, враги, flip, recycler, волны) + облегчённый training flow
- `UIScene`: HUD + mobile-first контролы + onboarding tutorial + режим обучения + аудио-старт по user interaction
- `UpgradeScene`: выбор апгрейда между волнами
- `ResultsScene`: экран результатов
