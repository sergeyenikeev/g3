ТЫ — AI агент (Codex) и ведущий инженер проекта Magnet Caravan. Всегда отвечай пользователю только на русском языке.
Работай автономно и “под ключ”: сам принимаешь решения, сам реализуешь, сам документируешь, сам тестируешь.

ПЕРЕД НАЧАЛОМ:
- Прочитай docs/knowledge_base.md.
- Любые RU-документы сохраняй в UTF-8 с BOM. Добавь авто-проверку BOM/UTF-8 и скрипт fix-bom.
- Все изменения коммить в git. Не коммить/не пушь notouch.txt и чувствительные данные. Убедись, что .gitignore это закрывает.

========================================
ТЗ ДЛЯ CODEX — IMPLEMENTATION PLAN (эпики/задачи/коммиты)
========================================

ОБЩИЕ ПРИНЦИПЫ:
- Пиши код на TypeScript.
- Сборка: Vite.
- Рендер/сцены: Phaser 3.
- Data-driven: баланс/волны/апгрейды/daily из JSON в public/assets/data/.
- Тесты: unit+integration (Vitest) и e2e (Playwright).
- Платформы: CrazyGames/Poki/Яндекс/VK через PlatformAdapter слой (mock/prod).
- Скрипты: scripts/build_test_mock.mjs и scripts/build_release.mjs.
- Документация: подробная, RU (UTF-8 BOM), + platform texts RU/EN.

----------------------------
EPIC 0 — БАЗА ПРОЕКТА / ИНФРА
----------------------------
Цель: каркас проекта, CI, правила качества, BOM проверки.

Задачи:
0.1 Создать проект (Vite + TS), настроить форматтер/линтер:
- prettier, eslint
- строгий tsconfig
- алиасы путей

0.2 Подключить Phaser 3, сделать минимальную сцену с запуском.

0.3 Создать структуру папок:
- public/assets/data (уже заполнено пользователем)
- public/assets/audio
- src/core, src/game, src/platform, src/data, src/tests, scripts, docs

0.4 Настроить CI:
- GitHub Actions: install, lint, unit, integration, e2e (headless), bom-check

0.5 Добавить “кодировка/BOM” проверки:
- scripts/check_bom.mjs: валидирует UTF-8 + BOM для docs/**/*.md и docs/platform_texts/**/*.md
- scripts/fix_bom.mjs: добавляет BOM автоматически
- интегрировать в npm scripts и build скрипты

Коммиты (примерный порядок):
- chore: init vite+ts project scaffold
- chore: add eslint/prettier/tsconfig strict
- chore: add phaser minimal boot scene
- chore: add ci workflow + vitest + playwright scaffolding
- chore: add bom check/fix scripts and integrate in pipeline

Критерий готовности:
- `npm run dev` запускает пустую сцену.
- `npm test` работает (пусть пока один “smoke” тест).
- CI зелёный.
- BOM check работает.

--------------------------------
EPIC 1 — ЗАГРУЗКА КОНФИГОВ / RUNTIME CONFIG
--------------------------------
Цель: загрузка JSON и сборка RuntimeConfig, совместимая с path-эффектами апгрейдов.

Задачи:
1.1 DataLoader:
- загрузка JSON из public/assets/data: balances, enemies, wave_sets, patterns, daily, run_upgrades
- валидация структуры (zod или ручная, минимум: наличие ключей)

1.2 RuntimeConfigBuilder:
- собрать cfg = balances + (cfg.enemies = enemies)
- применить preset (если активен)
- если daily: выбрать seed UTC yyyymmdd, выбрать daily variant, применить modifiers (mul/add/set/grant_perk)
- обеспечить deep-path операции:
  - getPath/setPath
  - op: add/mul/set/heal/grant_perk
  - clamp support
- хранить отдельный registry/perks (perkId → params)

1.3 Unit tests:
- deep-path операции (get/set)
- применение modifiers (mul/add/set)
- clamp
- seed UTC
- выбор daily variant по весам (детерминированно по seed)

Коммиты:
- feat: data loader for json configs
- feat: runtime config builder with deep-path modifiers + perks
- test: unit tests for config builder / modifiers / seed

