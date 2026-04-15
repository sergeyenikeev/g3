# Публикация В Яндекс Игры

Этот документ нужен как практический publish-runbook для `Magnet Caravan`.
Он покрывает:
- что уже готово в коде;
- что загружать в консоль;
- какие поля лучше заполнить в карточке игры;
- что ещё нужно подготовить вне кода перед модерацией.

## Официальные ссылки

- Quick start: https://yandex.com/dev/games/doc/en/concepts/quick-start
- Requirements: https://yandex.com/dev/games/doc/en/concepts/requirements
- SDK: https://yandex.com/dev/games/doc/en/sdk
- Add new game: https://yandex.com/dev/games/doc/en/console/add-new-game
- Monetization: https://yandex.com/dev/games/doc/en/services/about-monetization

## Что Уже Готово

Кодом уже закрыто:
- обязательная интеграция SDK Яндекс Игр через `/sdk.js` для архивной публикации;
- вызов `LoadingAPI.ready()` после загрузки и выхода в главное меню;
- вызовы `GameplayAPI.start()` и `GameplayAPI.stop()` на реальных переходах gameplay;
- обработка platform/page pause/resume;
- cloud save через `player.getData()` и `player.setData()` с безопасным fallback;
- автоопределение языка через `environment.i18n.lang`;
- daily UTC seed через `serverTime()`, а не локальные часы браузера;
- rewarded и interstitial через платформенный SDK;
- музыка не стартует до первого пользовательского действия.

## Что Загружать В Консоль

Готовый архив:
- `dist/releases/magnet-caravan_yandex.zip`

Готовый upload-kit:
- `dist/upload_ready/yandex/`
- `dist/upload_ready/magnet-caravan_yandex_publishing-kit.zip`

Архив, который нужно загружать именно в консоль Яндекс Игр:
- `dist/upload_ready/yandex/UPLOAD_THIS_TO_YANDEX_magnet-caravan_yandex.zip`

Готовые тексты:
- `docs/platform_texts/yandex_ru.md`
- `docs/platform_texts/yandex_en.md`

Быстрая пересборка всего publish-пакета:
- `npm run package:yandex`

Текущая версия билда:
- `0.1.0`

## Рекомендованные Поля Карточки

Ниже значения, которые можно брать как стартовый вариант.

### Основное

- Название: `Magnet Caravan`
- Языки интерфейса: `ru`, `en`
- Платформы: `desktop`, `mobile`
- Ориентация: `landscape`
- Cloud save: `enabled`

### Жанр И Позиционирование

Если в консоли доступны несколько жанров, рекомендую:
- основной жанр: `Arcade`
- дополнительный жанр: `Action`

Если жанры в конкретной форме отличаются, брать самые близкие аналоги:
- `Arcade`
- `Action`
- `Casual`
- `Survival`

### Теги

Теги в консоли могут отличаться по доступному словарю, поэтому выбирать ближайшие из списка:
- `arcade`
- `action`
- `survival`
- `mobile`
- `skill`
- `daily`

### Keywords

Если есть поле keywords, рекомендую такой вариант:

```text
магнит,аркада,выживание,волны,улучшения,ежедневный режим
```

Если нужен английский вариант:

```text
magnet,arcade,survival,waves,upgrades,daily
```

### Возраст

Рекомендация для первой отправки:
- `12+`

Причина:
- в игре есть атаки, снаряды и враги, но без крови, расчленения и реалистичного насилия.

Если юридическая или продуктовая проверка у вас внутри команды использует другой стандарт, этот пункт лучше переподтвердить отдельно.

## Готовые Тексты Для Консоли

### RU

- Название: `Magnet Caravan`
- Короткое описание:

```text
Собирайте металлолом магнитом, выстраивайте хвост-караван и сдавайте его в переработчик. Импульс помогает оттолкнуть врагов и отразить снаряды.
```

- Полное описание:

```text
Magnet Caravan — аркадная игра с видом сверху для горизонтального экрана. Управляйте тягачом виртуальным джойстиком или клавиатурой, собирайте металлолом, удлиняйте караван и в нужный момент сдавайте добычу в зону переработки, получая болты и восстановление прочности.

Враги приходят волнами, а сложность нарастает постепенно: игра следит за безопасной дистанцией появления, предупреждает о новых угрозах и меняет состав роя по ходу забега. Между волнами вы выбираете улучшения и собираете свой стиль игры.

Есть ежедневный режим с особым набором правил и модификаторов дня.
```

- Как играть:

```text
Ведите тягач джойстиком, клавишами WASD или стрелками. Собирайте металлолом, чтобы увеличить караван. Нажимайте импульс, чтобы отталкивать врагов и отражать снаряды. Заезжайте в зону переработки и оставайтесь в ней, пока добыча не будет сдана. После каждой волны выбирайте улучшение и подстраивайте сборку под текущий забег.
```

### EN

- Title: `Magnet Caravan`
- Short description:

```text
Collect scrap with a magnet, grow a caravan tail, bank it for bolts and healing, and survive waves with a powerful Flip pulse.
```

- Full description:

```text
Magnet Caravan is a landscape-friendly mobile-first top-down arcade. Use the virtual joystick and Flip button to dodge danger, pull scrap into your tail, and bank it at the Recycler Zone.

Waves are driven by a fairness-first director: safe spawn distance, spawn telegraph, caps per enemy type, and pressure gating. Between waves you pick upgrades that apply to the run configuration.

Daily mode uses a UTC seed with unique modifiers and rules.
```

