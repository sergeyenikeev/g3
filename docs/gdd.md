ТЫ — AI агент (Codex) и геймдизайнер/техдизайнер. Сделай игру Magnet Caravan (HTML5/JS) строго по этому GDD.
Всегда отвечай пользователю только на русском языке.

ПЕРЕД НАЧАЛОМ:
1) Обязательно прочитай docs/knowledge_base.md и учти требования.
2) Любые документы/инструкции на русском сохраняй в UTF-8 с BOM (не CP1251). Добавь авто-проверку BOM/UTF-8 и “fix-bom” скрипт.

========================================
GDD (GAME DESIGN DOCUMENT) — MAGNET CARAVAN
========================================

0) ВЫСОКИЙ УРОВЕНЬ (HIGH CONCEPT)
- Название: Magnet Caravan
- Жанр: 2D top-down arcade survival / run-based rogue-lite
- Сеттинг: пост-индустриальная свалка (простая 2D графика, яркие эффекты)
- Сессия: 1–5 минут
- Платформы: CrazyGames (primary), Poki, Яндекс Игры, VK
- Монетизация: реклама (rewarded + interstitial), опционально косметика/IAP (если платформа позволяет)
- Ключевая фишка: “караван-хвост” из металлолома + кнопка Flip (смена полярности: мощное отталкивание/дефлект)

1) ЦЕЛИ ДИЗАЙНА (PILLARS)
P1 — Рост с риском:
  - чем длиннее хвост, тем выше ценность/мощь, но сложнее управление и выше риск потерь.
P2 — Полярность = мастерство:
  - Flip должен быть “вау-кнопкой”, которая спасает, создаёт комбо и окно для игры.
P3 — Короткие циклы + прогресс:
  - каждая попытка даёт награду; ран-апгрейды и мета должны ощущаться быстро.
P4 — Портальная пригодность:
  - быстрое обучение (tutorial ≤ 30 секунд), UI mobile-first, лёгкая графика, стабильность.
P5 — Data-driven:
  - баланс/контент/волны/апгрейды и daily должны правиться через JSON, без правки кода.

2) ЦА (AUDIENCE)
- Основная: 10–30, аркады, .io-like ощущение роста, “ещё один забег”.
- Вторичная: 30–45, казуалы, нравится сбор/прокачка без сложных правил.

3) USP / HOOK
- Караван-хвост: рост, физ-ощущение, клипабельность “огромный хвост”.
- Flip: мгновенное отталкивание (и дефлект снарядов), спасение хвоста и контроль пространства.
- Recycler Zone: банкинг хвоста — стратегический выбор “нести риск” vs “зафиксировать выгоду”.
- Daily seed: ежедневный общий seed для честного сравнения результатов.

4) ИГРОВЫЕ ЦИКЛЫ (LOOPS)
4.1 Moment-to-moment:
  1) Двигайся по арене
  2) Притягивай scrap в радиусе → он липнет и становится хвостом
  3) Маневрируй (хвост мешает), избегай угроз, защищай хвост
  4) Жми Flip, чтобы оттолкнуть врагов/снаряды и создать окно
  5) Заезжай в Recycler Zone, чтобы “сдать” хвост и получить валюту/хил

4.2 Run loop:
  - игра идёт волнами
  - после волны: выбор 1 из 3 апгрейдов
  - сложность растёт (директор сложности + бюджет)
  - ран заканчивается смертью (или успешным завершением режима в будущем)

4.3 Meta loop:
  - валюты после забега → прокачка (магнит/полярность/караван/прочее)
  - открытия модулей/контента
  - daily режим даёт бонус и удержание

5) УПРАВЛЕНИЕ И UI (MOBILE-FIRST)
5.1 Desktop:
  - WASD/стрелки: движение
  - Space/ПКМ: Flip
  - Shift: Dash (если открыт)
  - опционально режим “к курсору” для казуалов