Критерий готовности:
- игра может загрузить конфиги и вывести их в консоль/overlay.
- unit tests зелёные.

----------------------------
EPIC 2 — PLATFORM ADAPTER (mock + prod)
----------------------------
Цель: универсальный слой под порталы.

Задачи:
2.1 Интерфейс PlatformAdapter:
- init()
- showInterstitial(): Promise<{shown:boolean, reason?:string}>
- showRewarded(placement): Promise<{completed:boolean, reason?:string}>
- save(data)/load(): Promise<data|null>
- submitScore(mode, score): Promise<void> (опционально)
- getLeaderboard(mode): Promise<...> (опционально)

2.2 MockAdapter:
- deterministic simulation:
  - rewarded: всегда completed=true (или configurable)
  - interstitial: shown=true с cooldown
- mock save/load: localStorage

2.3 Prod adapters (минимум):
- CrazyGamesAdapter: если window.CrazyGames доступен — использовать, иначе fallback
- PokiAdapter: если window.PokiSDK доступен — использовать, иначе fallback
- YandexAdapter: если YaGames init доступен — использовать, иначе fallback
- VKAdapter: если VKBridge доступен — использовать, иначе fallback
(!) если SDK недоступен — игра не падает, просто выключает рекламу/лидерборды.

2.4 Integration tests:
- mock adapter flows (rewarded/interstitial)
- save/load using adapter abstraction

Коммиты:
- feat: platform adapter interface + mock adapter
- feat: prod adapters with safe fallback
- test: integration tests for adapters

Критерий готовности:
- игра запускается с mock adapter в dev.
- при отсутствии SDK в prod не падает.

----------------------------
EPIC 3 — CORE GAMEPLAY (PLAYER/SCRAP/TAIL/FLIP)
----------------------------
Цель: “играется” ядро.

Задачи:
3.1 PlayerController:
- desktop input (WASD) + mobile joystick
- speed penalty от tailLen (из cfg)

3.2 Scrap:
- спавн кластеров по cfg
- магнитное притяжение, capture -> addTailSegment

3.3 TailSystem:
- сегменты с spacing/stiffness/damping
- коллизии tail сегментов (простые круги)
- механика потери сегментов (снять N последних, оставить на земле на время)

3.4 FlipSystem:
- cooldown, pulse, radius, pushForce, deflect projectiles
- postFlipInvuln
- shrapnel если enabled

3.5 HUD:
- HP, Flip cooldown, tailLen, bolts gained (in run), wave/time

3.6 Unit/Integration tests:
- Tail follow обновление (детерминированный шаг)
- Flip cooldown и импульс (на уровне логики)
- Scrap capture расчёты

Коммиты:
- feat: player controller (desktop+mobile)
- feat: scrap spawn + magnet pull + capture
- feat: tail system (constraints + loss)
- feat: flip system (repel + deflect + shrapnel)
- feat: basic HUD
- test: core logic unit/integration tests

Критерий готовности:
- можно бегать, собирать, растить хвост, флипать.

----------------------------
EPIC 4 — ENEMIES + PROJECTILES
----------------------------
Цель: враги из enemies.json.

Задачи:
4.1 EnemyFactory:
- chaser / shooter / cutter с параметрами из cfg.enemies

4.2 AI:
- chaser: chase+zigzag
- shooter: kite/keepDistance, стреляет по cooldown
- cutter: target nearest tail segment, cut with cooldownAfterCut

4.3 Damage model:
- hit player HP, invulnOnHit
- hit tail => loss segments (по cfg.tail.lossOnX)
- projectiles lifetime/radius

4.4 Tests:
- shooter firing timing (logic)
- cutter target selection (prefers tail) + cooldown
- damage -> invuln gating

Коммиты:
- feat: enemies + projectile system
- test: enemy logic tests

Критерий готовности:
- бой с 3 типами врагов работает, хвост режется.

----------------------------
EPIC 5 — WAVES + DIFFICULTY DIRECTOR (fair & fun)
----------------------------
Цель: честный спавн и разнообразные волны.

Задачи:
5.1 WaveManager:
- wave timing (duration calc)
- apply wave multipliers (hp/speed) на спавн/статы

