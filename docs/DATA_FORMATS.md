# Форматы данных (JSON)

Все JSON лежат в `public/assets/data/` и загружаются на старте.

## balances.json

Секции:
- `player`: скорость, HP, инвулн и т.п.
- `dash`: параметры рывка
- `magnet`: радиус и сила притяжения scrap
- `tail`: параметры хвоста (spacing, лимиты, потери)
- `flip`: кулдаун, радиус/сила пульса, дефлект, шрапнель
- `scrap`: параметры спавна scrap (кластеры, типы, веса)
- `recycler`: зона сдачи хвоста (радиус, bankTime, лечение, начисление bolts)
- `arena`: размеры арены и позиция recycler
- `waves`: длительность волн, скейлинг врагов, бюджет
- `director`: правила спавна, caps, breather, anti-snowball, pressure
- `ads`: настройки рекламы (cooldown interstitial, rewarded-плейсменты)
- `upgradeRarityRoll`: таблицы редкости и pity

Добавленные поля (важные для data-driven):
- `scrap.clusterCountBase / clusterCountPerWave / clusterCountCap / clusterRadius`
- `arena.width / arena.height / arena.recyclerPos`
- `ads.interstitialCooldownSec / ads.disableInterstitialUntilTutorialDone / ads.interstitialMinRunsCompleted / ads.noInterstitialAfterRewardedSec`
- `ads.rewarded.revive / ads.rewarded.x2Results / ads.rewarded.reroll`

## enemies.json

Три базовых типа:
- `chaser`: преследует игрока, контактный урон/нокбэк
- `shooter`: держит дистанцию, стреляет снарядами
- `cutter`: охотится за хвостом и «режет» сегменты

## wave_sets.json

Набор правил и стоимости врагов:
- `rules`: минимальная волна для shooter/cutter, лимиты на cutters до 10-й волны
- `enemyCosts`: стоимость врагов для бюджета волны
- `waveScript`: явные бюджеты/миксы для ранних волн

## patterns.json

`patterns[]` — шаблоны спавна внутри волны:
- `id`, `weight`, `minWave`
- `spawns[]`: список событий `{t, type, count, formation, ...}`
- `capsOverride` (опционально)
- `special` (опционально): например `breather`

Поддерживаемые `formation`:
- `arc`
- `opposite`
- `corners`
- `random_ring`
- `behind_tail_bias`

## daily.json

Daily seed: `utc_date_yyyymmdd`.

- `dailyVariants[]`: выбор варианта дня по весам
- `modifiers`: список эффектов (`add/mul/set`) по `path`
- `ui.title/ui.desc` (опционально): отображение варианта дня в UI
- `specialRule`: доп.правила (например, «двойные shooter волны», больше heavy scrap)

## run_upgrades.json

Список апгрейдов на забег:
- `id`, `rarity`, `weight`, `maxStacks`
- `ui.title/ui.desc` — отображение в UI
- `effects[]`:
  - `add/mul/set` по `path` в RuntimeConfig
  - `heal`
  - `grant_perk` (включает особые механики)

## balance_presets.json

Пресеты сложности/режима:
- `id`, `name`
- `overrides`: частичные оверрайды поверх `balances`
- `overrides.enemies`: мультипликаторы для врагов

## meta_tree.json

Meta прогрессия:
- `nodes[]`: дерево/узлы прокачки
- `effectsPerLevel` и/или `effects`: эффекты (как у апгрейдов)
