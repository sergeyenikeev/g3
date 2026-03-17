# База знаний (Codex)
# docs/knowledge_base.md
# Magnet Caravan — База знаний проекта (Knowledge Base)
# ВАЖНО: этот файл — единый источник “как делаем проект”. Следовать ему обязательно.

Версия: 1.0
Язык: русский
Кодировка: UTF-8 с BOM (обязательно)

- Всегда отвечать на русском языке.
- Документацию и инструкции с русским текстом сохранять в UTF-8 с BOM, не использовать CP1251; проверять кодировку, чтобы не появлялись вопросительные знаки вместо русских букв.
- Не изменять и не коммитить файл `notouch.txt`.
- Git: не коммитить `notouch.txt`, пушить рабочие изменения проекта.
- Основные документы:
  - План разработки: `docs/system_plan.md`, `docs/GDD.md` и `docs/task.md`.
  - GDD: `docs/GDD.md`.
  - QA: `docs/qa_plan.md`, чеклист релиза `docs/release_checklist.md`.
  - UI/UX: `docs/ui_ux_recommendations.md`.
  - DevOps/запуск: `docs/devops_automation.md`, `docs/build_and_run.md`.
  - OPS: `docs/ops_recommendations.md`.
- Требования платформ CrazyGames, яндекс выполнять строго (SDK, офлайн-режим, монетизация).
- Если что-то нельзя сделать автоматически — выдавать пошаговые инструкции.

====================================================================
0) КРАТКО: ЧТО ЭТО ЗА ПРОЕКТ
====================================================================
Magnet Caravan — HTML5 игра (2D top-down arcade survival / run-based rogue-lite) для порталов:
- CrazyGames (primary)
- Poki
- Яндекс Игры
- VK

Технологии:
- TypeScript
- Phaser 3
- Vite
- Data-driven баланс и контент через JSON в public/assets/data
- Тесты: unit + integration (Vitest), e2e (Playwright)
- Два сборочных скрипта:
  - scripts/build_test_mock.mjs (моки + тесты)
  - scripts/build_release.mjs (без моков + zip релизы)

====================================================================
1) НЕПЕРЕГОВОРНЫЕ ТРЕБОВАНИЯ (NON-NEGOTIABLES)
====================================================================
1.1 Русский язык
- Коммуникация с пользователем — ТОЛЬКО на русском.
- Документация: основная — на русском. Тексты для платформ — RU и EN.

1.2 Кодировка RU документов
- Любые документы/инструкции на русском языке сохранять в UTF-8 с BOM.
- НЕ использовать CP1251.
- Обязательны:
  - scripts/check_bom.mjs — проверка UTF-8 + BOM
  - scripts/fix_bom.mjs — автоматическое исправление
- В CI и в build скриптах проверка BOM должна падать ошибкой при нарушениях.

1.3 Git и безопасность
- Все изменения коммитить в git.
- Не коммитить/не пушить:
  - notouch.txt (никогда не трогать)
  - секреты, ключи, токены, приватные конфиги SDK
  - .env* (кроме .env.example)
- Убедиться, что .gitignore покрывает перечисленное.
- Не добавлять “тяжёлые”/лишние бинарники в репо без необходимости.
- Любые сторонние ассеты: только легальные. Без “скачал из интернета без лицензии”.

1.4 Data-driven без хардкодов баланса
- Баланс/волны/паттерны/daily/апгрейды должны настраиваться через JSON.
- Хардкод допускается только для:
  - безопасных дефолтов при отсутствии файлов
  - технических лимитов/guards (например, clamps, защита от NaN)

1.5 Портальная универсальность
- PlatformAdapter обязателен:
  - mock адаптер для dev/test
  - prod адаптеры (CrazyGames/Poki/Yandex/VK) с безопасной деградацией
- Если SDK отсутствует — игра не падает, реклама/сохранение просто отключаются.

1.6 Тестирование “как продукт”
- Обязательны:
  - Unit tests: логика конфигов, PRNG, выбор апгрейдов, директор
  - Integration tests: сборка RuntimeConfig, генерация волн без рендера, сохранения
  - E2E tests: запуск игры, туториал, flip, recycler, апгрейд, results, daily