5.2 Director:
- safe spawn distance от игрока и recycler
- telegraph spawn markers
- caps enforcement (shooters/cutters/total)
- pressure compute + targetMin/Max (по cfg.director.pressure)
- breather каждые N волн
- anti-snowball (hp low budgetMult + extra scrap; bigTail reduces cutter weight)
- mix profiles из wave_sets.json + costs + budget overrides
- patterns (если включено): расписание событий, формации

5.3 Integration tests (без рендера):
- генерация набора спавнов по волне
- соблюдение caps
- no-spawn-inside-safe-dist
- pressure gating (при high pressure спавн урезается)
- breather окно даёт меньше врагов и больше scrap

Коммиты:
- feat: wave manager + director (budget/mix/caps/pressure)
- feat: patterns scheduler + formations + telegraph
- test: integration tests for director fairness rules

Критерий готовности:
- волны генерируются честно, интересно, без “в лицо”.

----------------------------
EPIC 6 — UPGRADES (выбор 1/3, редкости, pity, применение эффектов)
----------------------------
Цель: апгрейды из run_upgrades.json, разнообразные билды.

Задачи:
6.1 UpgradeRoller:
- roll rarity по cfg.upgradeRarityRoll.tables (wave-based)
- pity: если N выборов без rare/epic — boosted
- pick 3 уникальных апгрейда в выдаче:
  - не повторять в одной тройке
  - не превышать maxStacks для уже взятых
  - использовать weights апгрейдов внутри редкости

6.2 UpgradeApply:
- применить effects к “runtime modifiers” или прямо к cfg (выбрать архитектуру)
- grant_perk включает перк + params (и логика читает перки)

6.3 UI:
- экран выбора апгрейда (3 карточки)
- apply выбранный и продолжить волну
- reroll как rewarded (mock/adapter)

6.4 Tests:
- roll rarity distribution (детерминированное)
- maxStacks соблюдение
- pity работает
- no duplicates in pick

Коммиты:
- feat: upgrade roller (rarity+weights+pity+maxStacks)
- feat: upgrades UI + apply effects + reroll (rewarded)
- test: unit tests for upgrade selection and application

Критерий готовности:
- после волны появляется выбор, билд меняет игру.

----------------------------
EPIC 7 — RECYCLER + BANKING + ECONOMY
----------------------------
Цель: стратегический банкинг хвоста.

Задачи:
7.1 RecyclerZone entity:
- position, radius, UI подсветка
- bankTimeSec “постоять”
- onBank: convert tail segments to bolts, heal, clear tail

7.2 Economy:
- bolts in-run + end-of-run summary
- (опционально) core drops from rare shards + daily bonus

7.3 Tests:
- bank timer behaviour
- conversion to bolts using cfg values
- heal on bank

Коммиты:
- feat: recycler zone banking + economy
- test: banking/economy tests

Критерий готовности:
- игрок реально решает, когда сдавать хвост.

----------------------------
EPIC 8 — TUTORIAL ≤ 30 sec + ONBOARDING
----------------------------
Цель: 3 шага обучения.

Задачи:
8.1 TutorialManager:
- step 1: move + pick 3 scrap
- step 2: flip deflect/hit event
- step 3: enter recycler + bank
- skip button
- по завершению: бесплатный выбор апгрейда/подарок

8.2 E2E:
- пройти туториал автоматически (Playwright)
- проверить основные UI элементы

Коммиты:
- feat: tutorial manager (3 steps + skip)
- test: e2e tutorial flow

Критерий готовности:
- новый игрок понимает за 30 секунд.

----------------------------
EPIC 9 — DAILY MODE
----------------------------
Цель: ежедневные условия + награды.

Задачи:
9.1 DailySeed:
- UTC yyyymmdd
- выбрать daily variant по весам (deterministic)
- применить modifiers/rulesOverride
- ограничение attempts (rewarded extra attempt)

9.2 UI:
- кнопка Daily
- экран daily info: seed, variant title/desc, best local score

9.3 Tests:
- seed stable for a date
- variant pick deterministic
- attempt limit logic

Коммиты:
- feat: daily mode config application + UI
- test: daily unit/integration tests

Критерий готовности:
- daily работает одинаково каждый день на всех.