5.2 Mobile:
  - левый нижний: виртуальный джойстик
  - правый: большая кнопка Flip
  - дополнительная кнопка Dash, если доступен
  - landscape, safe areas, крупные элементы под пальцы

6) CORE SYSTEMS / МЕХАНИКИ
6.1 Магнит:
  - притягивает scrap внутри радиуса (сила/ускорение — из balances.json)
  - scrap при достижении captureDistance “прилипает” и становится сегментом хвоста

6.2 Караван-хвост:
  - цепочка сегментов с простыми constraints (легковесная физика)
  - штраф скорости/манёвренности растёт с длиной хвоста
  - при уроне хвоста теряются сегменты (числа — из balances.json)
  - потерянные сегменты остаются на земле коротко (можно подобрать)

6.3 Flip (смена полярности):
  - при нажатии: repel-пульс вокруг игрока
  - отталкивает врагов + дефлектит снаряды (если включено)
  - post-flip invuln (короткая неуязвимость после Flip)
  - если включён апгрейдом: shrapnel (осколки) при Flip

6.4 Recycler Zone (банкинг):
  - 1 зона на карте (MVP)
  - игрок держится в зоне bankTimeSec → хвост сдаётся
  - начисляются Bolts за сегменты (по конфигу) + небольшой хил
  - стратегический выбор: долго носить хвост (сила/риск) или часто сдавать (безопасность)

7) ВРАГИ (MVP, из enemies.json)
- chaser: преследует, контактный урон
- shooter: держит дистанцию, стреляет снарядами
- cutter: охотится за хвостом, режет сегменты, имеет cooldown после реза

8) ВОЛНЫ И ДИРЕКТОР СЛОЖНОСТИ (FAIR & FUN)
Цель: давление без нечестности. Всё управляется конфигами:
- balances.json (director + waves)
- wave_sets.json (rules, costs, mix profiles, budget overrides)
- patterns.json (паттерны волны и формации)

8.1 Правила честности:
- safe spawn distance от игрока: director.safeSpawnDist
- safe spawn distance от recycler: director.recyclerSafeDist
- telegraph перед спавном: director.telegraphSec
- caps по врагам:
  - maxShootersBase
  - maxCuttersUntilWave10 / maxCuttersFromWave11
  - maxTotalEnemiesBase + maxTotalEnemiesPerWave
- никогда не спавнить “в лицо”; спавн только по правилам, с телеграфом

8.2 Pressure gating:
- считать pressure (nearEnemies, nearProjectiles, recentHits, tailLenFactor) по director.pressure
- targetMin/Max зависят от waveIndex (base + perWave)
- если pressure > targetMax: временно тормозить спавн/давать scrap
- если pressure < targetMin: ускорять спавн (но соблюдать caps)

8.3 Breather:
- каждые director.breather.everyWaves — окно передышки:
  - enemyRateMult
  - extraScrapClusters

8.4 Anti-snowball:
- если hp < lowHpThreshold:
  - budgetMult = lowHpBudgetMult
  - +lowHpExtraScrapClusters
- если tailLen > bigTailThreshold:
  - уменьшить вероятность cutter (bigTailCutterWeightMult)

8.5 Patterns:
- patterns.json задаёт паттерны (pincer, snipers, cutters_window, flood и т.п.)
- выбор паттерна по seed + waveIndex
- паттерны дают разнообразие, но не ломают caps/pressure

9) АПГРЕЙДЫ В РАНЕ (RUN UPGRADES)
- конфиг: public/assets/data/run_upgrades.json
- выбор после каждой волны: 1 из 3
- алгоритм:
  1) выбрать редкость по таблицам upgradeRarityRoll из balances.json (зависит от волны)
  2) применить pity (если N выборов без rare/epic)
  3) внутри редкости выбрать апгрейды по weight, учитывая:
     - maxStacks
     - already-picked
     - без повторов в одной тройке
- эффекты апгрейдов:
  - mul/add/set/heal/grant_perk + clamp
  - пути (path) должны применяться к RuntimeConfig (balances + enemies + daily modifiers)