- CI обязательно запускает все ключевые проверки.

====================================================================
2) СТРУКТУРА ПРОЕКТА (ОБЯЗАТЕЛЬНАЯ РЕКОМЕНДАЦИЯ)
====================================================================
/public
  /assets
    /data
      balances.json
      enemies.json
      wave_sets.json
      patterns.json
      daily.json
      run_upgrades.json
      (опционально) balance_presets.json
      (опционально) meta_tree.json
    /audio
      *.mp3
/src
  /app (boot/init)
  /core (utils, math, prng, deep-path, events)
  /data (loader, validators, runtime config builder)
  /game (scenes, entities, systems)
  /platform (adapters, analytics, save)
  /ui (hud, menus, upgrade screen, tutorial)
  /tests (unit/integration helpers)
/scripts
  build_test_mock.mjs
  build_release.mjs
  check_bom.mjs
  fix_bom.mjs
  (опционально) generate_audio_assets.mjs
/docs
  knowledge_base.md (этот файл)
  README.md
  ARCHITECTURE.md
  DATA_FORMATS.md
  TESTING.md
  RELEASE.md
  /platform_texts
    yandex_ru.md / yandex_en.md
    vk_ru.md / vk_en.md

====================================================================
3) КОНФИГИ И ИХ СМЫСЛ (DATA FORMAT OVERVIEW)
====================================================================
3.1 balances.json
- Базовый баланс игрока/магнита/хвоста/flip/скрапа/переработчика.
- director: правила спавна, caps, pressure, breather, anti-snowball.
- waves: формулы бюджета и мультипликаторов.
- upgradeRarityRoll: таблицы редкости апгрейдов + pity.

3.2 enemies.json
- Базовые статы врагов: chaser/shooter/cutter + projectile.

3.3 wave_sets.json
- Правила доступа врагов по волнам (minWaveForShooter/Cutter).
- Стоимости врагов (enemyCosts) для бюджета.
- Профили mix и budgetOverrides.

3.4 patterns.json
- Паттерны волн: расписание спавнов и формации (arc, corners, ring, tail_bias).
- Используется директором для вариативности.

3.5 daily.json
- seedMode = utc_date_yyyymmdd
- variants: модификаторы дня (modifiers) и rulesOverride, rewards.
- Важно: daily должен быть детерминированным.

3.6 run_upgrades.json
- Список апгрейдов в ран:
  - rarity, weight, maxStacks, tags
  - effects: mul/add/set/heal/grant_perk
  - clamp (опционально)
- Важно: эффекты применяются через deep-path к RuntimeConfig.

====================================================================
4) СБОРКА RUNTIME CONFIG (как должно работать)
====================================================================
Порядок:
1) load balances.json -> cfg
2) load enemies.json -> cfg.enemies = enemies
3) (опционально) применить preset (если включён)
4) если режим daily:
   - определить seed = UTC yyyymmdd
   - выбрать variant детерминированно (по seed)
   - применить variant.modifiers к cfg
   - применить rulesOverride к правилам wave set (не ломая базу)
5) cfg готов для игры/директора/апгрейдов

Deep-path операции:
- getPath(path: "flip.cooldownBaseSec")
- setPath
- операции:
  - add: number
  - mul: number
  - set: any
  - heal: number (применяется к текущему состоянию игрока, но может быть записано как эффект)
  - grant_perk: включить перкId с params (registry perks)
- clamp: min/max для конкретного path

====================================================================
5) МЕХАНИКИ (КЛЮЧЕВЫЕ ПОВЕДЕНИЯ)
====================================================================
5.1 Магнит и сбор
- Scrap в радиусе притяжения ускоряется к игроку.
- При достижении captureDistance — становится сегментом хвоста.
- Значения берутся из cfg.magnet и cfg.scrap.