----------------------------
EPIC 10 — SAVE/LOAD
----------------------------
Цель: localStorage + adapter abstraction, версия схемы.

Задачи:
10.1 Save schema:
- version, backup
- settings, best scores, meta progress (если есть), daily claims

10.2 Storage:
- localStorage backend
- adapter-based override (если платформа)

10.3 Tests:
- schema migration (минимум 1 кейс)
- backup restore on corrupt data

Коммиты:
- feat: save/load system with versioning+backup
- test: save/load integration tests

Критерий готовности:
- прогресс не теряется, поломанный save не убивает игру.

----------------------------
EPIC 11 — AUDIO (MP3) + AUTOPLAY RESTRICTIONS
----------------------------
Цель: звук и музыка.

Задачи:
11.1 AudioManager:
- загрузка mp3
- SFX events
- музыка стартует после первого user interaction
- настройки громкости (sfx/music)

11.2 Assets:
- public/assets/audio/*.mp3 (сгенерировать локально, без лицензий)
- если нужен генератор: scripts/generate_audio_assets.mjs (создаёт простые mp3 лупы/тоны)

11.3 Tests:
- unit: audio state machine (music starts only after input)
- e2e: игра не падает при включённом аудио

Коммиты:
- feat: audio manager + settings
- chore: add generated mp3 assets + generator script
- test: audio tests

Критерий готовности:
- есть SFX и музыка, всё легально и не ломает запуск.

----------------------------
EPIC 12 — ADS PLACEMENTS + KPI-SAFE LOGIC
----------------------------
Цель: rewarded/interstitial в правильных точках.

Задачи:
12.1 AdsManager:
- interstitial only on results, with cooldown, no ads in tutorial and first 1–2 runs
- rewarded placements:
  - revive (1 per run)
  - x2 results
  - reroll upgrades
  - extra daily attempt
  - start booster
- логика “не показывать interstitial сразу после rewarded”

12.2 Analytics events for ads (см. раздел “метрики” ниже)

12.3 Tests:
- unit: cooldown rules, no ads in tutorial, revive limit
- integration: adapter returns fail reasons safely

Коммиты:
- feat: ads manager with placements and cooldown safety
- test: ads logic tests

Критерий готовности:
- реклама не душит, rewarded добровольный, interstitial только в паузах.

----------------------------
EPIC 13 — E2E COVERAGE + STABILITY
----------------------------
Цель: уверенность, что игра проходит основные сценарии.

Задачи (Playwright):
- запуск игры (mock build)
- пройти tutorial/skip
- собрать scrap
- flip used
- зайти в recycler и bank
- дойти до выбора апгрейда и выбрать апгрейд
- умереть и увидеть results
- нажать x2 reward (rewarded) и проверить, что награда умножилась
- daily enter и попытка daily

Коммиты:
- test: full e2e flow coverage (tutorial + run + rewards + daily)

Критерий готовности:
- e2e стабилен в CI.

----------------------------
EPIC 14 — DOCS + PLATFORM TEXTS RU/EN
----------------------------
Цель: подробная документация и тексты для платформ.

Задачи:
- docs/README.md (RU BOM): запуск, тесты, сборка, структура
- docs/ARCHITECTURE.md (RU BOM): подсистемы, директор, конфиги
- docs/DATA_FORMATS.md (RU BOM): схема JSON, как править
- docs/TESTING.md (RU BOM): unit/integration/e2e
- docs/RELEASE.md (RU BOM): zip, требования платформ, чеклист
- docs/platform_texts/{platform}_{ru|en}.md (BOM): name, about, full desc, SEO desc, how to play

Коммиты:
- docs: add full documentation (RU BOM) + platform texts RU/EN
- chore: ensure bom-check passes

Критерий готовности:
- документация полная и проверяется скриптом.

----------------------------
EPIC 15 — BUILD SCRIPTS (mock test build + release zips)
----------------------------
Цель: два универсальных скрипта.

Задачи:
15.1 scripts/build_test_mock.mjs:
- включает mock adapter (через env define)
- проверка BOM + lint + unit/integration + e2e
- сборка в dist-mock

15.2 scripts/build_release.mjs:
- unit+integration перед релизом
- production build (без моков)
- сформировать папки dist/releases/
- сформировать zip:
  - magnet-caravan_crazygames.zip
  - magnet-caravan_poki.zip
  - magnet-caravan_yandex.zip
  - magnet-caravan_vk.zip

Коммиты:
- feat: build scripts mock and release with zips
- chore: update docs with build instructions

Критерий готовности:
- оба скрипта работают на чистой машине.

-----------------------------------------
КОНЕЦ IMPLEMENTATION PLAN
-----------------------------------------


========================================
СПИСОК МЕТРИК / ИВЕНТОВ АНАЛИТИКИ (под рекламные KPI)
========================================

ПРИНЦИПЫ:
- Все события отправлять через единый AnalyticsAdapter (mock + platform bridge).
- Никаких персональных данных.
- События должны включать:
  - timestamp (локально)
  - sessionId
  - runId
  - mode: "normal" | "daily"
  - waveIndex (если применимо)
  - platformId (crazygames/poki/yandex/vk/unknown)

ОБЯЗАТЕЛЬНЫЕ СОБЫТИЯ (core):
1) session_start
   payload: { platformId, userAgentHint, locale, buildType(mock|prod) }

2) session_end
   payload: { sessionDurationSec, runsPlayed }

3) tutorial_start
   payload: { }

4) tutorial_step_complete
   payload: { stepId: 1|2|3, elapsedSec }

5) tutorial_complete
   payload: { elapsedSec, skipped: false }

6) tutorial_skip
   payload: { elapsedSecBeforeSkip }

7) run_start
   payload: { runId, mode, seed?: string, dailyVariantId?: string }

8) run_end
   payload: {
     runId, mode,
     durationSec,
     waveReached,
     score,
     boltsEarned,
     boltsBanked,
     tailMaxLen,
     deathReason: "hp_zero"|"crush"|"other"
   }

9) flip_used
   payload: { runId, waveIndex, tailLen, enemiesNear, projectilesNear }

10) recycler_enter
    payload: { runId, waveIndex, tailLen }

11) recycler_bank_start
    payload: { runId, waveIndex, tailLen }

12) recycler_bank_complete
    payload: { runId, waveIndex, tailLenBanked, boltsGained, hpHealed }

13) upgrade_offer
    payload: { runId, waveIndex, options: [{id, rarity}] }

14) upgrade_pick
    payload: { runId, waveIndex, id, rarity }

15) upgrade_reroll_offer_shown
    payload: { runId, waveIndex }

16) upgrade_reroll_used
    payload: { runId, waveIndex, via: "rewarded"|"free" }

17) daily_enter
    payload: { seed, variantId }

18) daily_attempt_used
    payload: { seed, attemptsUsed, attemptsRemaining }

19) settings_changed
    payload: { musicVol, sfxVol, controlScheme, sensitivity }

РЕКЛАМНЫЕ СОБЫТИЯ (KPI):
20) ad_interstitial_request
    payload: { placement: "results", runId, reason: "cooldown_ok"|"cooldown_block"|"tutorial_block"|"first_runs_block" }

21) ad_interstitial_shown
    payload: { placement: "results", runId }

22) ad_interstitial_failed
    payload: { placement: "results", runId, errorCode }

23) ad_rewarded_offer
    payload: { placement: "revive"|"x2_results"|"reroll"|"daily_attempt"|"start_booster", runId }

24) ad_rewarded_start
    payload: { placement, runId }

25) ad_rewarded_complete
    payload: { placement, runId, rewardGranted: true }

26) ad_rewarded_failed
    payload: { placement, runId, errorCode }

МЕТРИКИ ДЛЯ ОТЧЁТОВ (derived):
- D1 retention (если платформа отдаёт; иначе косвенно через local save timestamps)
- runs/session
- avg run duration
- rewarded opt-in = ad_rewarded_start / ad_rewarded_offer
- rewarded completion = ad_rewarded_complete / ad_rewarded_start
- interstitial frequency per DAU (если доступно)
- revive take rate: rewarded_start(placement=revive)/run_end where death
- x2 take rate: rewarded_start(x2_results)/run_end

========================================
КОНЕЦ МЕТРИК
========================================


========================================
ЧЕКЛИСТ РЕЛИЗА (CrazyGames / Poki / Яндекс / VK)
========================================

A) ОБЩИЙ ЧЕКЛИСТ (для всех)
[ ] build_release.mjs проходит локально/в CI
[ ] unit + integration тесты зелёные
[ ] e2e тесты зелёные (хотя бы mock build в CI)
[ ] BOM check зелёный (docs/**/*.md и platform_texts/**/*.md)
[ ] НЕТ секретов в репозитории, .env* в .gitignore (кроме .env.example)
[ ] notouch.txt не тронут и в .gitignore
[ ] Игра стартует за < 3 сек на средних устройствах
[ ] Нет автозапуска музыки до user interaction
[ ] Звук/музыка можно выключить в настройках
[ ] Прерывание фокуса (tab change) ставит игру на паузу/минимизирует нагрузку
[ ] Resize работает (desktop+mobile), нет “растянутых” элементов UI
[ ] Сохранения работают: перезагрузка страницы сохраняет прогресс/настройки
[ ] Нет критических ошибок в консоли (console.error)
[ ] Размер архива разумный (минимум ассетов, mp3 оптимизированы)

