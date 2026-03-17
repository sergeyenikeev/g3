# Чеклист релиза Magnet Caravan

Этот чеклист заполняется по факту и помогает быстро понять: что уже готово, а что ещё осталось.

## 1) Репозиторий и безопасность
- [x] `notouch.txt` в `.gitignore` и не коммитится
- [x] `.env*` в `.gitignore` (кроме `.env.example`)
- [x] Нет секретов/ключей/токенов в репозитории
- [x] Все изменения коммитятся в git и пушатся в `origin/main`

## 2) Кодировка RU-документации
- [x] Все `docs/**/*.md` и `docs/platform_texts/*.md` в UTF-8 с BOM
- [x] `npm run bom-check` фейлит сборку при проблемах
- [x] `npm run fix-bom` автоматически исправляет BOM/кодировку
- [x] CI запускает `bom-check`

## 3) Сборка/тесты/CI
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] Unit (Vitest): PRNG, modifiers, rarity+pity, upgrade selection, pressure
- [x] Integration (Vitest): RuntimeConfig из JSON, WaveDirector, SaveManager, Daily attempts, Ads guards/AdsManager
- [x] E2E (Playwright): training enter/exit, daily enter, tutorial skip, bank, upgrade, results x2
- [x] CI (GitHub Actions): lint + bom-check + typecheck + unit+integration + Playwright

## 4) Gameplay (core)
- [x] Phaser 3 + TypeScript + Vite
- [x] Магнит: притяжение scrap из `balances.json`
- [x] Караван-хвост: сегменты, follow, потери от врагов/снарядов
- [x] Flip: repel-пульс, дефлект снарядов, post-flip invuln, шрапнель через апгрейд
- [x] Recycler Zone: bank time, heal, начисление bolts
- [x] Враги: chaser / shooter / cutter
- [x] Tutorial ≤ 30 секунд (3 шага) + skip
- [x] Отдельный режим обучения (`TRAINING`) с безопасным выходом обратно в меню
- [x] UI mobile-first (landscape), виртуальный джойстик + Flip (+ Dash по условию)
- [x] Resize + safe areas (viewport-fit=cover)

## 5) Data-driven конфиги
- [x] Все основные конфиги в `public/assets/data/*.json`
- [x] RuntimeConfig собирается из JSON (presets + meta + daily modifiers)
- [x] Run upgrades применяются по `path` через эффекты
- [x] Daily modifiers применяются по `path`
- [x] Балансные параметры рекламы в `balances.json` (`ads.*`)
- [x] Аудит «хардкодов баланса»: ключевые константы вынесены в `balances.json` (`tuning.*`) и `daily.json` (specialRule.*)

## 6) Директор сложности / волны
- [x] Safe spawn distance (player/recycler)
- [x] Telegraph перед спавном
- [x] Caps shooters/cutters/total
- [x] Pressure gating (targetMin/Max + weights)
- [x] Breather waves
- [x] Anti-snowball (low HP + extra scrap)

## 7) Daily (попытки/seed/UI)
- [x] Seed UTC yyyymmdd
- [x] Детеминированный выбор варианта дня
- [x] Daily попытки: 1 бесплатная + rewarded extra attempts (лимит из `daily.json`)
- [x] Показ в меню: seed, title/desc варианта, attempts, best daily score
- [x] Доп. правила из knowledge_base: rewarded `start booster` (через `ads.rewarded.startBooster`)

## 8) Монетизация (ads)
- [x] Rewarded: revive / x2 results / reroll
- [x] Interstitial: только на results screen
- [x] Cooldown между interstitial (из `balances.json`)
- [x] Запрет interstitial до завершения/скипа туториала (из `balances.json`)
- [x] Запрет interstitial первые N завершённых забегов (из `balances.json`)
- [x] Запрет interstitial сразу после rewarded (из `balances.json`)

## 9) Analytics
- [x] Единый `AnalyticsAdapter` (mock + Yandex/VK autodetect)
- [x] События: session_start/end, tutorial*, run_start/end, upgrade_offer, bank/flip, ads rewarded/interstitial, daily*
- [x] SDK-интеграции best-effort (CrazyGames loading/gameplay hooks, VK trackEvent если доступен)

## 10) Платформы/релизы
- [x] PlatformAdapter слой (mock/local + Yandex/VK) с безопасной деградацией
- [x] `scripts/build_test_mock.mjs` (моки + проверки + тесты + dist-mock)
- [x] `scripts/build_release.mjs` (unit+integration + prod build + zip релизы)
- [x] ZIP: `dist/releases/magnet-caravan_{web,yandex,vk}.zip`
- [x] SDK loader + platform builds: `src/platform/sdk/loadPlatformSdk.ts` + release-сборка по активным целям

## 11) Аудио
- [x] Реальные `.mp3` в `public/assets/audio/`
- [x] Генератор `npm run audio:generate` (без лицензированных ассетов)
- [x] Музыка стартует только после user interaction (autoplay policy)
