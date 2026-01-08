# Visual Style Kit (Magnet Caravan)

Цель: сделать игру визуально “дороже” без художника и без бюджета за счёт единого стиля, слоёв, процедурных ассетов и системных VFX-триггеров.

## 1) Настроение (Mood)
- “Неоновая свалка”: тёмная основа + тёплые ржавые пятна + холодные электрические акценты.
- Читаемость важнее реализма: контрастные контуры, простые формы, минимум деталей на объектах/персонажах.

## 2) Палитра (обязательная)
Использовать эти цвета как базовые (в коде: `VISUAL_PALETTE` в `src/visual/TextureFactory.ts`).

- Background deep: `#0B0F14`
- Background mid:  `#121A24`
- Rust dark:       `#3A2A1E`
- Rust mid:        `#6B3F2B`
- Metal gray:      `#6E7A86`
- Metal light:     `#A7B2BE`
- Neon cyan:       `#3AF2FF`
- Neon blue:       `#2D7BFF`
- Neon magenta:    `#FF3AD7`
- Warning amber:   `#FFB02E`
- HP red:          `#FF3D3D`
- Success green:   `#3DFF9B`

## 3) Линии и формы
- Контур интерактивных объектов: 2–3 px, округлые углы.
- Важные интерактивные элементы имеют мягкий “glow blob” под собой (blend: `ADD`).
- Детали — только для “считывания”, не для реализма (царапины/болты/пятна).

## 4) Редкости (цвета подсветки)
- Common:   `#6E7A86`
- Uncommon: `#3DFF9B`
- Rare:     `#2D7BFF`
- Epic:     `#FF3AD7`

## 5) Layering / слои сцены (L0–L8)
Порядок от дальнего к ближнему:

- L0: `BG_FAR` — дальний фон/силуэты (параллакс ~0.05)
- L1: `BG_TILE` — основной тайловый фон (параллакс ~0.10)
- L2: `BG_DECALS` — пятна/царапины/болты (параллакс ~0.10)
- L3: `MID_PROPS` — декоративные объекты (параллакс ~0.18) (опционально)
- L4: `GAME_WORLD` — игрок, враги, scrap, хвост (камера 1.0)
- L5: `VFX_WORLD` — частицы/кольца/трейлы (камера 1.0)
- L6: `FG_FOG` — лёгкий дым/пыль поверх мира (параллакс ~0.25, low alpha)
- L7: `OVERLAY` — vignette + light gradient (камера 0, fixed)
- L8: `UI` — HUD/кнопки/тексты (камера 0, fixed)

Реализация:
- `src/game/scenes/GameScene.ts` создаёт фон/декали/fog.
- `src/game/scenes/UIScene.ts` рисует overlay (`vignette`, `lightGradient`) под UI.

## 6) Ассеты (генерация и фолбэки)
Правило: ассеты либо генерируются в рантайме (CanvasTexture), либо заранее скриптом и лежат в `public/assets/generated/`.

- Генератор PNG: `npm run visual:generate` (`scripts/generate_visual_assets.mjs`)
- Предзагрузка PNG: `src/game/scenes/BootScene.ts`
- Рантайм-фолбэк генерации: `src/visual/TextureFactory.ts` (`create*`)

Ключевые имена (PNG/texture keys):
- BG: `bg_tile_256`, `bg_far_silhouette`
- Decals: `decal_oil_01..04`, `decal_scratch_01..04`, `decal_bolts_01..04`
- Overlays: `vignette`, `lightGradient`
- VFX: `vfx_ring`, `vfx_glow_blob`, `vfx_spark`, `vfx_smoke_puff`, `vfx_trail`, `vfx_hit_flash`, `vfx_line`

## 7) Фон: “живость”
- Пыль: 10–30 маленьких альфа-точек, медленный дрейф.
- Редкие дальние искры: 1–2 в секунду, слабые.
- `FG_FOG`: лёгкий дым/туман поверх мира (низкая альфа).