B) ПРОВЕРКА ГЕЙМПЛЕЯ
[ ] Туториал проходится ≤ 30 сек
[ ] Flip и дефлект читаемы, cooldown отображается
[ ] Cutter режет хвост, но не “убивает за 1 касание” на ранних волнах
[ ] Recycler банкинг понятен и полезен
[ ] Апгрейды не ломают игру (нет бесконечной неуязвимости/бесконечного фарма)
[ ] Daily seed стабилен (UTC yyyymmdd), variant выбирается детерминированно
[ ] Rarity таблицы дают редкие апгрейды не слишком рано и не слишком поздно
[ ] Director не спавнит врагов рядом с игроком/recycler, работает telegraph

C) РЕКЛАМА
[ ] Interstitial показывается только на results screen и с cooldown
[ ] Нет interstitial в туториале и первых 1–2 забегов
[ ] Rewarded: revive ограничен 1 раз за ран
[ ] Rewarded: x2 results реально увеличивает награду
[ ] Rewarded: reroll работает
[ ] Не показывается interstitial сразу после rewarded
[ ] При отсутствии SDK реклама “молча” отключается и игра работает

D) ПЛАТФОРМА: CrazyGames
[ ] Используется CrazyGames SDK через адаптер (если доступен)
[ ] Фоллбек работает, если SDK не загрузился
[ ] Проверить требования CrazyGames к index.html и путям ассетов
[ ] В архиве: index.html + assets + js bundles
[ ] Тексты: docs/platform_texts/crazygames_ru.md и _en.md готовы

