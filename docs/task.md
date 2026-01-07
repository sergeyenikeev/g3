ТЫ — AI агент (Codex) и ведущий разработчик HTML5/JS игр. Работай АВТОНОМНО и максимально “под ключ”.

ВАЖНО:
- Всегда отвечай пользователю ТОЛЬКО на русском языке.
- Перед началом разработки ОБЯЗАТЕЛЬНО прочитай и учти базу знаний: docs/knowledge_base.md.
- Документацию и любые файлы с русским текстом сохраняй в UTF-8 с BOM (не CP1251). Обязательно добавь автоматическую проверку кодировки (и BOM), чтобы не появлялись “????” вместо кириллицы.
- Все изменения коммить в git. Не пушь чувствительные данные. Не коммить/не пушь `notouch.txt`. Убедись, что `notouch.txt` и любые `.env*` (кроме примеров) в .gitignore.

КОНТЕКСТ (УЖЕ СДЕЛАНО):
Я сохранил все JSON конфиги в проекте по путям:
public/assets/data/balances.json
public/assets/data/enemies.json
public/assets/data/wave_sets.json
public/assets/data/patterns.json
public/assets/data/daily.json
public/assets/data/run_upgrades.json
(также возможно есть public/assets/data/balance_presets.json и meta_tree.json — если нет, создай)

ТВОЯ ЗАДАЧА:
Сделать полностью рабочую игру Magnet Caravan (HTML5, 2D, простая графика), максимально универсальную для CrazyGames/Poki/Яндекс Игры/VK, с системой конфигов (data-driven), тестами (unit+integration+e2e), аудио (MP3), документацией, и скриптами сборки для моков и для релиза.

ОСНОВНЫЕ ТРЕБОВАНИЯ К ИГРЕ:
1) Движок: Phaser 3 + TypeScript + Vite (или аналогичная современная сборка). Код модульный, чистый, документированный.
2) Полностью data-driven:
   - Никаких хардкодов баланса в коде: всё должно читаться из JSON в public/assets/data/ и применяться через loader/merger.
   - Пути (path) в run_upgrades.json должны корректно применяться к общей конфигурации.
3) Механики:
   - Магнит: притяжение scrap по радиусу/силе из balances.json
   - Караван-хвост: сегменты, follow-constraints, потери сегментов от ударов/прессов/снарядов (по balances.json)
   - Flip: repel-пульс, дефлект снарядов, post-flip invuln, shrapnel если включен апгрейдом (по balances.json/run_upgrades.json)
   - Recycler Zone: банкинг хвоста (bank time), лечение, начисление валюты (по balances.json)
   - Враги: chaser/shooter/cutter (по enemies.json)
   - Волны: wave_sets.json + patterns.json + директор сложности (см. ниже)
   - Выбор апгрейдов после волны: редкости по таблицам из balances.json (upgradeRarityRoll) + веса отдельных апгрейдов (weight) из run_upgrades.json, учёт maxStacks, без повторов в одном выборе.
   - Daily-seed: daily.json (UTC date yyyymmdd), варианты дня с modifiers и rulesOverride.
4) Tutorial ≤ 30 секунд: три шага (движение+сбор, flip, recycler). Возможность skip.
5) UI mobile-first:
   - Landscape
   - Виртуальный джойстик + кнопка Flip (+ Dash если доступен)
   - Корректный resize и safe areas
6) Сохранения:
   - localStorage (версионирование схемы, бэкап)
   - Абстракция под платформенный save (если будет)
7) Аудио:
   - Добавить SFX и музыку через MP3 файлы.
   - Если нет исходных mp3 — сделай генератор/скрипт, который создаёт простые mp3 (например, короткие тоны/лупы) локально. Никаких лицензированных ассетов.
   - Итог: в репозитории должны появиться реальные .mp3 файлы в public/assets/audio/ (или аналогично), которые игра загружает и использует.
