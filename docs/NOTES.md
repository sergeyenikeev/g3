# Заметки по docs/knowledge_base.md

Ключевые требования и договорённости (чтобы не потерять по ходу разработки):

- Язык: общение в чате — только RU; тексты платформ — RU+EN; внутриигровой UI можно EN (при желании расширим локализацию позже).
- Кодировка: все русскоязычные `.md` (и тексты для платформ) должны быть UTF-8 **с BOM**; в CI обязателен авто-чек + авто-фикс.
- Git: все изменения коммитятся; **не коммитить** `notouch.txt`; не коммитить секреты и `.env*` (кроме `.env.example`); проверить `.gitignore`.
- Движок/сборка: Phaser 3 + TypeScript + Vite.
- Полностью data-driven: никакого хардкода баланса/волн/врагов/апгрейдов в коде — всё из `public/assets/data/*.json`; апгрейды применяются по `path` в конфиг.
- Платформы: слой `PlatformAdapter` (mock для dev/test + prod-адаптеры с безопасной деградацией, если SDK недоступен).
- Аудио: реальные `.mp3` в репозитории; музыка стартует только после первого user interaction (autoplay policy).
- Тесты: unit + integration (Vitest) и e2e (Playwright) с прохождением tutorial/skip, сбором scrap, Flip, сдачей в recycler и выходом на экран апгрейдов.
- Директор сложности: safe spawn + telegraph + caps + pressure gating + breather + anti-snowball; покрытие unit/integration.
- Скрипты: `scripts/build_test_mock.mjs` и `scripts/build_release.mjs` (release делает zip под CrazyGames/Poki/Yandex/VK).