5.2 Хвост-караван
- Лёгкая физика: constraints/следование сегментов.
- Штраф скорости за сегмент: cfg.player.tailSpeedPenaltyPerSegment.
- Потери сегментов:
  - cutter: cfg.tail.lossOnCutter
  - projectile: cfg.tail.lossOnProjectile
  - obstacle: cfg.tail.lossOnObstacle

5.3 Flip
- cooldown, pulse, radius, pushForce из cfg.flip.
- deflectProjectiles: true/false.
- postFlipInvulnSec обязательно для читабельности/справедливости.
- shrapnel активируется только если cfg.flip.shrapnel.enabled = true.

5.4 Recycler Zone (банкинг)
- Игрок стоит bankTimeSec в зоне -> хвост конвертируется в bolts.
- healOnBank добавляет HP.
- Должно быть “решение”: носить хвост рискованно, сдавать — безопасно.

5.5 Tutorial ≤ 30 сек
- 3 шага: движение+сбор, flip, recycler.
- Skip доступен всегда.
- Без “простыней текста”: короткие подсказки с иконками.

====================================================================
6) ДИРЕКТОР СЛОЖНОСТИ (FAIR SPAWNS)
====================================================================
Цели:
- удерживать давление, но избегать нечестных ситуаций.

Правила:
- safeSpawnDist и recyclerSafeDist — абсолютные правила “не спавнить близко”.
- telegraphSec — обязательный телеграф перед появлением.
- caps:
  - maxShooters
  - maxCutters (меняется по wave)
  - maxTotalEnemies
- pressure gating:
  - pressure = nearEnemies + nearProjectiles + recentHits + tailLenFactor (по весам)
  - если pressure > targetMax — приостановить спавн врагов, позволить scrap/передышку
  - если pressure < targetMin — усилить спавн (но соблюдая caps)

Breather:
- каждые N волн: меньше спавна, больше scrap.

Anti-snowball:
- при низком HP: уменьшить бюджет + добавить scrap
- при слишком длинном хвосте: снизить вероятность cutter

Паттерны:
- patterns.json добавляет вариативность, но директор всё равно фильтрует по caps/pressure/safe spawn.

====================================================================
7) АПГРЕЙДЫ (РОЛЛ РЕДКОСТИ И ВЫБОР 1 ИЗ 3)
====================================================================
Алгоритм выбора (обязателен):
1) Определить редкость по cfg.upgradeRarityRoll.tables (по waveIndex).
2) Применить pity:
   - если N выборов подряд без rare/epic — увеличить шанс rare/epic, вычесть из common.
3) Внутри редкости выбрать 3 разных апгрейда:
   - учитывать weight
   - учитывать maxStacks и уже взятые апгрейды
   - запрет дублей в одной выдаче
4) UI: показать 3 карточки, выбрать 1, применить эффекты.

====================================================================
8) DAILY MODE (DETERMINISTIC)
====================================================================
- seed: UTC yyyymmdd (единый для всех)
- variant pick должен быть детерминированным по seed
- modifiers применяются через deep-path операции к cfg
- попытки daily: базовая + rewarded extra attempt (лимит)
- отображать игроку: seed, variant title/desc, best local score

====================================================================
9) РЕКЛАМА (ADS) — ПРАВИЛА, ЧТОБЫ НЕ УБИТЬ УДЕРЖАНИЕ
====================================================================
Rewarded (добровольно):
- revive (1 раз за ран)
- x2 results
- reroll апгрейдов
- extra daily attempt (1–2/день)
- start booster

Interstitial:
- только на results screen
- cooldown между показами
- нельзя в туториале и первых 1–2 забегах
- нельзя сразу после rewarded

Fallback:
- если SDK нет — тихо отключить рекламу (без падений).

====================================================================
10) АНАЛИТИКА (EVENTS) — ЕДИНЫЙ АДАПТЕР
====================================================================
Требования:
- Единый AnalyticsAdapter (mock + platform).
- Никаких персональных данных.
- Минимум событий:
  - session_start/end
  - tutorial_start/complete/skip + step_complete
  - run_start/run_end (duration, wave, score, bolts, tailMax, deathReason)
  - flip_used
  - recycler_bank_complete
  - upgrade_offer/upgrade_pick
  - ad_interstitial_* и ad_rewarded_* (offer/start/complete/fail)
  - daily_enter, daily_attempt_used

