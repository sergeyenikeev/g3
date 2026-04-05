# Yandex Promo Assets

Основные файлы для загрузки в консоль Яндекс Игр:

- `card/icon_512x512.png`
- `card/cover_800x470.png`
- `desktop/01_menu_1600x900.png`
- `desktop/02_gameplay_1600x900.png`
- `desktop/03_upgrade_1600x900.png`
- `mobile/01_gameplay_1280x720.png`
- `mobile/02_results_1280x720.png`

Дополнительные варианты:

- `card/icon_menu_alt_512x512.png`
- `card/cover_menu_alt_800x470.png`
- `desktop/04_results_1600x900.png`

Повторная генерация:

```bash
npm run media:yandex
```

Скрипт:

- поднимает локальный dev-сервер с `VITE_PLATFORM_ADAPTER=mock` и `VITE_E2E=1`;
- проходит игровой flow через Playwright;
- сохраняет реальные screenshot-ассеты;
- собирает `icon` и `cover` в нужных размерах.