- How to play:

```text
Move with the joystick or WASD. Collect scrap to grow your tail. Press Flip to pulse and deflect shots. Stay in the Recycler Zone to bank your haul. Pick upgrades between waves and adapt your build to the current run.
```

## Монетизация

Рекомендованная конфигурация для публикации:
- rewarded video:
  - revive
  - x2 results
  - reroll
  - extra daily attempt
  - start booster
- interstitial:
  - только на экране результатов;
  - не в середине активного gameplay;
  - не до завершения/скипа обучения;
  - не сразу после rewarded.

Это соответствует текущей реализации игры.

## Креативы И Медиа

По документации для карточки игры понадобятся:
- иконка `512x512`, `PNG`;
- обложка `800x470`, `PNG`;
- desktop screenshots:
  - соотношение `16:9`;
  - длинная сторона `1280-2560`;
  - `JPEG` или `24-bit PNG`;
- mobile screenshots:
  - соотношение `16:9`;
  - длинная сторона `1280-2560`;
  - `JPEG` или `24-bit PNG`.

Важно:
- на скриншотах и видео должен быть реальный gameplay;
- креативы должны соответствовать фактическому интерфейсу и управлению;
- если на креативе есть текст, его стоит делать в той локали, под которую загружается набор.

## Финальный Пакет В Репозитории

На текущий момент в репозитории уже собирается полный publish-kit:
- игровой архив в `dist/releases/magnet-caravan_yandex.zip`;
- upload-ready каталог в `dist/upload_ready/yandex/`;
- отдельный архив для консоли в `dist/upload_ready/yandex/UPLOAD_THIS_TO_YANDEX_magnet-caravan_yandex.zip`;
- единый ZIP publishing-kit в `dist/upload_ready/magnet-caravan_yandex_publishing-kit.zip`;
- медиа-набор в `docs/promo/yandex/`.

Если нужно пересобрать всё заново одной командой:
- `npm run package:yandex`

## Комментарий Для Модерации

Рекомендованный текст для поля developer comment или внутренней заметки:

```text
The game uses the official Yandex Games SDK only. Rewarded ads are user-initiated. Interstitial ads are shown only on the results screen, outside active gameplay. Game loading and gameplay hooks are integrated. Audio starts only after user interaction. Cloud save uses player data.
```

## Финальный Чеклист Перед Отправкой

- загрузить `dist/upload_ready/yandex/UPLOAD_THIS_TO_YANDEX_magnet-caravan_yandex.zip`;
- проверить, что `index.html` находится в корне архива;
- включить `landscape`;
- включить `desktop` и `mobile`;
- включить `cloud save`;
- вставить RU и EN тексты;
- загрузить icon, cover, screenshots;
- проверить рекламу только через SDK платформы;
- пройти smoke-test в черновике:
  - загрузка;
  - старт run;
  - rewarded;
  - results interstitial;
  - возврат из background;
  - смена языка;
  - сохранение прогресса.

## Повторная Проверка После Прошлых Отклонений

- для поля `How to play [ru]` брать текст только из `dist/upload_ready/yandex/texts/how_to_play_ru.txt` или `texts/how_to_play_ru.txt` внутри publishing-kit; не копировать английскую версию и не смешивать языки;
- в архиве публикации `index.html` должен лежать в корне, а в `<head>` должен быть `script async src="/sdk.js"` до основного модульного бандла;
- все rewarded CTA должны прямо говорить о рекламе:
  - `ИГРАТЬ + БУСТ (за рекламу)`;
  - `ЕЖЕДНЕВКА (за рекламу)`;
  - `БУСТ ЗА РЕКЛАМУ`;
  - `ПЕРЕБРОС (за рекламу)`;
  - `ПРОДОЛЖИТЬ (за рекламу)`;
  - `УСИЛИТЬ НАГРАДЫ x2 (за рекламу)`;
- в preview на десктопе проверить resize минимум на `1600x900`, `1280x720`, `900x500` и `680x380`: панели, HUD, tutorial, pause/settings и results не должны обрезаться, наезжать друг на друга или выходить за границы окна;
- в preview не должно быть нативного выделения текста, drag-selection и контекстного меню браузера при кликах и правом клике по игре;
- в Yandex draft открыть debug panel и убедиться, что loader показывает `IT`, а не `IF`.

## Для Следующих Площадок

Текущая архитектура уже готова к поэтапному переносу:
- не завязана на локальные часы браузера;
- не завязана на `navigator.language`;
- lifecycle платформы вынесен в `PlatformAdapter`;
- gameplay hooks не смешаны с бизнес-логикой сцен.

Для RuStore, VK Play, OK, SmartMarket и других русскоязычных площадок дальше выгоднее сохранять тот же контракт:
- ads;
- save/load;
- language hint;
- server time;
- loading ready hook;
- gameplay start/stop hook;
- platform pause/resume.

Что уже можно использовать как базу для следующей витрины:
- нейтральный архив: `dist/releases/magnet-caravan_generic.zip`;
- универсальные тексты: `docs/platform_texts/generic_ru.md` и `docs/platform_texts/generic_en.md`;
- медиа-набор: `docs/promo/yandex/` как исходник для адаптации под требования конкретной площадки.
