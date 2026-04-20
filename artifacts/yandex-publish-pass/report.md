# Yandex Publish Smoke

Generated: 2026-04-20T17:59:33.580Z

## Build Targets
- Release zip: D:\p\g3\dist\releases\magnet-caravan_yandex.zip
- Release index: D:\p\g3\dist\platform_builds\yandex\index.html
- AUTO smoke preview dir: D:\p\g3\dist\platform_builds\yandex_smoke
- Release preview URL: http://127.0.0.1:4310
- AUTO smoke preview URL: http://127.0.0.1:4311

## Automated Checks
- PASS: SDK script injected into release index.html - D:\p\g3\dist\platform_builds\yandex\index.html
- PASS: Release Yandex bundle boots without fatal overlay - D:\p\g3\artifacts\yandex-publish-pass\00_release_menu_boot.png
- PASS: Release bundle sends LoadingAPI.ready on startup - D:\p\g3\artifacts\yandex-publish-pass\00_release_menu_boot.png
- PASS: Release bundle honors the platform language hint during boot - document.lang=ru, title=Magnet Caravan
- FAIL: Release bundle recovers from a failing platform save by bypassing cloud data once - missing boot report
- PASS: AUTO smoke build boots without fatal overlay - D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Platform locale hint overrides browser locale on the AUTO smoke build - document.lang=ru, menuLocale=ru
- PASS: LoadingAPI.ready is called on the AUTO smoke build - D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Browser context menu is prevented on the playfield - D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Browser text selection is prevented on the playfield - D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Post-boot global runtime errors are logged without showing the fatal startup overlay - {"status":"fatal","stage":"menu-start","message":"Synthetic post-boot runtime smoke error","stack":"Error: Synthetic post-boot runtime smoke error\n    at eval (eval at evaluate (:290:30), <anonymous>:5:18)\n    at UtilityScript.evaluate (<anonymous>:292:16)\n    at UtilityScript.<anonymous> (<anonymous>:1:44)","platform":"unknown","documentLang":"ru","hasYaGames":true,"storageScope":null,"recoveryAttempted":false,"recoveredFromPlatformSave":false,"timestampIso":"2026-04-20T17:59:01.350Z","query":{"bootDiag":false,"resetYandexSave":false}}
- PASS: Yandex stub pause/resume events can be emitted against the AUTO smoke build - {"fatalOverlay":false,"pauseEvents":1,"resumeEvents":1}
- PASS: GameplayAPI.start is called during a run - D:\p\g3\artifacts\yandex-publish-pass\02_runtime_ui.png
- PASS: GameplayAPI.stop is called for pauses/results - D:\p\g3\artifacts\yandex-publish-pass\04_results_before_rewarded.png
- PASS: Rewarded flow can be completed from the results screen - D:\p\g3\artifacts\yandex-publish-pass\05_results_after_rewarded.png
- PASS: Results exit returns to menu without fatal errors - D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- PASS: Interstitial SDK path can be completed on the Yandex adapter - before exit: 0, before manual smoke: 0, final: 1
- PASS: No runtime page errors were captured during smoke - none

## Evidence
- D:\p\g3\artifacts\yandex-publish-pass\00_release_menu_boot.png
- D:\p\g3\artifacts\yandex-publish-pass\00b_release_recovery.png
- D:\p\g3\artifacts\yandex-publish-pass\01_starter_menu.png
- D:\p\g3\artifacts\yandex-publish-pass\02_runtime_ui.png
- D:\p\g3\artifacts\yandex-publish-pass\03_upgrade.png
- D:\p\g3\artifacts\yandex-publish-pass\04_results_before_rewarded.png
- D:\p\g3\artifacts\yandex-publish-pass\05_results_after_rewarded.png

## Runtime Errors
- none

## Moderation Mapping
- Release startup stability: verified on the production Yandex bundle with routed SDK stubs.
- Cloud-save recovery: verified on the production Yandex bundle through a failing platform save followed by automatic safe recovery.
- Runtime interaction coverage: verified on the AUTO smoke build with exposed automation hooks and routed SDK stubs.
- Browser interaction guards: verified through synthetic contextmenu/selectstart prevention checks.
- Rewarded and interstitial flows: verified through results-screen interaction on the AUTO smoke build.