10) DAILY-SEED (MAX SET)
- конфиг: public/assets/data/daily.json
- seed: UTC date yyyymmdd
- daily выбирает variant по весу:
  - modifiers применяются к RuntimeConfig
  - rulesOverride может менять правила waves (например minWaveForShooter)
- награды:
  - firstRunBonusBoltsMult
  - extraAttemptRewardedMax
  - coreDropBonus
- лидерборды:
  - минимум локальный; платформенный — если SDK позволяет

11) TUTORIAL ≤ 30 СЕК (ОБЯЗАТЕЛЬНО)
Шаг 1 (≤10с): движение + собрать 3 scrap
Шаг 2 (≤10с): Flip оттолкнуть снаряд/врага
Шаг 3 (≤10с): заехать в Recycler и сдать хвост
- всегда доступна кнопка Skip
- без “стены текста”: короткие подсказки + иконки

12) UI SCREENS (ЭКРАНЫ)
12.1 HUD:
- HP/щит
- индикатор Flip (кд/готовность)
- “в хвосте” / “забанковано” (иконки)
- номер волны / таймер волны

12.2 Between waves:
- экран выбора апгрейда (3 карточки)
- опционально reroll (rewarded)

12.3 Results:
- результаты забега, best, кнопки Retry/Daily
- кнопка “x2 награда” (rewarded)

12.4 Settings:
- звук/музыка
- чувствительность управления
- переключатель режима управления (если сделан)

13) АУДИО (MP3, ОБЯЗАТЕЛЬНО)
- SFX: pickup, hit, flip, bank, upgrade_select, ui_click
- Music: 1–2 лупа (спокойный/напряжённый)
- музыка стартует только после первого user input (tap/click)
- ассеты без лицензий: генерировать локально, хранить в public/assets/audio/

14) СОХРАНЕНИЯ
- localStorage: мета, настройки, best scores, daily state
- versioned schema + backup save
- абстракция для platform save (если доступно)

15) МОНЕТИЗАЦИЯ (PORTAL-FRIENDLY)
15.1 Rewarded placements:
- revive (1 раз за ран)
- x2 end rewards
- reroll upgrade
- extra daily attempt (1–2 в день)
- start booster (щит/турбо)
(в dev/mock — симулировать)

15.2 Interstitial:
- только после завершения забега (results screen)
- cooldown (не душить)
- не показывать до конца туториала и первых 1–2 забегов
- не показывать сразу после rewarded

15.3 KPI ориентиры (для тюнинга):
- interstitial impressions/DAU: 1–3
- rewarded opt-in: 10–25%
- rewarded completion: 85%+
- если падает D1 — ослабить interstitial

16) DATA-DRIVEN (СТРОГОЕ ТРЕБОВАНИЕ)
- все конфиги уже лежат в public/assets/data/:
  balances.json, enemies.json, wave_sets.json, patterns.json, daily.json, run_upgrades.json
- код не содержит хардкодов баланса (кроме безопасных дефолтов на случай отсутствия файла)
- RuntimeConfig строится как:
  1) balances
  2) enemies -> cfg.enemies
  3) presets (если включены)
  4) daily modifiers (если режим daily)
  5) далее директор использует cfg.director + wave_sets + patterns

17) DEFINITION OF DONE (ГОТОВНОСТЬ)
Игра готова, если:
- стабильно запускается и работает на desktop+mobile
- туториал ≤ 30 сек и понятен
- волны “честные”: нет спавна в лицо, есть pressure gating
- апгрейды дают разнообразные билды
- daily работает на UTC seed и даёт награды
- есть mp3 звук и музыка (без лицензий)
- есть сохранения и восстановление
- всё покрыто unit/integration/e2e тестами
- есть документация RU (UTF-8 BOM) и тексты платформ RU/EN
- сборка релиза формирует zip архивы под платформы

========================================
КОНЕЦ GDD
========================================