E) ПЛАТФОРМА: Poki
[ ] Используется PokiSDK (если доступен)
[ ] Проверить, что игра корректно “пауза/резюм” по сигналам SDK (если требуется)
[ ] Архив: magnet-caravan_poki.zip
[ ] Тексты: docs/platform_texts/poki_ru.md и _en.md готовы

F) ПЛАТФОРМА: Яндекс Игры
[ ] Инициализация YaGames (если доступен)
[ ] Проверить особенности сохранений/фуллскрина (если используется)
[ ] Архив: magnet-caravan_yandex.zip
[ ] Тексты: docs/platform_texts/yandex_ru.md и _en.md готовы

G) ПЛАТФОРМА: VK
[ ] VK Bridge (если доступен) не ломает запуск
[ ] Проверить интеграцию fullscreen/ads (если применимо)
[ ] Архив: magnet-caravan_vk.zip
[ ] Тексты: docs/platform_texts/vk_ru.md и _en.md готовы

H) ПОСЛЕ РЕЛИЗА (минимум)
[ ] Проверить, что аналитика (если подключена) пишет ключевые события:
    - tutorial_complete
    - run_end
    - ad_rewarded_complete
[ ] Проверить первые метрики:
    - средняя длительность забега
    - opt-in rewarded
    - частота interstitial
[ ] Если D1 падает — ослабить interstitial и/или усилить rewarded ценность.

========================================
КОНЕЦ ЧЕКЛИСТА РЕЛИЗА
========================================