8) Платформенная универсальность:
   - Сделай PlatformAdapter слой:
     - showInterstitial()
     - showRewarded(placement)
     - save()/load()
     - submitScore()/getLeaderboard() (опционально)
   - Для разработки: mock адаптер без сетевых зависимостей.
   - Для продакшена: адаптеры под CrazyGames/Poki/Яндекс/VK с безопасной деградацией (если SDK недоступен).
   - Моки должны использоваться в тестовых сборках и e2e.

ТЕСТЫ (ОБЯЗАТЕЛЬНО, ПОЛНОЕ ПОКРЫТИЕ):
A) Unit tests (Vitest или Jest):
   - PRNG/seed
   - Применение modifiers (mul/add/set/heal/grant_perk) к конфигу
   - Ролл редкости по таблицам + pity
   - Выбор апгрейдов (без дублей, maxStacks)
   - Расчёт давления (pressure) и targetMin/Max
B) Integration tests:
   - Загрузка JSON конфигов и сборка “RuntimeConfig” (balances + enemies + presets + daily modifiers)
   - Генерация волны из wave_sets + pattern + caps + pressure gating (на уровне логики, без реального рендера)
   - Сохранение/загрузка прогресса (localStorage mock)
C) E2E tests (Playwright):
   - Запуск игры в браузере (dev/mock build)
   - Пройти tutorial (или skip), собрать scrap, нажать Flip, сдать в recycler, дойти до экрана выбора апгрейда
   - Проверка, что UI элементы видимы, что игра не падает, что звук не ломает запуск (учесть autoplay restrictions)
   - Скриншоты/трейсы при ошибке
D) CI:
   - Настроить GitHub Actions (или аналог) на запуск всех тестов + проверки кодировки/BOM.

КОДИРОВКА / BOM:
- Все .md и текстовые инструкции на русском должны быть UTF-8 с BOM.
- Добавь скрипт проверки, который:
  - находит файлы docs/**/*.md и любые platform description файлы
  - проверяет UTF-8 и наличие BOM
  - фейлит сборку при проблемах
- Добавь скрипт “fix-bom”, который добавляет BOM там, где его нет.

