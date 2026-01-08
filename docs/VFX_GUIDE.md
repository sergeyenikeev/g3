# VFX Guide (Magnet Caravan)

Документ описывает: какие события существуют, какие эффекты на них вешаются, и какие ограничения по производительности обязательны.

## 1) Архитектура
- Единая точка: `src/visual/VfxManager.ts`
- API:
  - `emit(eventName, params)` — вызвать эффект по событию
  - `update(dt)` — обновить активные эффекты
  - `setQuality(q)` — переключить пресет качества
- Источник событий: `this.game.events` (Phaser EventEmitter), константы в `src/game/events.ts`.

## 2) Текстуры VFX
Все ключи/имена текстур:
- `vfx_ring` — кольцо (burst)
- `vfx_glow_blob` — мягкое свечение (под кнопками/объектами), blend `ADD`
- `vfx_spark` — искра/частица
- `vfx_smoke_puff` — дымок/пыль (в т.ч. fog layer)
- `vfx_trail` — сегмент трейла
- `vfx_hit_flash` — вспышка попадания
- `vfx_line` — 1x64 линия (растягиваем для “магнитных линий”)

Генерация/фолбэк: `src/visual/TextureFactory.ts` + `npm run visual:generate`.

## 3) Ограничения производительности (обязательные)
- Пресеты качества: `low` / `medium` / `high`
- Частицы (cap): `low=120`, `medium=220`, `high=360`
- Магнитные линии:
  - cap: `low=4`, иначе `8`
  - throttle: не чаще 1 раза в `120ms`
- Не использовать дорогие шейдеры: glow имитируется спрайтами с blend `ADD`.

## 4) Таблица событий → эффект

| Событие | Где эмитится | Payload | Что происходит |
|---|---|---|---|
| `scrap_collected` | `GameScene` | `{ x, y, type, tex }` | pop + искры; (опционально) fly-to-ui |
| `flip_used` | `GameScene` / UI | `{ x, y, radius }` | ring burst + sparks + micro shake |
| `projectile_deflected` | `GameScene` | `{ x, y }` | мини burst искр + мини-ring |
| `player_hit` | `GameScene` | `{ x, y, damage }` | hit flash + sparks + красный vignette pulse |
| `tail_cut` | `GameScene` | `{ x, y, segmentsLost, segments[] }` | sparks + smoke puff + разлёт фрагментов с трейлом |
| `bank_complete` | `GameScene` | `{ x, y, bolts, hpHealed }` | зелёные частицы + pulse; (опционально) fly-to-ui |
| `wave_start` | `GameScene` | `{ waveIndex }` | лёгкая пыль/фоновые искры |
| `upgrade_offer_shown` | `UpgradeScene` | `{}` | UI glow/slide-in у карточек |
| `upgrade_picked` | `UpgradeScene` | `{ upgradeId, rarity }` | “stamp” + искры по цвету редкости (в UI) |

Примечания:
- Реальные реализации эффектов и параметры находятся в `src/visual/VfxManager.ts`.
- Цвета редкости должны соответствовать `docs/ART_STYLE.md` (и `VISUAL_PALETTE`).

## 5) Как добавить новый триггер
1) Добавить константу события в `src/game/events.ts`.
2) Эмитить событие из нужного места (`this.game.events.emit(...)`).
3) Добавить обработчик в `VfxManager.emit()` и реализацию эффекта.
4) Проверить caps (частицы/линии) и добавить unit-тест при необходимости.
