# Yandex Publish Smoke

Generated: 2026-04-19T05:49:28.709Z

## Build Targets
- Release zip: D:\p\g3\dist\releases\magnet-caravan_yandex.zip
- Release index: D:\p\g3\dist\platform_builds\yandex\index.html
- Smoke preview dir: D:\p\g3\dist\platform_builds\yandex_smoke
- Local preview URL: http://127.0.0.1:4310

## Automated Checks
- PASS: SDK script injected into release index.html — D:\p\g3\dist\platform_builds\yandex\index.html
- PASS: Yandex build boots without fatal overlay — D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: LoadingAPI.ready is called on startup — D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Browser context menu is prevented on the playfield — D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Browser text selection is prevented on the playfield — D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: GameplayAPI.start is called during a run — D:\p\g3\artifacts\yandex-publish-pass\02_runtime_ui.png
- PASS: GameplayAPI.stop is called for pauses/results — D:\p\g3\artifacts\yandex-publish-pass\04_results_before_rewarded.png
- PASS: Rewarded flow can be completed from the results screen — D:\p\g3\artifacts\yandex-publish-pass\05_results_after_rewarded.png
- PASS: Results exit returns to menu without fatal errors — D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Interstitial SDK path can be completed on the Yandex adapter — before exit: 0, before manual smoke: 0, final: 1
- PASS: No runtime page errors were captured during smoke — none

## Evidence
- D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- D:\p\g3\artifacts\yandex-publish-pass\02_runtime_ui.png
- D:\p\g3\artifacts\yandex-publish-pass\03_upgrade.png
- D:\p\g3\artifacts\yandex-publish-pass\04_results_before_rewarded.png
- D:\p\g3\artifacts\yandex-publish-pass\05_results_after_rewarded.png

## Runtime Errors
- none

## Moderation Mapping
- Localization and readable staged UI: covered by the existing visual matrix in artifacts/ui-audit/matrix and the RU/EN smoke suite.
- Resize / overlap regressions: covered by the compact viewport e2e suite plus the visual matrix.
- Browser interaction guards: verified here through synthetic contextmenu/selectstart prevention checks.
- Startup/runtime stability: verified here through Yandex-adapter boot and zero page errors during smoke.
- Rewarded clarity and SDK flow: verified here through a rewarded results interaction on the Yandex preview build.
