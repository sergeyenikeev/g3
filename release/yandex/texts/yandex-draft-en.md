# Magnet Caravan — Yandex Games draft (EN)

All fields are sized for the Yandex Games console draft. Lengths are noted for review.

## Title
Magnet Caravan

> 14 characters. Brand name, identical to the RU version.

## Short description
Magnetize scrap, flip the field to repel foes, and bank your caravan.

> 68 characters. No "free" wording, does not duplicate the title.

## SEO description
Top-down arcade survival: magnetize scrap into a long tail, flip the field to repel foes, and bank the haul at the recycler.

> 123 characters. Genre first, ends with a clear benefit cue.

## About the game (full description)
Magnet Caravan is a fast top-down arcade survival run. You drive a magnet rig across a post-industrial scrapyard: drag loose scrap into a long caravan tail and bank it at the recycler for bolts and a chunk of hull repair.

A polarity flip pushes nearby enemies away and deflects incoming shots, opening a window for safe maneuvering. Between waves you pick one of three upgrades and shape your build around the magnet, the flip, the caravan, or extra defense. Difficulty ramps fairly — no spawns in your face, with telegraphs and breathers built into the wave director.

A daily mode uses a shared UTC seed with day modifiers, so every player runs the same yard on the same day.

> 758 characters.

## How to play
Survive enemy waves and earn bolts by banking your scrap caravan at the recycler.

1. Move with WASD, arrow keys, or the on-screen joystick on touch devices.
2. Collect scrap — the magnet pulls it in and attaches it to your tail.
3. Tap the flip (Space, right click, or the on-screen flip button) to push enemies away and deflect projectiles; you get a short invulnerability right after a flip.
4. Drive into the recycler zone and stay inside until the caravan is banked.
5. After each wave, choose one of three upgrades and shape your build for the rest of the run.

Progress is saved through Yandex Games cloud save and follows your account across devices.

> 723 characters.

## Version
1.0.0

> Internal `package.json` shows `0.1.0`; for the store listing we use the public release number `1.0.0`.

## Platforms
- Desktop
- Mobile

> The game ships with a touch joystick, safe-area handling, and large tap targets, so both desktop and mobile browsers are supported.

## Orientation
Landscape.

> Designed for a landscape canvas; the touch joystick is anchored to landscape corners.

## Age rating
12+

> Stylized enemies and neon effects, no blood or realistic violence. 12+ is the safest fit for a top-down arcade action with projectiles.

## Categories
- Arcade
- Action

> Two categories that match the actual gameplay loop.

## Tags
arcade, action, survival, top-down, reflex, waves, upgrades, roguelite, daily run, pickup, magnet, mobile-friendly, simple controls, single-player, no purchase required, session-based, ages 12 and up, leaderboards, no gore, ad-friendly

> 20 tags, each one tied to a real mechanic or content trait.

## Keywords
magnet,arcade,survival,waves,upgrades,caravan,daily run,top-down,roguelite

> 78 characters, lowercase, comma-separated.

## Cloud saves
Enabled.

> Confirmed in `src/platform/adapters/yandexGamesPlatformAdapter.ts`: the adapter calls `player.getData()` and `player.setData(data, true)` — the standard Yandex Games cloud save path.

## Moderation comment
The game integrates only the official Yandex Games SDK (`LoadingAPI.ready`, `GameplayAPI.start/stop`, `adv.showFullscreenAdv`, `adv.showRewardedVideo`, `getPlayer`, `getLeaderboards`). Rewarded ads run only after an explicit user action (x2 reward, revive, reroll upgrade, extra daily attempt, start boost). Interstitial ads run only on the results screen outside the active run, with a cooldown and never right after a rewarded ad. Music starts only after the first user interaction. Cloud saves use `player.setData/getData`.