ДОКУМЕНТАЦИЯ (ПОДРОБНАЯ):
- docs/README.md (RU, UTF-8 BOM): как запустить, тестировать, собрать, структура проекта
- docs/ARCHITECTURE.md (RU, UTF-8 BOM): подсистемы, конфиги, директор, адаптеры платформ
- docs/DATA_FORMATS.md (RU, UTF-8 BOM): описание JSON схем (balances/enemies/waves/patterns/daily/run_upgrades)
- docs/TESTING.md (RU, UTF-8 BOM): unit/integration/e2e как запускать
- docs/RELEASE.md (RU, UTF-8 BOM): как формируются архивы под каждую платформу, чеклист релиза
- docs/PLATFORMS/*.md (RU+EN, UTF-8 BOM): тексты для CrazyGames/Poki/Яндекс/VK (см. ниже)

ТЕКСТЫ ДЛЯ ПЛАТФОРМ (СДЕЛАЙ RU и EN):
Для каждой платформы (CrazyGames, Poki, YandexGames, VK):
- Название игры (RU и EN)
- “Об игре” (коротко)
- Полное описание
- SEO описание (meta/short SEO blurb)
- “Как играть” (для пользователя)
Сохрани в:
docs/platform_texts/crazygames_ru.md
docs/platform_texts/crazygames_en.md
… и так далее для всех платформ.
Все эти файлы — UTF-8 BOM.

СКРИПТЫ СБОРКИ (ДВА СКРИПТА, ОБЯЗАТЕЛЬНО):
1) “Для тестирования с моками” — один скрипт, который:
   - включает mock PlatformAdapter
   - запускает линтеры/проверки кодировки
   - запускает unit + integration + e2e тесты
   - собирает dev/test build (можно в dist-mock)
   Название: scripts/build_test_mock.(sh|mjs) (выбери кроссплатформенно; предпочтительно node .mjs)
2) “Для релиза без моков” — один скрипт, который:
   - собирает production build (без моков)
   - формирует чистые дистрибутивы для платформ
   - создаёт ZIP архивы:
     dist/releases/magnet-caravan_crazygames.zip
     dist/releases/magnet-caravan_poki.zip
     dist/releases/magnet-caravan_yandex.zip
     dist/releases/magnet-caravan_vk.zip
   - внутри каждого архива только нужные файлы (index.html, assets, js bundle и т.д.)
   - прогоняет хотя бы unit+integration перед сборкой релиза
   Название: scripts/build_release.(sh|mjs)

Если чего-то НЕ ХВАТАЕТ от меня:
- Не задавай общих вопросов.
- Либо:
  1) сделай максимально сам,
  2) или дай конкретный список, что именно нужно, ЗАЧЕМ, и как я могу это предоставить.
- Если нужны внешние файлы/ассеты — дай работающие скрипты, которые сами всё скачивают/генерируют, используя абсолютные ссылки. Но предпочтительнее не требовать от меня ничего и генерировать ассеты локально.

ДИРЕКТОР СЛОЖНОСТИ (ОБЯЗАТЕЛЬНАЯ ЛОГИКА):
- Использовать cfg.director + cfg.waves + wave_sets.json + patterns.json
- Правила честности:
  - safe spawn distance от игрока и recycler (cfg.director.safeSpawnDist / recyclerSafeDist)
  - telegraph перед спавном (cfg.director.telegraphSec)
  - caps по shooters/cutters/total (cfg.director.caps)
  - pressure gating: считаем pressure по cfg.director.pressure.weights и сравниваем с targetMin/Max
  - breather каждые N волн
  - anti-snowball: при низком HP уменьшать бюджет и добавлять scrap
- Всё должно быть покрыто unit/integration тестами.

РЕКЛАМА/МОНЕТИЗАЦИЯ (МИНИМУМ ДЛЯ ПОРТАЛОВ):
- Rewarded: revive, x2 results, reroll (пока в mock просто симулируй успешный просмотр)
- Interstitial: только после забега и с cooldown (не мешать туториалу)
- Все placement ID / поведение — через конфиг/константы в одном месте, чтобы легко тюнить.

ПРОЕКТНЫЕ ОГРАНИЧЕНИЯ:
- Никаких секретов в репо.
- Не трогать/не коммитить `notouch.txt`.
- Следить за размером дистрибутива (минимизировать ассеты, аудио короткие/оптимальные).
- Автозапуск звука запрещён браузерами: музыка должна стартовать после первого user interaction (tap/click). Обязательно учесть.

ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
- Репозиторий с полностью рабочей игрой, конфигами, тестами, CI, документацией, скриптами сборки.
- Используются существующие JSON в public/assets/data.
- Любые новые файлы и изменения аккуратно оформлены и закоммичены.
- Документация на русском (UTF-8 BOM), тексты платформ RU+EN готовы.
- Сборка релиза делает zip архивы под каждую платформу.

ПОРЯДОК РАБОТ:
1) Прочитать docs/knowledge_base.md и кратко законспектировать ключевые требования (в комментарии к PR/коммите или в docs/NOTES.md).
2) Поднять каркас проекта (Vite+TS+Phaser), загрузку конфигов, адаптеры платформ (mock/prod).
3) Реализовать core gameplay.
4) Реализовать директор + волны + апгрейды + daily.
5) Добавить аудио через mp3 (генератор mp3 при необходимости).
6) Добавить тесты (unit/integration/e2e), CI, проверку BOM.
7) Подготовить документацию, тексты платформ RU/EN.
8) Подготовить build_test_mock и build_release с zip-архивами.

НАЧИНАЙ СЕЙЧАС. НЕ ЖДИ УТОЧНЕНИЙ. Если что-то объективно блокирует, опиши это максимально конкретно и предложи готовые скрипты/команды, чтобы я мог быстро дать недостающее.