События должны помогать считать:
- rewarded opt-in / completion
- interstitial frequency
- revive take rate
- x2 take rate
- влияние рекламы на D1 (косвенно)

====================================================================
11) АУДИО (MP3) — ТРЕБОВАНИЯ
====================================================================
- SFX: pickup, hit, flip, bank, ui_click, upgrade_select.
- Music: 1–2 лупа.
- Music стартует только после первого user interaction (browser policy).
- Ассеты:
  - только легальные
  - предпочтительно генерировать локально скриптом generate_audio_assets.mjs
  - хранить в public/assets/audio/*.mp3

====================================================================
12) ТЕСТИРОВАНИЕ (ОБЯЗАТЕЛЬНОЕ ПОКРЫТИЕ)
====================================================================
Unit (Vitest):
- PRNG/seed/determinism
- deep-path apply modifiers (add/mul/set/grant_perk) + clamp
- rarity roll + pity
- upgrade selection (no duplicates, maxStacks)
- pressure compute + target min/max

Integration:
- сборка RuntimeConfig из JSON
- генерация спавна волны (wave_sets + patterns + director rules)
- save/load (localStorage mock)
- ads manager cooldown/guards

E2E (Playwright):
- запуск игры (mock build)
- туториал: пройти или skip
- собрать scrap, нажать flip
- зайти в recycler и bank
- выбрать апгрейд
- results screen + x2 rewarded
- daily enter

CI:
- lint + bom-check + unit + integration + e2e

====================================================================
13) СКРИПТЫ СБОРКИ
====================================================================
scripts/build_test_mock.mjs (обязательно):
- включает mock adapter
- запускает:
  - bom-check
  - lint
  - unit + integration
  - e2e
- собирает dist-mock

scripts/build_release.mjs (обязательно):
- запускает unit + integration
- production build без моков
- формирует zip релизы:
  dist/releases/magnet-caravan_web.zip
  dist/releases/magnet-caravan_yandex.zip
  dist/releases/magnet-caravan_vk.zip
- архивы содержат только нужные файлы (index.html, assets, bundles)

====================================================================
14) ДОКУМЕНТАЦИЯ (ОБЯЗАТЕЛЬНАЯ)
====================================================================
- docs/README.md (RU BOM): запуск, тесты, сборки, структура
- docs/ARCHITECTURE.md (RU BOM): подсистемы, director, adapters
- docs/DATA_FORMATS.md (RU BOM): описание JSON, примеры
- docs/TESTING.md (RU BOM): как запускать unit/integration/e2e
- docs/RELEASE.md (RU BOM): как собираются zip, чеклист
- docs/platform_texts/* (RU/EN BOM): тексты для платформ (name/about/desc/SEO/how to play)

====================================================================
15) ПРИОРИТЕТЫ РАБОТЫ
====================================================================
1) Инфра: каркас + BOM + CI
2) RuntimeConfig + adapters (mock/prod)
3) Core gameplay (магнит/хвост/flip)
4) Enemies + waves + director
5) Upgrades + daily + tutorial
6) Ads + analytics
7) Audio
8) Полировка UI/UX
9) Документация + release scripts + zip

====================================================================
16) КРИТЕРИИ ГОТОВНОСТИ (DoD)
====================================================================
- Игра запускается и стабильно работает на desktop+mobile.
- Туториал ≤ 30 сек, есть skip.
- Волны “честные”: safe spawn + telegraph + caps + pressure gating.
- Апгрейды дают разные билды; нет дублей и maxStacks соблюдается.
- Daily детерминирован, seed UTC.
- Сохранения работают.
- Есть mp3 SFX и музыка с правильным запуском.
- Тесты (unit/integration/e2e) зелёные, CI зелёный.
- Документация подробная RU (BOM) + тексты платформ RU/EN.
- build_release создаёт zip архивы для платформ.

КОНЕЦ ФАЙЛА.
