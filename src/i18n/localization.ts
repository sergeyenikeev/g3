import type { EnemyType, Rarity, RunUpgradeDef } from "../data/types";

export type Locale = "en" | "ru";
export type LanguageSetting = "auto" | Locale;

type MessageValue = string | ((params?: Record<string, unknown>) => string);
type UpgradeCopy = { title: string; desc: string };
type RotationCopy = UpgradeCopy & { badge: string };

const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
};

const MESSAGES: Record<Locale, Record<string, MessageValue>> = {
  en: {
    "app.title": "Magnet Caravan",
    "menu.workshop": "WORKSHOP",
    "menu.play": "PLAY",
    "menu.playBoost": "PLAY + BOOST (Rewarded)",
    "menu.training": "TRAINING",
    "menu.daily": "DAILY",
    "menu.dailyFree": "DAILY (Free)",
    "menu.dailyRewarded": "DAILY (Rewarded)",
    "menu.dailyLocked": "DAILY (Locked)",
    "menu.dailyBoost": "DAILY + BOOST",
    "menu.dailyBoostExtra": "DAILY + BOOST (Extra Attempt)",
    "menu.dailyBoostLocked": "DAILY + BOOST (Locked)",
    "menu.playFreeBoost": (p) => `PLAY + FREE BOOST (${p?.usesLeft ?? 0} left)`,
    "menu.rotationLine": (p) => `Rotation: ${p?.badge ?? "Event"} | ${p?.title ?? "Daily Rotation"}`,
    "menu.streakLine": (p) => `Streak Day ${p?.day ?? 1}: ${p?.reward ?? ""} | ${p?.status ?? ""}`,
    "menu.claimReady": "claim ready",
    "menu.claimedToday": "claimed today",
    "menu.missionsLine": (p) =>
      `Missions: daily ${p?.dailyDone ?? 0}/${p?.dailyTotal ?? 0} | weekly ${p?.weeklyDone ?? 0}/${p?.weeklyTotal ?? 0} | ready ${p?.ready ?? 0}`,
    "menu.comebackLine": (p) => `Comeback: ${p?.days ?? 0} days away | ${p?.reward ?? ""}`,
    "menu.tomorrowOfferLine": (p) => `Tomorrow: ${p?.title ?? "Fresh yard bonus"} | ${p?.reward ?? ""}`,
    "menu.claimOpsReady": (p) => `CLAIM READY (${p?.count ?? 0})`,
    "menu.claimOpsIdle": "NO CLAIMS READY",
    "menu.claimAction": "CLAIM",
    "menu.missions": "MISSIONS",
    "menu.boostToggle": "BOOST FOR AD",
    "menu.boostToggleHint": "Applies to Play and Daily",
    "menu.summaryRewards": "REWARDS",
    "menu.summaryDaily": "DAILY",
    "menu.summaryWeekly": "WEEKLY",
    "menu.utilityHint": "Quick links and settings",
    "menu.tagline": "Flip the field. Bank the haul. Outlast the swarm.",
    "menu.heroLead": "Escort the magnet rig through scrap storms and feed the recycler before the swarm closes in.",
    "menu.controls": "WASD/Arrows: move | Space: flip | Shift: dash",
    "menu.stageHint.starter": "Start a run, collect scrap, and bank it at the recycler.",
    "menu.stageHint.growing": "Play a run, then invest in one smart upgrade for the next push.",
    "menu.stageHint.advanced": "Tune your build, climb the board, and chase a stronger salvage loop.",
    "menu.best": (p) => `Best wave: ${p?.bestWave ?? 0} | Best bolts: ${p?.bestBolts ?? 0}`,
    "menu.pilotButton": (p) => `Pilot: ${p?.name ?? "AUTO"}`,
    "menu.pilotAuto": "AUTO",
    "menu.pilotPrompt": "Set your pilot callsign. Leave it blank to use an auto callsign.",
    "menu.pilotUnsupported": "Pilot rename is unavailable on this platform.",
    "menu.leaderboard": "TOP PILOTS",
    "menu.leaderboardTitle": "Top pilots",
    "menu.leaderboardEmpty": "No runs on the board yet.",
    "menu.leaderboardHint": (p) =>
      `Showing ${p?.mode ?? "ALL"} standings. Current pilot: ${p?.pilot ?? "AUTO"}. Score rewards survival first, then bolts, cores and caravan length.`,
    "menu.leaderboardScoring": "Score rewards deep runs first, then bolts, cores and tail length.",
    "menu.leaderboardLatest": (p) => `Latest run landed at #${p?.rank ?? 0} on the ${p?.mode ?? "ALL"} board.`,
    "menu.leaderboardRecord": (p) => `New record: #${p?.rank ?? 0} on the ${p?.mode ?? "ALL"} board.`,
    "menu.leaderboardPromotion": (p) => `League promotion: ${p?.division ?? "Scrapper"} | ${p?.reward ?? ""}`,
    "menu.leaderboardCareerNext": (p) =>
      `Career league: ${p?.division ?? "Scrapper"} | Next ${p?.nextDivision ?? "Raider"} at ${p?.score ?? "0"}`,
    "menu.leaderboardCareerTop": (p) => `Career league: ${p?.division ?? "Legend"} | Top division secured`,
    "menu.leaderboardLeaderLine": (p) => `Leader: ${p?.pilot ?? "AUTO"} | ${p?.score ?? "0"}`,
    "menu.leaderboardRivalLine": (p) => `Next rival: ${p?.pilot ?? "AUTO"} | ${p?.score ?? "0"}`,
    "menu.leaderboardLeagueLine": (p) => `League: ${p?.division ?? "Scrapper"} | Next ${p?.nextDivision ?? "Raider"} at ${p?.score ?? "0"}`,
    "menu.leaderboardLeagueTop": (p) => `League: ${p?.division ?? "Legend"} | Top division secured`,
    "menu.wallet": (p) => `Wallet: ${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.walletCompact": (p) => `${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.stockpile": (p) => `Stockpile: ${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.stockpileCompact": (p) => `${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.workshopHint": "Permanent upgrades apply to all future runs.",
    "menu.workshopFooter": "Buy upgrades with salvaged bolts and rare cores.",
    "menu.workshopVisibleCount": (p) => `Visible upgrades: ${p?.visible ?? 0}/${p?.total ?? 0}`,
    "menu.workshopUnlockLaterStarter": "More workshop systems appear after a few runs.",
    "menu.workshopUnlockLaterGrowing": "More workshop systems appear as your caravan grows.",
    "menu.workshopCompactViewport": "Compact view shows the next best upgrades first.",
    "menu.workshopRecommendation": (p) => `Best next step: ${p?.name ?? "Upgrade"}`,
    "menu.workshopRecommendationDone": "Every visible upgrade is already installed.",
    "menu.recommendedBadge": "RECOMMENDED",
    "menu.close": "CLOSE",
    "menu.level": (p) => `Level ${p?.level ?? 0}/${p?.maxLevel ?? 0}`,
    "menu.buy": "BUY",
    "menu.locked": "LOCKED",
    "menu.installedButton": "INSTALLED",
    "menu.maxed": "MAXED",
    "menu.installedList": (p) => `Installed: ${p?.items ?? ""}`,
    "menu.installedBuild": "Installed build",
    "menu.installedNone": "Installed: none yet. Buy permanent upgrades to shape future runs.",
    "menu.notEnough": "Not enough resources.",
    "menu.upgradeUnavailable": "Upgrade unavailable.",
    "menu.installedToast": (p) => `Installed ${p?.name ?? "upgrade"}: -${p?.cost ?? ""}.`,
    "menu.rewardedBoosterDenied": "Rewarded booster not granted.",
    "menu.rewardedAttemptDenied": "Rewarded attempt not granted.",
    "menu.boosterDisabled": "Boosters are disabled.",
    "menu.noDailyAttempts": "No daily attempts left today.",
    "menu.bestToday": (p) => `Best: W${p?.wave ?? 0}, B${p?.bolts ?? 0}`,
    "menu.bestNone": "Best: -",
    "menu.nextDailyFree": "Next daily: free start.",
    "menu.nextDailyRewarded": "Next daily: rewarded extra attempt.",
    "menu.nextDailyUnavailable": "Next daily: no starts left today.",
    "menu.boostDailyDisabled": "Boosted daily: disabled.",
    "menu.boostDailyFree": "Boosted daily: one rewarded ad for the booster.",
    "menu.boostDailyRewarded": "Boosted daily: one rewarded ad grants the booster and uses the extra attempt.",
    "menu.boostDailyUnavailable": "Boosted daily: unavailable today.",
    "menu.seedLine": (p) => `Seed: ${p?.seed ?? "-"}`,
    "menu.attemptsLine": (p) => `Attempts: ${p?.used ?? 0}/${p?.max ?? 0} | ${p?.best ?? "-"}`,
    "menu.loginRewardLine": (p) =>
      `Login reward: Day ${p?.day ?? 1}/${p?.maxDay ?? 5} ${p?.reward ?? ""} | Next Day ${p?.nextDay ?? 1}: ${p?.nextReward ?? ""}`,
    "settings.gfx": "GFX",
    "settings.sfx": "SFX",
    "settings.music": "MUSIC",
    "settings.language": "LANG",
    "settings.auto": "AUTO",
    "settings.low": "LOW",
    "settings.medium": "MED",
    "settings.high": "HIGH",
    "settings.off": "OFF",
    "toast.graphics": (p) => `Graphics: ${p?.value ?? "AUTO"}`,
    "toast.sfx": (p) => `SFX: ${p?.value ?? "OFF"}`,
    "toast.music": (p) => `Music: ${p?.value ?? "OFF"}`,
    "toast.language": (p) => `Language: ${p?.value ?? "English"}`,
    "toast.loginReward": (p) => `Login reward claimed: Day ${p?.day ?? 1} | ${p?.reward ?? ""}`,
    "toast.noOpsReady": "No liveops rewards ready yet.",
    "toast.opsClaimed": (p) => `Claimed liveops rewards: ${p?.reward ?? ""}`,
    "toast.freeBoostApplied": (p) => `Free boost loaded: ${p?.reward ?? ""}`,
    "toast.weeklyBoardReward": (p) => `Weekly board reward: ${p?.division ?? "Scrapper"} | ${p?.reward ?? ""}`,
    "toast.comebackReady": (p) => `Comeback cache ready after ${p?.days ?? 0} days away.`,
    "toast.pilot": (p) => `Pilot: ${p?.value ?? "AUTO"}`,
    "language.auto": "Auto",
    "language.ru": "Russian",
    "language.en": "English",
    "pause.open": "SET",
    "pause.title": "SETTINGS",
    "pause.hint": "Run paused. Changes apply immediately.",
    "pause.resume": "RESUME",
    "pause.menu": "MENU",
    "results.title": "RUN OVER",
    "results.boost": (p) => `WATCH AD & GET x${p?.mult ?? "2"} WORKSHOP REWARD`,
    "results.restart": "RESTART",
    "results.menu": "MENU",
    "results.stats": (p) =>
      `Wave: ${p?.wave ?? 0}\nBolts: ${p?.bolts ?? 0}\nCores: ${p?.cores ?? 0}\nWorkshop: +${p?.rewardBolts ?? 0} bolts | +${p?.rewardCores ?? 0} cores`,
    "upgrade.title": (p) => `UPGRADE PICK - WAVE ${p?.wave ?? 1}`,
    "upgrade.reroll": "WATCH AD FOR NEW PICKS",
    "hud.hp": "HP",
    "hud.level": "Level",
    "hud.wave": "Wave",
    "hud.bolts": "Bolts",
    "hud.goal": "Goal",
    "results.cores": "Cores",
    "results.workshop": (p) => `Workshop: +${p?.bolts ?? 0} bolts | +${p?.cores ?? 0} cores`,
    "results.pilot": "Pilot",
    "results.division": "Division",
    "results.score": "Score",
    "results.promotion": (p) => `Promotion: ${p?.division ?? "Scrapper"} (${p?.reward ?? ""})`,
    "results.bestDelta": (p) => `Best delta: ${p?.value ?? "+0"}`,
    "results.bestDeltaNone": "First ranked result",
    "results.nextDivision": (p) => `Next division: ${p?.division ?? "Raider"} at ${p?.score ?? "0"}`,
    "results.topDivision": "Top division reached",
    "results.weeklyBoard": (p) => `Weekly board: #${p?.rank ?? 0} | ${p?.division ?? "Scrapper"}`,
    "results.rank": (p) => `Rank: #${p?.rank ?? 0}`,
    "results.newRecord": "New record",
    "results.leaderboardTitle": "Leaderboard",
    "upgrade.levelClear": (p) => `Level ${p?.level ?? 1} clear: ${p?.reward ?? ""}`,
    "upgrade.nextLevel": (p) => `Next level ${p?.level ?? 1}: ${p?.modifier ?? "Unknown"}`,
    "upgrade.objective": (p) => `Bonus objective: ${p?.objective ?? ""}`,
    "upgrade.objectiveDone": (p) => `Completed: ${p?.reward ?? ""}`,
    "upgrade.objectiveMissed": "Missed this time",
    "upgrade.finale": (p) => `Finale: ${p?.finale ?? ""}`,
    "objective.progress": (p) => `Goal: ${p?.title ?? "Goal"} ${p?.progress ?? 0}/${p?.target ?? 0}`,
    "objective.complete": (p) => `Goal complete: ${p?.title ?? "Goal"}`,
    "hud.daily": "Daily",
    "hud.training": "Training",
    "hud.flip": "FLIP",
    "hud.dash": "DASH",
    "tutorial.exit": "EXIT",
    "tutorial.skip": "SKIP",
    "tutorial.trainingLabel": "Training",
    "tutorial.stepLabel": "Step",
    "tutorial.step1": (p) => `Move and collect 3 scrap (${p?.count ?? 0}/3).`,
    "tutorial.step2": "Use FLIP to repel enemies and deflect shots. Base damage comes from shrapnel upgrades.",
    "tutorial.step3": "Bank your tail in the Recycler Zone.",
    "revive.title": "REVIVE?",
    "revive.hint": "Watch a rewarded ad to continue this run.",
    "revive.accept": "WATCH AD & REVIVE",
    "revive.decline": "NO THANKS",
    "wave.upgradePick": "Upgrade pick",
    "wave.trainingLoop": "Training: learn the salvage loop",
    "wave.quickTest": "Quick test wave",
    "wave.breather": "Breather wave: harvest and reset",
    "wave.finale": "Finale",
    "wave.event": "Sector Event",
    "wave.pressure": "Pressure wave",
    "status.shield": (p) => `Shield ${p?.value ?? 0}`,
    "status.clamp": (p) => `Clamp x${p?.value ?? 0}`,
    "status.anchor": (p) => `Anchor ${p?.value ?? 0}s`,
    "status.anchorReady": "Anchor ready",
    "status.vacuum": (p) => `Vacuum ${p?.value ?? 0}s`,
    "status.vacuumReady": "Vacuum ready",
    "status.dashWake": (p) => `Wake ${p?.value ?? 0}s`,
    "status.drone": "Drone online",
    "status.mines": (p) => `Mines ${p?.value ?? 0}`,
    "status.corePull": (p) => `Core pull x${p?.value ?? "1.00"}`,
    "tag.core": "CORE",
    "tag.collection": "HAUL",
    "tag.utility": "UTIL",
    "tag.economy": "ECON",
    "tag.flip": "FLIP",
    "tag.combat": "COMBAT",
    "tag.tail": "TAIL",
    "tag.survival": "SURV",
    "tag.mobility": "MOVE",
    "tag.risk_reward": "RISK",
    "tag.dash": "DASH",
    "tag.ram": "RAM",
    "tag.wake": "WAKE",
    "tag.ion": "ION",
    "tag.siphon": "SIPHON",
    "tag.frame": "FRAME",
    "tag.recycler": "RECYCLE",
    "status.finale": (p) => `Finale ${p?.title ?? ""}`,
    "status.event": (p) => `Event ${p?.title ?? ""}`,
    "leaderboard.filter.all": "ALL",
    "leaderboard.filter.run": "RUN",
    "leaderboard.filter.daily": "DAILY",
    "leaderboard.mode.run": "Run",
    "leaderboard.mode.daily": "Daily",
    "leaderboard.division.scrapper": "Scrapper",
    "leaderboard.division.raider": "Raider",
    "leaderboard.division.ace": "Ace",
    "leaderboard.division.elite": "Elite",
    "leaderboard.division.legend": "Legend",
    "leaderboard.lastRun": "LAST RUN",
    "leaderboard.recordBadge": "NEW RECORD",
    "enemy.chaser": "Chaser",
    "enemy.shooter": "Shooter",
    "enemy.cutter": "Cutter",
    "rarity.common": "COMMON",
    "rarity.uncommon": "UNCOMMON",
    "rarity.rare": "RARE",
    "rarity.epic": "EPIC",
  },
  ru: {
    "app.title": "Magnet Caravan",
    "menu.workshop": "МАСТЕРСКАЯ",
    "menu.play": "ИГРАТЬ",
    "menu.playBoost": "ИГРАТЬ + БУСТ (за рекламу)",
    "menu.training": "ОБУЧЕНИЕ",
    "menu.daily": "ЕЖЕДНЕВКА",
    "menu.dailyFree": "ЕЖЕДНЕВКА (бесплатно)",
    "menu.dailyRewarded": "ЕЖЕДНЕВКА (за рекламу)",
    "menu.dailyLocked": "ЕЖЕДНЕВКА (закрыта)",
    "menu.dailyBoost": "ЕЖЕДНЕВКА + БУСТ",
    "menu.dailyBoostExtra": "ЕЖЕДНЕВКА + БУСТ (доп. попытка)",
    "menu.dailyBoostLocked": "ЕЖЕДНЕВКА + БУСТ (закрыта)",
    "menu.playFreeBoost": (p) => `ИГРАТЬ + БЕСПЛАТНЫЙ БУСТ (${p?.usesLeft ?? 0} ост.)`,
    "menu.rotationLine": (p) => `Ротация: ${p?.badge ?? "Событие"} | ${p?.title ?? "Дневная ротация"}`,
    "menu.streakLine": (p) => `Стрик, день ${p?.day ?? 1}: ${p?.reward ?? ""} | ${p?.status ?? ""}`,
    "menu.claimReady": "можно забрать",
    "menu.claimedToday": "уже забрано",
    "menu.missionsLine": (p) =>
      `Миссии: дневные ${p?.dailyDone ?? 0}/${p?.dailyTotal ?? 0} | недельные ${p?.weeklyDone ?? 0}/${p?.weeklyTotal ?? 0} | готово ${p?.ready ?? 0}`,
    "menu.comebackLine": (p) => `Камбэк: пауза ${p?.days ?? 0} дн. | ${p?.reward ?? ""}`,
    "menu.tomorrowOfferLine": (p) => `Завтра: ${p?.title ?? "Бонус двора"} | ${p?.reward ?? ""}`,
    "menu.claimOpsReady": (p) => `ЗАБРАТЬ НАГРАДЫ (${p?.count ?? 0})`,
    "menu.claimOpsIdle": "НЕТ ГОТОВЫХ НАГРАД",
    "menu.claimAction": "ЗАБРАТЬ",
    "menu.missions": "МИССИИ",
    "menu.boostToggle": "БУСТ ЗА РЕКЛАМУ",
    "menu.boostToggleHint": "Для Играть и Ежедневки",
    "menu.summaryRewards": "НАГРАДЫ",
    "menu.summaryDaily": "ДЕЙЛИК",
    "menu.summaryWeekly": "НЕДЕЛЯ",
    "menu.utilityHint": "Быстрые ссылки и настройки",
    "menu.tagline": "Переверни поле. Сдай лом. Переживи натиск.",
    "menu.heroLead": "Веди магнитный тягач сквозь штормы лома и корми переработчик, пока рой не сомкнулся.",
    "menu.controls": "WASD/Стрелки: движение | Пробел: флип | Shift: рывок",
    "menu.stageHint.starter": "Начни заезд, собери лом и сдай его в переработчик.",
    "menu.stageHint.growing": "Сыграй заезд, затем вложись в одно полезное улучшение.",
    "menu.stageHint.advanced": "Настраивай сборку, поднимайся в рейтинге и усиливай цикл добычи.",
    "menu.best": (p) => `Лучшая волна: ${p?.bestWave ?? 0} | Лучшие болты: ${p?.bestBolts ?? 0}`,
    "menu.wallet": (p) => `Кошелёк: ${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.walletCompact": (p) => `${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.stockpile": (p) => `Запас: ${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.stockpileCompact": (p) => `${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.workshopHint": "Постоянные улучшения действуют во всех будущих заездах.",
    "menu.workshopFooter": "Покупай улучшения за собранные болты и редкие ядра.",
    "menu.workshopVisibleCount": (p) => `Видимые улучшения: ${p?.visible ?? 0}/${p?.total ?? 0}`,
    "menu.workshopUnlockLaterStarter": "Новые системы мастерской откроются после нескольких заездов.",
    "menu.workshopUnlockLaterGrowing": "Новые системы мастерской открываются по мере прогресса.",
    "menu.workshopCompactViewport": "В компактном виде сначала показываем лучшие следующие апгрейды.",
    "menu.workshopRecommendation": (p) => `Лучший следующий шаг: ${p?.name ?? "Улучшение"}`,
    "menu.workshopRecommendationDone": "Все видимые улучшения уже установлены.",
    "menu.recommendedBadge": "СОВЕТ",
    "menu.close": "ЗАКРЫТЬ",
    "menu.level": (p) => `Уровень ${p?.level ?? 0}/${p?.maxLevel ?? 0}`,
    "menu.buy": "КУПИТЬ",
    "menu.locked": "НЕТ СРЕДСТВ",
    "menu.installedButton": "УСТАНОВЛЕНО",
    "menu.maxed": "МАКС.",
    "menu.installedList": (p) => `Установлено: ${p?.items ?? ""}`,
    "menu.installedBuild": "Установленная сборка",
    "menu.installedNone": "Установлено: пока ничего. Постоянные улучшения задают стиль будущих заездов.",
    "menu.notEnough": "Не хватает ресурсов.",
    "menu.upgradeUnavailable": "Улучшение недоступно.",
    "menu.installedToast": (p) => `Установлено: ${p?.name ?? "улучшение"} (-${p?.cost ?? ""}).`,
    "menu.rewardedBoosterDenied": "Буст за рекламу не получен.",
    "menu.rewardedAttemptDenied": "Доп. попытка за рекламу не получена.",
    "menu.boosterDisabled": "Бусты отключены.",
    "menu.noDailyAttempts": "На сегодня попытки закончились.",
    "menu.bestToday": (p) => `Лучшее: В${p?.wave ?? 0}, Б${p?.bolts ?? 0}`,
    "menu.bestNone": "Лучшее: -",
    "menu.nextDailyFree": "Следующий дейлик: бесплатный старт.",
    "menu.nextDailyRewarded": "Следующий дейлик: дополнительная попытка за рекламу.",
    "menu.nextDailyUnavailable": "Следующий дейлик: стартов на сегодня больше нет.",
    "menu.boostDailyDisabled": "Буст-дейлик: отключён.",
    "menu.boostDailyFree": "Буст-дейлик: одна реклама даст стартовый буст.",
    "menu.boostDailyRewarded": "Буст-дейлик: одна реклама даст буст и израсходует доп. попытку.",
    "menu.boostDailyUnavailable": "Буст-дейлик: сегодня недоступен.",
    "menu.seedLine": (p) => `Сид: ${p?.seed ?? "-"}`,
    "menu.attemptsLine": (p) => `Попытки: ${p?.used ?? 0}/${p?.max ?? 0} | ${p?.best ?? "-"}`,
    "menu.loginRewardLine": (p) =>
      `Награда за вход: день ${p?.day ?? 1}/${p?.maxDay ?? 5} ${p?.reward ?? ""} | Следующий день ${p?.nextDay ?? 1}: ${p?.nextReward ?? ""}`,
    "settings.gfx": "ГРАФИКА",
    "settings.sfx": "ЭФФЕКТЫ",
    "settings.music": "МУЗЫКА",
    "settings.language": "ЯЗЫК",
    "settings.auto": "АВТО",
    "settings.low": "НИЗК.",
    "settings.medium": "СРЕД.",
    "settings.high": "ВЫС.",
    "settings.off": "ВЫКЛ",
    "toast.graphics": (p) => `Графика: ${p?.value ?? "АВТО"}`,
    "toast.sfx": (p) => `Эффекты: ${p?.value ?? "ВЫКЛ"}`,
    "toast.music": (p) => `Музыка: ${p?.value ?? "ВЫКЛ"}`,
    "toast.language": (p) => `Язык: ${p?.value ?? "Русский"}`,
    "toast.loginReward": (p) => `Награда за вход: день ${p?.day ?? 1} | ${p?.reward ?? ""}`,
    "toast.noOpsReady": "Пока нечего забирать из заданий.",
    "toast.opsClaimed": (p) => `Награды за задания получены: ${p?.reward ?? ""}`,
    "toast.freeBoostApplied": (p) => `Бесплатный буст загружен: ${p?.reward ?? ""}`,
    "toast.weeklyBoardReward": (p) => `Награда недельного рейтинга: ${p?.division ?? "Старатель"} | ${p?.reward ?? ""}`,
    "toast.comebackReady": (p) => `Камбэк-кеш готов: пауза ${p?.days ?? 0} дн.`,
    "language.auto": "Авто",
    "language.ru": "Русский",
    "language.en": "Английский",
    "pause.open": "НАСТР.",
    "pause.title": "НАСТРОЙКИ",
    "pause.hint": "Заезд поставлен на паузу. Изменения применяются сразу.",
    "pause.resume": "ПРОДОЛЖИТЬ",
    "pause.menu": "В МЕНЮ",
    "results.title": "ЗАЕЗД ОКОНЧЕН",
    "results.boost": (p) => `СМОТРЕТЬ РЕКЛАМУ И ПОЛУЧИТЬ x${p?.mult ?? "2"} НАГРАДУ`,
    "results.restart": "ЗАНОВО",
    "results.menu": "МЕНЮ",
    "results.stats": (p) =>
      `Волна: ${p?.wave ?? 0}\nБолты: ${p?.bolts ?? 0}\nЯдра: ${p?.cores ?? 0}\nМастерская: +${p?.rewardBolts ?? 0} болтов | +${p?.rewardCores ?? 0} ядер`,
    "upgrade.title": (p) => `ВЫБОР УЛУЧШЕНИЯ - ВОЛНА ${p?.wave ?? 1}`,
    "upgrade.reroll": "СМОТРЕТЬ РЕКЛАМУ И ОБНОВИТЬ ВЫБОР",
    "hud.hp": "HP",
    "hud.level": "\u0423\u0440\u043e\u0432\u0435\u043d\u044c",
    "hud.wave": "Волна",
    "hud.bolts": "Болты",
    "hud.goal": "\u0426\u0435\u043b\u044c",
    "results.cores": "\u042f\u0434\u0440\u0430",
    "results.workshop": (p) => `\u041c\u0430\u0441\u0442\u0435\u0440\u0441\u043a\u0430\u044f: +${p?.bolts ?? 0} \u0431\u043e\u043b\u0442\u043e\u0432 | +${p?.cores ?? 0} \u044f\u0434\u0435\u0440`,
    "upgrade.levelClear": (p) => `\u0423\u0440\u043e\u0432\u0435\u043d\u044c ${p?.level ?? 1} \u0437\u0430\u0447\u0438\u0449\u0435\u043d: ${p?.reward ?? ""}`,
    "upgrade.nextLevel": (p) => `\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c ${p?.level ?? 1}: ${p?.modifier ?? "?"}`,
    "upgrade.objective": (p) => `\u0411\u043e\u043d\u0443\u0441-\u0446\u0435\u043b\u044c: ${p?.objective ?? ""}`,
    "upgrade.objectiveDone": (p) => `\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e: ${p?.reward ?? ""}`,
    "upgrade.objectiveMissed": "\u0412 \u044d\u0442\u043e\u0442 \u0440\u0430\u0437 \u043d\u0435 \u0437\u0430\u0448\u043b\u043e",
    "objective.progress": (p) => `\u0426\u0435\u043b\u044c: ${p?.title ?? "\u0426\u0435\u043b\u044c"} ${p?.progress ?? 0}/${p?.target ?? 0}`,
    "objective.complete": (p) => `\u0426\u0435\u043b\u044c \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0430: ${p?.title ?? "\u0426\u0435\u043b\u044c"}`,
    "hud.daily": "Ежедневка",
    "hud.training": "Обучение",
    "hud.flip": "ФЛИП",
    "hud.dash": "РЫВОК",
    "tutorial.exit": "ВЫЙТИ",
    "tutorial.skip": "ПРОПУСТИТЬ",
    "tutorial.trainingLabel": "Обучение",
    "tutorial.stepLabel": "Шаг",
    "tutorial.step1": (p) => `Двигайся и собери 3 куска лома (${p?.count ?? 0}/3).`,
    "tutorial.step2": "Используй ФЛИП, чтобы отталкивать врагов и отбивать выстрелы. Базовый урон появляется через осколочные апгрейды.",
    "tutorial.step3": "Сдай хвост в зону переработчика.",
    "revive.title": "ПРОДОЛЖИТЬ?",
    "revive.hint": "Посмотри рекламу, чтобы продолжить этот заезд.",
    "revive.accept": "СМОТРЕТЬ РЕКЛАМУ И ВЕРНУТЬСЯ",
    "revive.decline": "НЕТ, СПАСИБО",
    "wave.upgradePick": "Выбор улучшения",
    "wave.trainingLoop": "Обучение: освой цикл сбора и сдачи",
    "wave.quickTest": "Быстрая тестовая волна",
    "wave.breather": "Передышка: собери лом и перезайди в темп",
    "wave.pressure": "Волна давления",
    "status.shield": (p) => `Щит ${p?.value ?? 0}`,
    "status.clamp": (p) => `Зажим x${p?.value ?? 0}`,
    "status.anchor": (p) => `Якорь ${p?.value ?? 0}с`,
    "status.anchorReady": "Якорь готов",
    "status.vacuum": (p) => `Вакуум ${p?.value ?? 0}с`,
    "status.vacuumReady": "Вакуум готов",
    "status.dashWake": (p) => `Шлейф ${p?.value ?? 0}с`,
    "status.drone": "Дрон в строю",
    "status.mines": (p) => `Мины ${p?.value ?? 0}`,
    "status.corePull": (p) => `Тяга ядра x${p?.value ?? "1.00"}`,
    "tag.core": "ЯДРО",
    "tag.collection": "СБОР",
    "tag.utility": "УТИЛ",
    "tag.economy": "ЭКО",
    "tag.flip": "ФЛИП",
    "tag.combat": "БОЙ",
    "tag.tail": "ХВОСТ",
    "tag.survival": "ЩИТ",
    "tag.mobility": "ДВИЖ",
    "tag.risk_reward": "РИСК",
    "tag.dash": "РЫВОК",
    "tag.ram": "ТАРАН",
    "tag.wake": "ШЛЕЙФ",
    "tag.ion": "ИОН",
    "tag.siphon": "СИФОН",
    "tag.frame": "КОРПУС",
    "tag.recycler": "ПЕРЕРАБ",
    "enemy.chaser": "Таран",
    "enemy.shooter": "Стрелок",
    "enemy.cutter": "Резчик",
    "rarity.common": "ОБЫЧНОЕ",
    "rarity.uncommon": "НЕОБЫЧНОЕ",
    "rarity.rare": "РЕДКОЕ",
    "rarity.epic": "ЭПИЧЕСКОЕ",
  },
};

Object.assign(MESSAGES.en, {
  "menu.liveopsTitle": "MISSION BOARD",
  "menu.dailyMissionsTitle": "TODAY",
  "menu.weeklyMissionsTitle": "THIS WEEK",
  "menu.readyBadge": (p?: Record<string, unknown>) => `READY ${p?.count ?? 0}`,
  "menu.missionReady": "READY",
  "menu.missionClaimed": "CLAIMED",
  "menu.missionProgress": "IN PROGRESS",
  "menu.mission.reach_wave": (p?: Record<string, unknown>) => `Wave ${p?.target ?? 0}`,
  "menu.mission.bank_bolts": (p?: Record<string, unknown>) => `Bank ${p?.target ?? 0} bolts`,
  "menu.mission.collect_heavy_scrap": (p?: Record<string, unknown>) => `Heavy scrap ${p?.target ?? 0}`,
  "menu.mission.deflect_projectiles": (p?: Record<string, unknown>) => `Deflect ${p?.target ?? 0} shots`,
  "menu.mission.use_flip": (p?: Record<string, unknown>) => `Use FLIP ${p?.target ?? 0}x`,
  "menu.mission.complete_runs": (p?: Record<string, unknown>) => `Runs ${p?.target ?? 0}`,
  "menu.mission.score_points": (p?: Record<string, unknown>) => `Score ${p?.target ?? 0}`,
  "menu.mission.gain_bolts": (p?: Record<string, unknown>) => `Gain ${p?.target ?? 0} bolts`,
  "menu.careerMilestonesTitle": "Career badges",
  "menu.careerUnlocked": "Unlocked",
  "menu.careerNewBadge": "NEW",
  "menu.leaderboardMilestoneUnlock": (p?: Record<string, unknown>) =>
    `Career badge unlocked: ${p?.titles ?? ""} | ${p?.reward ?? ""}`,
  "menu.leaderboardCareerStatus": (p?: Record<string, unknown>) =>
    `Career badges ${p?.count ?? 0}/${p?.total ?? 0}. Next: ${p?.title ?? "Unknown"}`,
  "menu.leaderboardCareerComplete": (p?: Record<string, unknown>) =>
    `Career badges ${p?.count ?? 0}/${p?.total ?? 0}. Full set unlocked.`,
  "results.milestoneUnlock": (p?: Record<string, unknown>) =>
    `Career badge unlocked: ${p?.titles ?? ""} (${p?.reward ?? ""})`,
  "results.nextMilestone": (p?: Record<string, unknown>) => `Next badge: ${p?.title ?? "Unknown"}`,
  "results.allMilestones": "All career badges unlocked",
  "results.weeklyDeltaUp": (p?: Record<string, unknown>) => `Weekly climb: +${p?.value ?? 0}`,
  "results.weeklyDeltaDown": (p?: Record<string, unknown>) => `Weekly slide: ${p?.value ?? 0}`,
  "results.weeklyDeltaNew": "Weekly board debut",
  "menu.dailySummaryTitle": "TODAY'S DAILY",
  "menu.weeklyRaceTitle": "WEEKLY RACE",
  "menu.weeklyRaceEntry": "Post a run to enter weekly",
  "menu.weeklyRaceRankLine": (p?: Record<string, unknown>) =>
    `Weekly #${p?.rank ?? 0} | ${p?.division ?? "Scrapper"} | ${p?.score ?? "0"}`,
  "menu.weeklyRaceBestLine": (p?: Record<string, unknown>) =>
    `Best this week | ${p?.division ?? "Scrapper"} | ${p?.score ?? "0"}`,
  "menu.weeklyRaceTargetLine": (p?: Record<string, unknown>) =>
    `Next ${p?.division ?? "Raider"} in ${p?.remaining ?? "0"} | goal ${p?.score ?? "0"}`,
  "menu.weeklyRaceTopLine": "Top division secured",
  "menu.weeklyRaceLaunchLine": (p?: Record<string, unknown>) =>
    `First step ${p?.division ?? "Raider"} at ${p?.score ?? "0"}`,
  "menu.weeklyRaceHotLine": (p?: Record<string, unknown>) =>
    `One strong run to ${p?.division ?? "Raider"} | ${p?.remaining ?? "0"}`,
  "menu.rewardedPlayCta": (p?: Record<string, unknown>) => `WATCH AD\nPLAY: ${p?.reward ?? ""}`,
  "menu.rewardedDailyCta": (p?: Record<string, unknown>) => `WATCH AD\nDAILY: ${p?.reward ?? ""}`,
  "menu.startBoosterToggleTitle": "START BOOST FOR AD",
  "menu.startBoosterToggleHint": (p?: Record<string, unknown>) => `Reward for Play and Daily: ${p?.reward ?? ""}`,
  "menu.startBoosterToggleHintCompact": (p?: Record<string, unknown>) => `Reward: ${p?.reward ?? ""}`,
  "menu.liveopsRotationFallback": "Rotation",
  "menu.liveopsHeadlineComeback": (p?: Record<string, unknown>) => `Comeback ${p?.days ?? 0}d | ${p?.reward ?? ""}`,
  "menu.liveopsHeadlineRotation": (p?: Record<string, unknown>) =>
    `${p?.badge ?? "Rotation"} | ${p?.title ?? "Rotation"}`,
  "menu.liveopsHeadlineTomorrow": (p?: Record<string, unknown>) => `Tomorrow | ${p?.title ?? "Next"}`,
  "menu.liveopsStatusLine": (p?: Record<string, unknown>) =>
    `Streak ${p?.day ?? "0"} ${p?.streakState ?? "READY"} | ready ${p?.ready ?? "0"} | d ${p?.daily ?? "0/0"} | w ${p?.weekly ?? "0/0"}`,
  "menu.dailyLoginLine": (p?: Record<string, unknown>) => `Login ${p?.day ?? "0"}/${p?.max ?? "0"} | ${p?.reward ?? ""}`,
  "menu.dailyStartState.free": "start free",
  "menu.dailyStartState.rewarded": "start ad",
  "menu.dailyStartState.locked": "start locked",
  "menu.dailyStatusLine": (p?: Record<string, unknown>) =>
    `Attempts ${p?.used ?? "0"}/${p?.max ?? "0"} | ${p?.best ?? ""} | ${p?.next ?? ""}`,
  "menu.rewardsReadySummary": (p?: Record<string, unknown>) => `Ready ${p?.count ?? 0}`,
  "menu.rewardsQuietSummary": "Quiet for now",
  "menu.progressSummary": (p?: Record<string, unknown>) => `${p?.done ?? "0"}/${p?.total ?? "0"} complete`,
  "menu.weeklyRaceRiskTopSafe": "TOP SAFE",
  "menu.weeklyRaceRiskBurns": (p?: Record<string, unknown>) => `BURNS +${p?.reward ?? ""}`,
  "menu.weeklyRaceRiskEntry": (p?: Record<string, unknown>) => `ENTRY ${p?.reward ?? ""}`,
  "menu.weeklyRaceRiskHoldPayout": "HOLD PAYOUT",
  "menu.weeklyRaceNoRewardCompact": "0",
  "menu.weeklyRaceHeldRewardBadge": (p?: Record<string, unknown>) => `RESET ${p?.reward ?? "0"}`,
  "menu.weeklyRaceState.enter": "ENTER",
  "menu.weeklyRaceState.climbing": "RACING",
  "menu.weeklyRaceState.payout": "PAYOUT",
  "menu.weeklyRaceState.near_promo": "NEAR PROMO",
  "menu.weeklyRaceState.hot_run": "HOT RUN",
  "menu.weeklyRaceState.top": "TOP",
  "menu.weeklyRaceJumpDebut": (p?: Record<string, unknown>) => `NEW #${p?.rank ?? 0}`,
  "menu.weeklyRaceProgressLabel": (p?: Record<string, unknown>) => `${p?.percent ?? 0}% to ${p?.division ?? "Raider"}`,
  "menu.weeklyRaceHotProgressLabel": (p?: Record<string, unknown>) => `PUSH TO ${p?.division ?? "Raider"}`,
  "menu.weeklyRaceResetDays": (p?: Record<string, unknown>) => `RESET ${p?.days ?? 0}D ${p?.hours ?? 0}H`,
  "menu.weeklyRaceResetHours": (p?: Record<string, unknown>) => `RESET ${p?.hours ?? 0}H`,
  "menu.weeklyRaceResetMinutes": (p?: Record<string, unknown>) => `RESET ${p?.minutes ?? 0}M`,
  "menu.weeklyRaceTopDivision": "TOP DIVISION",
  "menu.portalBoardsTitle": "PORTAL BOARDS",
  "menu.portalBoardsLoading": "Loading portal boards...",
  "menu.portalBoardsUnavailable": "Portal boards unavailable",
  "menu.portalBoardsUnranked": "Unranked",
  "menu.portalBoardsFallback": "Local fallback",
  "menu.portalBoardsTop": "Top division",
  "menu.portalBoard.daily": "Daily",
  "menu.portalBoard.weekly": "Weekly",
  "menu.portalBoard.all_time": "All-Time",
  "menu.rewardBoltsCompact": (p?: Record<string, unknown>) => `${p?.value ?? 0}B`,
  "menu.rewardCoresCompact": (p?: Record<string, unknown>) => `${p?.value ?? 0}C`,
  "menu.rewardTailCompact": (p?: Record<string, unknown>) => `+${p?.value ?? 0} tail`,
  "menu.rewardTailLong": (p?: Record<string, unknown>) => `+${p?.value ?? 0} tail segments`,
  "menu.rewardBoltsShort": (p?: Record<string, unknown>) => `+${p?.value ?? 0} bolts`,
  "menu.rewardCoresShort": (p?: Record<string, unknown>) => `+${p?.value ?? 0} cores`,
  "menu.rewardNone": "no bonus",
  "menu.installedLevelShort": "Lv.",
  "leaderboard.milestone.score_25000": "Quartermaster 25K",
  "leaderboard.milestone.wave_20": "Frontline 20",
  "leaderboard.milestone.salvage_400": "Scrap Baron",
  "leaderboard.milestone.legend_league": "Legend League",
});

Object.assign(MESSAGES.ru, {
  "menu.liveopsTitle": "\u0414\u041e\u0421\u041a\u0410 \u0417\u0410\u0414\u0410\u041d\u0418\u0419",
  "menu.dailyMissionsTitle": "\u0421\u0415\u0413\u041e\u0414\u041d\u042f",
  "menu.weeklyMissionsTitle": "\u041d\u0410 \u042d\u0422\u0423 \u041d\u0415\u0414\u0415\u041b\u042e",
  "menu.readyBadge": (p?: Record<string, unknown>) => `\u0413\u041e\u0422\u041e\u0412\u041e ${p?.count ?? 0}`,
  "menu.missionReady": "\u0413\u041e\u0422\u041e\u0412\u041e",
  "menu.missionClaimed": "\u0417\u0410\u0411\u0420\u0410\u041d\u041e",
  "menu.missionProgress": "\u0412 \u041f\u0420\u041e\u0426\u0415\u0421\u0421\u0415",
  "menu.mission.reach_wave": (p?: Record<string, unknown>) => `\u0412\u043e\u043b\u043d\u0430 ${p?.target ?? 0}`,
  "menu.mission.bank_bolts": (p?: Record<string, unknown>) => `\u0421\u0434\u0430\u0439 ${p?.target ?? 0} \u0431\u043e\u043b\u0442.`,
  "menu.mission.collect_heavy_scrap": (p?: Record<string, unknown>) => `\u0422\u044f\u0436. \u043b\u043e\u043c ${p?.target ?? 0}`,
  "menu.mission.deflect_projectiles": (p?: Record<string, unknown>) => `\u041e\u0442\u0431\u0435\u0439 ${p?.target ?? 0} \u0432\u044b\u0441\u0442\u0440.`,
  "menu.mission.use_flip": (p?: Record<string, unknown>) => `\u0424\u041b\u0418\u041f x${p?.target ?? 0}`,
  "menu.mission.complete_runs": (p?: Record<string, unknown>) => `\u0417\u0430\u0435\u0437\u0434\u043e\u0432 ${p?.target ?? 0}`,
  "menu.mission.score_points": (p?: Record<string, unknown>) => `\u041e\u0447\u043a\u0438 ${p?.target ?? 0}`,
  "menu.mission.gain_bolts": (p?: Record<string, unknown>) => `\u0411\u043e\u043b\u0442\u044b ${p?.target ?? 0}`,
  "menu.pilotButton": (p?: Record<string, unknown>) => `\u041f\u0438\u043b\u043e\u0442: ${p?.name ?? "\u0410\u0412\u0422\u041e"}`,
  "menu.pilotAuto": "\u0410\u0412\u0422\u041e",
  "menu.pilotPrompt":
    "\u0417\u0430\u0434\u0430\u0439 \u043f\u043e\u0437\u044b\u0432\u043d\u043e\u0439 \u043f\u0438\u043b\u043e\u0442\u0430. \u041e\u0441\u0442\u0430\u0432\u044c \u043f\u0443\u0441\u0442\u043e, \u0447\u0442\u043e\u0431\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c \u0430\u0432\u0442\u043e-\u043f\u043e\u0437\u044b\u0432\u043d\u043e\u0439.",
  "menu.pilotUnsupported": "\u0412 \u044d\u0442\u043e\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043d\u0435\u043b\u044c\u0437\u044f \u043f\u0435\u0440\u0435\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u0442\u044c \u043f\u0438\u043b\u043e\u0442\u0430.",
  "menu.leaderboard": "\u0420\u0415\u0419\u0422\u0418\u041d\u0413",
  "menu.leaderboardTitle": "\u0422\u043e\u043f \u043f\u0438\u043b\u043e\u0442\u043e\u0432",
  "menu.leaderboardEmpty": "\u0412 \u0437\u0430\u043b\u0435 \u0441\u043b\u0430\u0432\u044b \u043f\u043e\u043a\u0430 \u043f\u0443\u0441\u0442\u043e.",
  "menu.leaderboardHint": (p?: Record<string, unknown>) =>
    `\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b: ${p?.mode ?? "\u0412\u0421\u0415"}. \u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0438\u043b\u043e\u0442: ${p?.pilot ?? "\u0410\u0412\u0422\u041e"}. \u041e\u0447\u043a\u0438 \u0446\u0435\u043d\u044f\u0442 \u0433\u043b\u0443\u0431\u0438\u043d\u0443 \u0437\u0430\u0435\u0437\u0434\u0430, \u0431\u043e\u043b\u0442\u044b, \u044f\u0434\u0440\u0430 \u0438 \u0434\u043b\u0438\u043d\u0443 \u043a\u0430\u0440\u0430\u0432\u0430\u043d\u0430.`,
  "menu.leaderboardScoring":
    "\u0421\u0447\u0451\u0442 \u0432 \u043f\u0435\u0440\u0432\u0443\u044e \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u043d\u0430\u0433\u0440\u0430\u0436\u0434\u0430\u0435\u0442 \u0434\u0430\u043b\u044c\u043d\u0438\u0439 \u0437\u0430\u0435\u0437\u0434, \u0437\u0430\u0442\u0435\u043c \u0431\u043e\u043b\u0442\u044b, \u044f\u0434\u0440\u0430 \u0438 \u0434\u043b\u0438\u043d\u0443 \u0445\u0432\u043e\u0441\u0442\u0430.",
  "menu.leaderboardLatest": (p?: Record<string, unknown>) =>
    `\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442: #${p?.rank ?? 0} \u0432 \u0442\u0430\u0431\u043b\u0438\u0446\u0435 ${p?.mode ?? "\u0412\u0421\u0415"}.`,
  "menu.leaderboardRecord": (p?: Record<string, unknown>) =>
    `\u041d\u043e\u0432\u044b\u0439 \u0440\u0435\u043a\u043e\u0440\u0434: #${p?.rank ?? 0} \u0432 \u0442\u0430\u0431\u043b\u0438\u0446\u0435 ${p?.mode ?? "\u0412\u0421\u0415"}.`,
  "menu.leaderboardPromotion": (p?: Record<string, unknown>) =>
    `\u041f\u043e\u0432\u044b\u0448\u0435\u043d\u0438\u0435 \u043b\u0438\u0433\u0438: ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} | ${p?.reward ?? ""}`,
  "menu.leaderboardLeaderLine": (p?: Record<string, unknown>) =>
    `\u041b\u0438\u0434\u0435\u0440: ${p?.pilot ?? "\u0410\u0412\u0422\u041e"} | ${p?.score ?? "0"}`,
  "menu.leaderboardRivalLine": (p?: Record<string, unknown>) =>
    `\u0421\u043b\u0435\u0434\u043e\u043c: ${p?.pilot ?? "\u0410\u0412\u0422\u041e"} | ${p?.score ?? "0"}`,
  "menu.careerMilestonesTitle": "\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0435 \u0431\u0435\u0439\u0434\u0436\u0438",
  "menu.careerUnlocked": "\u041e\u0442\u043a\u0440\u044b\u0442",
  "menu.careerNewBadge": "\u041d\u041e\u0412\u041e\u0415",
  "menu.leaderboardMilestoneUnlock": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0439 \u0431\u0435\u0439\u0434\u0436: ${p?.titles ?? ""} | ${p?.reward ?? ""}`,
  "menu.leaderboardCareerNext": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u0430\u044f \u043b\u0438\u0433\u0430: ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} | \u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f ${p?.nextDivision ?? "\u0420\u0435\u0439\u0434\u0435\u0440"} \u043d\u0430 ${p?.score ?? "0"}`,
  "menu.leaderboardCareerTop": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u0430\u044f \u043b\u0438\u0433\u0430: ${p?.division ?? "\u041b\u0435\u0433\u0435\u043d\u0434\u0430"} | \u0412\u0435\u0440\u0445\u043d\u044f\u044f \u043b\u0438\u0433\u0430 \u0432\u0437\u044f\u0442\u0430`,
  "menu.leaderboardLeagueLine": (p?: Record<string, unknown>) =>
    `\u041b\u0438\u0433\u0430: ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} | \u0421\u043b\u0435\u0434. ${p?.nextDivision ?? "\u0420\u0435\u0439\u0434\u0435\u0440"} \u043d\u0430 ${p?.score ?? "0"}`,
  "menu.leaderboardLeagueTop": (p?: Record<string, unknown>) =>
    `\u041b\u0438\u0433\u0430: ${p?.division ?? "\u041b\u0435\u0433\u0435\u043d\u0434\u0430"} | \u0412\u0435\u0440\u0445\u043d\u044f\u044f \u043b\u0438\u0433\u0430`,
  "menu.leaderboardCareerStatus": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0435 \u0431\u0435\u0439\u0434\u0436\u0438 ${p?.count ?? 0}/${p?.total ?? 0}. \u0414\u0430\u043b\u044c\u0448\u0435: ${p?.title ?? "?"}`,
  "menu.leaderboardCareerComplete": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0435 \u0431\u0435\u0439\u0434\u0436\u0438 ${p?.count ?? 0}/${p?.total ?? 0}. \u0412\u0441\u044f \u043a\u043e\u043b\u043b\u0435\u043a\u0446\u0438\u044f \u0441\u043e\u0431\u0440\u0430\u043d\u0430.`,
  "toast.pilot": (p?: Record<string, unknown>) => `\u041f\u0438\u043b\u043e\u0442: ${p?.value ?? "\u0410\u0412\u0422\u041e"}`,
  "results.pilot": "\u041f\u0438\u043b\u043e\u0442",
  "results.division": "\u041b\u0438\u0433\u0430",
  "results.score": "\u041e\u0447\u043a\u0438",
  "results.promotion": (p?: Record<string, unknown>) => `\u041f\u043e\u0432\u044b\u0448\u0435\u043d\u0438\u0435: ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} (${p?.reward ?? ""})`,
  "results.milestoneUnlock": (p?: Record<string, unknown>) =>
    `\u041a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0439 \u0431\u0435\u0439\u0434\u0436: ${p?.titles ?? ""} (${p?.reward ?? ""})`,
  "results.bestDelta": (p?: Record<string, unknown>) => `\u0414\u0435\u043b\u044c\u0442\u0430 \u043a \u043b\u0443\u0447\u0448\u0435\u043c\u0443: ${p?.value ?? "+0"}`,
  "results.bestDeltaNone": "\u041f\u0435\u0440\u0432\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u043e\u0432\u044b\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442",
  "results.nextDivision": (p?: Record<string, unknown>) =>
    `\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u043b\u0438\u0433\u0430: ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"} \u043d\u0430 ${p?.score ?? "0"}`,
  "results.topDivision": "\u0414\u043e\u0441\u0442\u0438\u0433\u043d\u0443\u0442\u0430 \u0432\u0435\u0440\u0445\u043d\u044f\u044f \u043b\u0438\u0433\u0430",
  "results.weeklyBoard": (p?: Record<string, unknown>) =>
    `\u041d\u0435\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433: #${p?.rank ?? 0} | ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"}`,
  "results.weeklyDeltaUp": (p?: Record<string, unknown>) =>
    `\u041f\u043e\u0434\u044a\u0451\u043c \u0432 \u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0435: +${p?.value ?? 0}`,
  "results.weeklyDeltaDown": (p?: Record<string, unknown>) =>
    `\u041f\u0440\u043e\u0441\u0430\u0434\u043a\u0430 \u0432 \u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0435: ${p?.value ?? 0}`,
  "results.weeklyDeltaNew": "\u0414\u0435\u0431\u044e\u0442 \u0432 \u043d\u0435\u0434\u0435\u043b\u044c\u043d\u043e\u043c \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0435",
  "menu.dailySummaryTitle": "\u0414\u0415\u0419\u041b\u0418\u041a \u0421\u0415\u0413\u041e\u0414\u041d\u042f",
  "menu.weeklyRaceTitle": "\u041d\u0415\u0414\u0415\u041b\u042c\u041d\u0410\u042f \u0413\u041e\u041d\u041a\u0410",
  "menu.weeklyRaceEntry": "\u0421\u0434\u0435\u043b\u0430\u0439 \u0437\u0430\u0435\u0437\u0434 \u0438 \u0432\u043e\u0439\u0434\u0438 \u0432 \u043d\u0435\u0434\u0435\u043b\u044c\u043d\u044b\u0439 \u0440\u0435\u0439\u0442\u0438\u043d\u0433",
  "menu.weeklyRaceRankLine": (p?: Record<string, unknown>) =>
    `\u041c\u0435\u0441\u0442\u043e #${p?.rank ?? 0} | ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} | ${p?.score ?? "0"}`,
  "menu.weeklyRaceBestLine": (p?: Record<string, unknown>) =>
    `\u041b\u0443\u0447\u0448\u0438\u0439 \u0437\u0430 \u043d\u0435\u0434\u0435\u043b\u044e | ${p?.division ?? "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c"} | ${p?.score ?? "0"}`,
  "menu.weeklyRaceTargetLine": (p?: Record<string, unknown>) =>
    `\u0414\u043e ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"}: ${p?.remaining ?? "0"} | \u0446\u0435\u043b\u044c ${p?.score ?? "0"}`,
  "menu.weeklyRaceTopLine": "\u0412\u0435\u0440\u0445\u043d\u044f\u044f \u043b\u0438\u0433\u0430 \u0443\u0436\u0435 \u0432\u0437\u044f\u0442\u0430",
  "menu.weeklyRaceLaunchLine": (p?: Record<string, unknown>) =>
    `\u041f\u0435\u0440\u0432\u044b\u0439 \u043f\u043e\u0440\u043e\u0433 ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"} \u043d\u0430 ${p?.score ?? "0"}`,
  "menu.weeklyRaceHotLine": (p?: Record<string, unknown>) =>
    `\u0415\u0449\u0451 \u0440\u044b\u0432\u043e\u043a \u0434\u043e ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"} | ${p?.remaining ?? "0"}`,
  "menu.rewardedPlayCta": (p?: Record<string, unknown>) =>
    `\u0421\u041c\u041e\u0422\u0420\u0415\u0422\u042c \u0420\u0415\u041a\u041b\u0410\u041c\u0423\n\u0418\u0413\u0420\u0410: ${p?.reward ?? ""}`,
  "menu.rewardedDailyCta": (p?: Record<string, unknown>) =>
    `\u0421\u041c\u041e\u0422\u0420\u0415\u0422\u042c \u0420\u0415\u041a\u041b\u0410\u041c\u0423\n\u0414\u0415\u0419\u041b\u0418\u041a: ${p?.reward ?? ""}`,
  "menu.startBoosterToggleTitle": "\u0421\u0422\u0410\u0420\u0422\u041e\u0412\u042b\u0419 \u0411\u0423\u0421\u0422 \u0417\u0410 \u0420\u0415\u041a\u041b\u0410\u041c\u0423",
  "menu.startBoosterToggleHint": (p?: Record<string, unknown>) =>
    `\u041d\u0430\u0433\u0440\u0430\u0434\u0430 \u0434\u043b\u044f \u0438\u0433\u0440\u044b \u0438 \u0434\u0435\u0439\u043b\u0438\u043a\u0430: ${p?.reward ?? ""}`,
  "menu.startBoosterToggleHintCompact": (p?: Record<string, unknown>) =>
    `\u041d\u0430\u0433\u0440\u0430\u0434\u0430: ${p?.reward ?? ""}`,
  "menu.liveopsRotationFallback": "\u0420\u043e\u0442\u0430\u0446\u0438\u044f",
  "menu.liveopsHeadlineComeback": (p?: Record<string, unknown>) =>
    `\u0412\u043e\u0437\u0432\u0440\u0430\u0442 ${p?.days ?? 0}\u0434 | ${p?.reward ?? ""}`,
  "menu.liveopsHeadlineRotation": (p?: Record<string, unknown>) =>
    `${p?.badge ?? "\u0420\u043e\u0442\u0430\u0446\u0438\u044f"} | ${p?.title ?? "\u0420\u043e\u0442\u0430\u0446\u0438\u044f"}`,
  "menu.liveopsHeadlineTomorrow": (p?: Record<string, unknown>) =>
    `\u0417\u0430\u0432\u0442\u0440\u0430 | ${p?.title ?? "\u0417\u0430\u0432\u0442\u0440\u0430"}`,
  "menu.liveopsStatusLine": (p?: Record<string, unknown>) =>
    `\u0421\u0435\u0440\u0438\u044f ${p?.day ?? "0"} ${p?.streakState ?? "\u0413\u041e\u0422\u041e\u0412\u041e"} | \u0433\u043e\u0442\u043e\u0432\u043e ${p?.ready ?? "0"} | \u0434 ${p?.daily ?? "0/0"} | \u043d ${p?.weekly ?? "0/0"}`,
  "menu.dailyLoginLine": (p?: Record<string, unknown>) =>
    `\u041b\u043e\u0433\u0438\u043d ${p?.day ?? "0"}/${p?.max ?? "0"} | ${p?.reward ?? ""}`,
  "menu.dailyStartState.free": "\u0441\u0442\u0430\u0440\u0442 \u0431\u0435\u0441\u043f\u043b.",
  "menu.dailyStartState.rewarded": "\u0441\u0442\u0430\u0440\u0442 \u0437\u0430 \u0440\u0435\u043a\u043b.",
  "menu.dailyStartState.locked": "\u0441\u0442\u0430\u0440\u0442 \u0437\u0430\u043a\u0440.",
  "menu.dailyStatusLine": (p?: Record<string, unknown>) =>
    `\u041f\u043e\u043f\u044b\u0442\u043a\u0438 ${p?.used ?? "0"}/${p?.max ?? "0"} | ${p?.best ?? ""} | ${p?.next ?? ""}`,
  "menu.rewardsReadySummary": (p?: Record<string, unknown>) =>
    `\u0413\u043e\u0442\u043e\u0432\u043e ${p?.count ?? 0}`,
  "menu.rewardsQuietSummary": "\u041f\u043e\u043a\u0430 \u0442\u0438\u0445\u043e",
  "menu.progressSummary": (p?: Record<string, unknown>) =>
    `${p?.done ?? "0"}/${p?.total ?? "0"} \u0432\u044b\u043f.`,
  "menu.weeklyRaceRiskTopSafe": "\u0422\u041e\u041f \u0423\u0414\u0415\u0420\u0416\u0410\u041d",
  "menu.weeklyRaceRiskBurns": (p?: Record<string, unknown>) => `\u0421\u0413\u041e\u0420\u0418\u0422 +${p?.reward ?? ""}`,
  "menu.weeklyRaceRiskEntry": (p?: Record<string, unknown>) => `\u0412\u0425\u041e\u0414 ${p?.reward ?? ""}`,
  "menu.weeklyRaceRiskHoldPayout": "\u0414\u0415\u0420\u0416\u0418 \u041d\u0410\u0413\u0420\u0410\u0414\u0423",
  "menu.weeklyRaceNoRewardCompact": "0\u0411",
  "menu.weeklyRaceHeldRewardBadge": (p?: Record<string, unknown>) =>
    `\u0421\u0411\u0420\u041e\u0421 ${p?.reward ?? "0\u0411"}`,
  "menu.weeklyRaceState.enter": "\u0412\u0425\u041e\u0414",
  "menu.weeklyRaceState.climbing": "\u0412 \u0413\u041e\u041d\u041a\u0415",
  "menu.weeklyRaceState.payout": "\u041d\u0410\u0413\u0420\u0410\u0414\u0410",
  "menu.weeklyRaceState.near_promo": "\u0410\u041f \u0420\u042F\u0414\u041E\u041C",
  "menu.weeklyRaceState.hot_run": "\u0420\u042B\u0412\u041E\u041A",
  "menu.weeklyRaceState.top": "\u0422\u041E\u041F",
  "menu.weeklyRaceJumpDebut": (p?: Record<string, unknown>) => `\u041D\u041E\u0412\u042B\u0419 #${p?.rank ?? 0}`,
  "menu.weeklyRaceProgressLabel": (p?: Record<string, unknown>) =>
    `${p?.percent ?? 0}% \u0434\u043e ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"}`,
  "menu.weeklyRaceHotProgressLabel": (p?: Record<string, unknown>) =>
    `\u0420\u042B\u0412\u041E\u041A \u0414\u041E ${p?.division ?? "\u0420\u0435\u0439\u0434\u0435\u0440"}`,
  "menu.weeklyRaceResetDays": (p?: Record<string, unknown>) =>
    `\u0421\u0411\u0420\u041E\u0421 ${p?.days ?? 0}\u0414 ${p?.hours ?? 0}\u0427`,
  "menu.weeklyRaceResetHours": (p?: Record<string, unknown>) => `\u0421\u0411\u0420\u041E\u0421 ${p?.hours ?? 0}\u0427`,
  "menu.weeklyRaceResetMinutes": (p?: Record<string, unknown>) => `\u0421\u0411\u0420\u041E\u0421 ${p?.minutes ?? 0}\u041C`,
  "menu.weeklyRaceTopDivision": "\u0412\u0415\u0420\u0425\u041D\u042F\u042F \u041B\u0418\u0413\u0410",
  "menu.portalBoardsTitle": "\u0420\u0415\u0419\u0422\u0418\u041d\u0413\u0418 \u041f\u041b\u0410\u0422\u0424\u041e\u0420\u041c\u042b",
  "menu.portalBoardsLoading": "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u043e\u0432 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b...",
  "menu.portalBoardsUnavailable": "\u0420\u0435\u0439\u0442\u0438\u043d\u0433\u0438 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b",
  "menu.portalBoardsUnranked": "\u0411\u0435\u0437 \u043c\u0435\u0441\u0442\u0430",
  "menu.portalBoardsFallback": "\u041b\u043e\u043a\u0430\u043b\u044c\u043d\u043e",
  "menu.portalBoardsTop": "\u0412\u0435\u0440\u0445\u043d\u044f\u044f \u043b\u0438\u0433\u0430",
  "menu.portalBoard.daily": "\u0414\u0435\u043d\u044c",
  "menu.portalBoard.weekly": "\u041d\u0435\u0434\u0435\u043b\u044f",
  "menu.portalBoard.all_time": "\u0412\u0441\u0435 \u0432\u0440\u0435\u043c\u044f",
  "menu.rewardBoltsCompact": (p?: Record<string, unknown>) => `${p?.value ?? 0}\u0411`,
  "menu.rewardCoresCompact": (p?: Record<string, unknown>) => `${p?.value ?? 0}\u042F`,
  "menu.rewardTailCompact": (p?: Record<string, unknown>) => `+${p?.value ?? 0} \u0441\u0435\u0433\u043c.`,
  "menu.rewardTailLong": (p?: Record<string, unknown>) => `+${p?.value ?? 0} \u0441\u0435\u0433\u043c\u0435\u043d\u0442\u0430`,
  "menu.rewardBoltsShort": (p?: Record<string, unknown>) => `+${p?.value ?? 0} \u0431\u043e\u043b\u0442.`,
  "menu.rewardCoresShort": (p?: Record<string, unknown>) => `+${p?.value ?? 0} \u044f\u0434.`,
  "menu.rewardNone": "\u0431\u0435\u0437 \u0431\u043e\u043d\u0443\u0441\u0430",
  "menu.installedLevelShort": "\u0443\u0440.",
  "results.nextMilestone": (p?: Record<string, unknown>) =>
    `\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0431\u0435\u0439\u0434\u0436: ${p?.title ?? "?"}`,
  "results.allMilestones": "\u0412\u0441\u0435 \u043a\u0430\u0440\u044c\u0435\u0440\u043d\u044b\u0435 \u0431\u0435\u0439\u0434\u0436\u0438 \u0441\u043e\u0431\u0440\u0430\u043d\u044b",
  "results.rank": (p?: Record<string, unknown>) => `\u041c\u0435\u0441\u0442\u043e: #${p?.rank ?? 0}`,
  "results.newRecord": "\u041d\u043e\u0432\u044b\u0439 \u0440\u0435\u043a\u043e\u0440\u0434",
  "results.leaderboardTitle": "\u0420\u0435\u0439\u0442\u0438\u043d\u0433",
  "upgrade.finale": (p?: Record<string, unknown>) => `\u0424\u0438\u043d\u0430\u043b: ${p?.finale ?? ""}`,
  "wave.finale": "\u0424\u0438\u043d\u0430\u043b",
  "wave.event": "\u0421\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u0435\u043a\u0442\u043e\u0440\u0430",
  "status.finale": (p?: Record<string, unknown>) => `\u0424\u0438\u043d\u0430\u043b ${p?.title ?? ""}`,
  "status.event": (p?: Record<string, unknown>) => `\u0421\u043e\u0431\u044b\u0442\u0438\u0435 ${p?.title ?? ""}`,
  "leaderboard.filter.all": "\u0412\u0421\u0415",
  "leaderboard.filter.run": "\u0417\u0410\u0415\u0417\u0414",
  "leaderboard.filter.daily": "\u0414\u0415\u0419\u041b\u0418",
  "leaderboard.mode.run": "\u0417\u0430\u0435\u0437\u0434",
  "leaderboard.mode.daily": "\u0414\u0435\u0439\u043b\u0438",
  "leaderboard.division.scrapper": "\u0421\u0442\u0430\u0440\u0430\u0442\u0435\u043b\u044c",
  "leaderboard.division.raider": "\u0420\u0435\u0439\u0434\u0435\u0440",
  "leaderboard.division.ace": "\u0410\u0441",
  "leaderboard.division.elite": "\u042d\u043b\u0438\u0442\u0430",
  "leaderboard.division.legend": "\u041b\u0435\u0433\u0435\u043d\u0434\u0430",
  "leaderboard.milestone.score_25000": "\u041a\u0432\u0430\u0440\u0442\u0438\u0440\u043c\u0435\u0439\u0441\u0442\u0435\u0440 25K",
  "leaderboard.milestone.wave_20": "\u0424\u0440\u043e\u043d\u0442 20",
  "leaderboard.milestone.salvage_400": "\u0411\u0430\u0440\u043e\u043d \u043b\u043e\u043c\u0430",
  "leaderboard.milestone.legend_league": "\u041b\u0438\u0433\u0430 \u041b\u0435\u0433\u0435\u043d\u0434",
  "leaderboard.lastRun": "\u041f\u041e\u0421\u041b\u0415\u0414\u041d\u0418\u0419 \u0417\u0410\u0415\u0417\u0414",
  "leaderboard.recordBadge": "\u041d\u041e\u0412\u042b\u0419 \u0420\u0415\u041a\u041e\u0420\u0414",
});

const UPGRADE_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    wide_field: { title: "Wide Field", desc: "+12% magnet radius per stack." },
    strong_pull: { title: "Strong Pull", desc: "+12% magnet pull acceleration per stack." },
    vacuum_burst: { title: "Vacuum Burst", desc: "Every 8s: +30% pull for 1s." },
    heavy_haul: { title: "Heavy Haul", desc: "More heavy scrap appears and each heavy bank is worth +1 bolt." },
    fast_flip: { title: "Fast Flip", desc: "-12% FLIP cooldown per stack." },
    hard_push: { title: "Hard Push", desc: "+18% FLIP pulse force per stack." },
    flip_shield: { title: "Flip Shield", desc: "After FLIP: gain a 15-point shield for 3s." },
    shrapnel_coil: { title: "Shrapnel Coil", desc: "FLIP fires 6 shrapnel sparks for damage and knockback." },
    polarity_echo: { title: "Polarity Echo", desc: "Every third FLIP repeats a weaker pulse after 0.15s." },
    long_frame: { title: "Long Frame", desc: "+5 caravan capacity per stack." },
    chain_clamp: { title: "Chain Clamp", desc: "Once per wave: ignore one lost tail segment event." },
    tail_armor: { title: "Tail Armor", desc: "-1 tail loss from hits, down to a minimum of 1." },
    stabilizer_fins: { title: "Stabilizer Fins", desc: "Steadier tail handling and a lighter speed penalty per segment." },
    magnet_anchor: { title: "Magnet Anchor", desc: "Every 10s: anchor the caravan for 0.6s to prevent tail loss." },
    emergency_patch: { title: "Emergency Patch", desc: "+20 max HP and heal 20 immediately." },
    recycler_bonus: { title: "Recycler Bonus", desc: "Banking heals more and grants +10% bolts." },
    overclock: { title: "Overclock", desc: "+12% speed, but incoming damage is +10%." },
    dash_module: { title: "Dash Module", desc: "Boost Dash for this run: -15% cooldown, longer burst, and more i-frames." },
    ram_plating: { title: "Ram Plating", desc: "Dash becomes a battering ram: more impact force and damage, plus shield for enemies clipped." },
    magnet_wake: { title: "Magnet Wake", desc: "After Dash, a short magnetic wake widens pull and scoops scrap from farther away." },
    ion_ram: { title: "Ion Ram", desc: "Dash impacts arc ion shocks into nearby enemies for follow-up hits." },
    salvage_siphon: { title: "Salvage Siphon", desc: "Wake auto-captures valuable scrap, and dash kills spill heavier salvage." },
    drone_buddy: { title: "Drone Buddy", desc: "A support drone fires every 1.4s for 6 damage." },
    scrap_mine: { title: "Scrap Mine", desc: "Lost tail segments become mines for 3s." },
    x2_results_hook: { title: "Double Results Hook", desc: "Improves the value of the rewarded results screen." },
  },
  ru: {
    wide_field: { title: "Широкое поле", desc: "+12% к радиусу магнита за стак." },
    strong_pull: { title: "Сильная тяга", desc: "+12% к ускорению притяжения за стак." },
    vacuum_burst: { title: "Вакуумный всплеск", desc: "Каждые 8с: +30% к тяге на 1с." },
    heavy_haul: { title: "Тяжёлый улов", desc: "Тяжёлый лом встречается чаще, а сдача heavy даёт +1 болт." },
    fast_flip: { title: "Быстрый флип", desc: "-12% к перезарядке ФЛИПа за стак." },
    hard_push: { title: "Жёсткий толчок", desc: "+18% к силе импульса ФЛИПа за стак." },
    flip_shield: { title: "Щит после флипа", desc: "После ФЛИПа: щит на 15 ед. на 3с." },
    shrapnel_coil: { title: "Осколочная катушка", desc: "ФЛИП выпускает 6 осколков с уроном и отталкиванием." },
    polarity_echo: { title: "Эхо полярности", desc: "Каждый третий ФЛИП повторяет ослабленную волну через 0.15с." },
    long_frame: { title: "Длинная рама", desc: "+5 к лимиту каравана за стак." },
    chain_clamp: { title: "Зажим цепи", desc: "Раз за волну: одно событие потери хвоста игнорируется." },
    tail_armor: { title: "Броня хвоста", desc: "-1 к потерям хвоста от ударов, но не ниже 1." },
    stabilizer_fins: { title: "Стабилизаторы", desc: "Хвост меньше болтает, а штраф скорости за сегмент слабее." },
    magnet_anchor: { title: "Магнитный якорь", desc: "Раз в 10с: якорь на 0.6с, чтобы не терять хвост." },
    emergency_patch: { title: "Экстренный ремонт", desc: "+20 к макс. HP и мгновенное лечение на 20." },
    recycler_bonus: { title: "Бонус переработчика", desc: "Сдача сильнее лечит и даёт +10% болтов." },
    overclock: { title: "Разгон", desc: "+12% скорости, но входящий урон +10%." },
    dash_module: { title: "Модуль рывка", desc: "Усиливает рывок в этом заезде: -15% кд, длиннее окно рывка и больше i-frame." },
    ram_plating: { title: "Таранная броня", desc: "Рывок превращается в таран: сильнее удар, дольше сбивает врагов и даёт щит за каждое попадание." },
    magnet_wake: { title: "Магнитный шлейф", desc: "После рывка остаётся короткий магнитный шлейф: шире тяга и легче подбирать лом на ходу." },
    ion_ram: { title: "Ионный таран", desc: "Попадания рывком пускают ионные дуги в соседних врагов и добивают строй." },
    salvage_siphon: { title: "Сифон добычи", desc: "Шлейф сам втягивает ценный лом, а убийства в рывке чаще роняют heavy и rare-добычу." },
    drone_buddy: { title: "Дрон-напарник", desc: "Дрон стреляет раз в 1.4с и наносит 6 урона." },
    scrap_mine: { title: "Мины из лома", desc: "Потерянные сегменты хвоста превращаются в мины на 3с." },
    x2_results_hook: { title: "Крюк двойной выгоды", desc: "Усиливает ценность рекламного экрана наград." },
  },
};

const META_NODE_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    meta_core_1: {
      title: "Magnet Core I",
      desc: "Permanent magnet radius and pull upgrades for smoother collection-heavy runs.",
    },
    meta_coil_1: {
      title: "Polarity Coil I",
      desc: "Permanent FLIP cooldown and pulse-force upgrades for pressure-heavy waves.",
    },
    meta_frame_1: {
      title: "Reinforced Frame I",
      desc: "Permanent hull plating for more max HP and stronger recycler healing.",
    },
    meta_tail_1: {
      title: "Caravan Linkage I",
      desc: "Permanent tail length and gentler speed penalties for hauling builds.",
    },
    meta_dash_unlock: {
      title: "Dash Tuning",
      desc: "Sharpen every future dash with lower cooldown and a safer burst window.",
    },
    meta_recycler_overdrive: {
      title: "Recycler Overdrive",
      desc: "Permanent recycler speed, heavy-scrap payout and heal upgrades.",
    },
    meta_core_2: {
      title: "Magnet Core II",
      desc: "Pushes radius and pull strength farther so high-density salvage routes feel smoother.",
    },
    meta_coil_2: {
      title: "Polarity Coil II",
      desc: "Cuts more FLIP downtime and stretches the pulse radius for cleaner crowd control.",
    },
    meta_frame_2: {
      title: "Reinforced Frame II",
      desc: "Adds more permanent hull and recycler sustain for longer comeback windows.",
    },
    meta_tail_2: {
      title: "Caravan Linkage II",
      desc: "Supports longer chains while easing the movement tax from hauling big tails.",
    },
    meta_salvage_routes: {
      title: "Salvage Routes",
      desc: "Every future bank cashes out harder, especially once the chain gets heavy.",
    },
    meta_flux_rig: {
      title: "Flux Rig",
      desc: "Starts all future runs with a more violent FLIP pattern and heavier opening tempo.",
    },
    meta_recycler_lattice: {
      title: "Recycler Lattice",
      desc: "Sharpens bank speed, healing, and shard conversion for long-term economy runs.",
    },
    meta_dash_caps: {
      title: "Dash Capacitors",
      desc: "Turns dash into a safer, faster breakaway tool with better uptime.",
    },
  },
  ru: {
    meta_core_1: {
      title: "Сердечник магнита I",
      desc: "Постоянно усиливает радиус и тягу магнита для комфортных сборочных заездов.",
    },
    meta_coil_1: {
      title: "Катушка полярности I",
      desc: "Постоянно ускоряет ФЛИП и усиливает его импульс в плотных волнах.",
    },
    meta_frame_1: {
      title: "Усиленная рама I",
      desc: "Постоянная броня корпуса: больше макс. HP и сильнее лечение от переработчика.",
    },
    meta_tail_1: {
      title: "Сцепка каравана I",
      desc: "Постоянно удлиняет караван и смягчает штраф скорости за хвост.",
    },
    meta_dash_unlock: {
      title: "Тюнинг рывка",
      desc: "Улучшает все будущие рывки: ниже кд и безопаснее окно прорыва.",
    },
    meta_recycler_overdrive: {
      title: "Форсаж переработчика",
      desc: "Постоянно ускоряет сдачу, усиливает heavy-доход и лечение переработчика.",
    },
  },
};

const DAILY_VARIANT_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    daily_fast_flip: {
      title: "Fast Flip",
      desc: "Shorter FLIP cooldown. More shooters appear from Wave 4.",
    },
    daily_heavy_yard: {
      title: "Heavy Yard",
      desc: "Heavy scrap pays better and appears more often.",
    },
    daily_fragile_tail: {
      title: "Fragile Tail",
      desc: "Projectiles cut more tail segments. The first reroll is cheaper.",
    },
  },
  ru: {
    daily_fast_flip: {
      title: "Быстрый флип",
      desc: "ФЛИП быстрее откатывается. С 4-й волны чаще приходят стрелки.",
    },
    daily_heavy_yard: {
      title: "Тяжёлый двор",
      desc: "Тяжёлый лом приносит больше и появляется чаще.",
    },
    daily_fragile_tail: {
      title: "Хрупкий хвост",
      desc: "Снаряды режут больше сегментов хвоста. Первый переброс дешевле.",
    },
  },
};

const EXTRA_META_NODE_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    meta_core_2: {
      title: "Magnet Core II",
      desc: "Pushes radius and pull strength farther so high-density salvage routes feel smoother.",
    },
    meta_coil_2: {
      title: "Polarity Coil II",
      desc: "Cuts more FLIP downtime and stretches the pulse radius for cleaner crowd control.",
    },
    meta_frame_2: {
      title: "Reinforced Frame II",
      desc: "Adds more permanent hull and recycler sustain for longer comeback windows.",
    },
    meta_tail_2: {
      title: "Caravan Linkage II",
      desc: "Supports longer chains while easing the movement tax from hauling big tails.",
    },
    meta_salvage_routes: {
      title: "Salvage Routes",
      desc: "Every future bank cashes out harder, especially once the chain gets heavy.",
    },
    meta_flux_rig: {
      title: "Flux Rig",
      desc: "Starts all future runs with a more violent FLIP pattern and heavier opening tempo.",
    },
    meta_recycler_lattice: {
      title: "Recycler Lattice",
      desc: "Sharpens bank speed, healing, and shard conversion for long-term economy runs.",
    },
    meta_dash_caps: {
      title: "Dash Capacitors",
      desc: "Turns dash into a safer, faster breakaway tool with better uptime.",
    },
  },
  ru: {
    meta_core_2: {
      title: "Сердечник магнита II",
      desc: "Ещё сильнее расширяет радиус и тягу, чтобы плотные сборочные маршруты игрались мягче.",
    },
    meta_coil_2: {
      title: "Катушка полярности II",
      desc: "Ещё ниже кд ФЛИПа и шире импульс для уверенного контроля плотных волн.",
    },
    meta_frame_2: {
      title: "Усиленная рама II",
      desc: "Добавляет постоянный запас корпуса и устойчивости через лечение переработчика.",
    },
    meta_tail_2: {
      title: "Сцепка каравана II",
      desc: "Позволяет тащить ещё более длинные цепи и слабее режет скорость за хвост.",
    },
    meta_salvage_routes: {
      title: "Маршруты добычи",
      desc: "Каждая будущая сдача приносит больше, особенно когда хвост успел разрастись.",
    },
    meta_flux_rig: {
      title: "Флюкс-риг",
      desc: "Делает все будущие ФЛИПы злее и задаёт более взрывной стартовый темп.",
    },
    meta_recycler_lattice: {
      title: "Решётка переработчика",
      desc: "Ускоряет сдачу, усиливает лечение и повышает ценность редких осколков.",
    },
    meta_dash_caps: {
      title: "Конденсаторы рывка",
      desc: "Делают рывок быстрее, безопаснее и заметно доступнее в каждом заезде.",
    },
  },
};

const EXTRA_DAILY_VARIANT_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    daily_cash_surge: {
      title: "Cash Surge",
      desc: "Every bank pays better, but pressure ramps faster.",
    },
    daily_long_tail: {
      title: "Long Tail",
      desc: "Longer chains stay controllable and pay off hauling-focused routes.",
    },
    daily_hot_dash: {
      title: "Hot Dash",
      desc: "Dash comes back sooner, but FLIP asks for cleaner timing.",
    },
    daily_shrapnel_field: {
      title: "Shrapnel Field",
      desc: "Runs start with shrapnel pulses and a livelier FLIP loop.",
    },
    daily_salvage_rain: {
      title: "Salvage Rain",
      desc: "The yard is richer and denser, but banking takes a little longer.",
    },
  },
  ru: {
    daily_cash_surge: {
      title: "Кассовый всплеск",
      desc: "Любая сдача приносит больше, но давление раскручивается быстрее.",
    },
    daily_long_tail: {
      title: "Длинный хвост",
      desc: "Длинные цепи легче удерживать, и они лучше окупают маршрут на сбор.",
    },
    daily_hot_dash: {
      title: "Горячий рывок",
      desc: "Рывок возвращается быстрее, но ФЛИП требует аккуратного тайминга.",
    },
    daily_shrapnel_field: {
      title: "Осколочное поле",
      desc: "Заезд стартует с осколочным ФЛИПом и более агрессивным темпом.",
    },
    daily_salvage_rain: {
      title: "Ливень добычи",
      desc: "На карте больше лома и он появляется чаще, но сдача идёт чуть дольше.",
    },
  },
};

const DAILY_ROTATION_COPY: Record<Locale, Record<string, RotationCopy>> = {
  en: {
    salvage_week: {
      badge: "SALVAGE WEEK",
      title: "Salvage Week",
      desc: "Heavy scrap, recycler bursts, and cash-out spikes all week long.",
    },
    flip_wave: {
      badge: "FLIP WAVE",
      title: "Flip Wave",
      desc: "Faster pulses, shrapnel starts, and momentum-heavy routes rotate this week.",
    },
    caravan_week: {
      badge: "CARAVAN WEEK",
      title: "Caravan Week",
      desc: "Longer chains, higher stakes, and score runs built around tail control.",
    },
    pressure_week: {
      badge: "PRESSURE WEEK",
      title: "Pressure Week",
      desc: "Riskier starts and a faster pace for players chasing leaderboard jumps.",
    },
  },
  ru: {
    salvage_week: {
      badge: "НЕДЕЛЯ ЛОМА",
      title: "Неделя лома",
      desc: "Тяжёлый лом, всплески сдачи и переработчик в центре внимания всю неделю.",
    },
    flip_wave: {
      badge: "ВОЛНА ФЛИПА",
      title: "Волна флипа",
      desc: "Быстрые импульсы, осколочный старт и скоростные маршруты на всю неделю.",
    },
    caravan_week: {
      badge: "НЕДЕЛЯ КАРАВАНА",
      title: "Неделя каравана",
      desc: "Длинные цепи, высокий риск и заезды, построенные вокруг контроля хвоста.",
    },
    pressure_week: {
      badge: "НЕДЕЛЯ НАПРЯЖЕНИЯ",
      title: "Неделя напряжения",
      desc: "Более жёсткий старт и быстрый темп для тех, кто охотится за рывком в рейтинге.",
    },
  },
};

const LIVEOPS_EVENT_COPY: Record<Locale, Record<"comeback" | "tomorrow_offer", UpgradeCopy>> = {
  en: {
    comeback: {
      title: "Welcome Back Salvage",
      desc: "Return after a break to claim a comeback cache and jump back into the yard.",
    },
    tomorrow_offer: {
      title: "Tomorrow's Yard Bonus",
      desc: "Come back tomorrow for a fresh daily seed, streak reward, and extra mission cache.",
    },
  },
  ru: {
    comeback: {
      title: "Возвращение в двор",
      desc: "Вернись после паузы, чтобы забрать камбэк-кеш и снова выйти на маршрут.",
    },
    tomorrow_offer: {
      title: "Завтрашний бонус двора",
      desc: "Загляни завтра за новым дневным сидом, наградой серии и дополнительным кешем заданий.",
    },
  },
};

const LEVEL_MODIFIER_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    salvage_surge: {
      title: "Salvage Surge",
      desc: "Extra scrap fields and stronger recycler payouts, but the swarm moves faster.",
    },
    crossfire_protocol: {
      title: "Crossfire Protocol",
      desc: "Chasers start converting into shooters. Enemy shots fly faster, but FLIP cools down quicker too.",
    },
    razor_parade: {
      title: "Razor Parade",
      desc: "Cutters join the wave more often. Banking is faster, and the caravan gets a little more speed.",
    },
    iron_convoy: {
      title: "Iron Convoy",
      desc: "Enemies gain more hull, but heavy scrap pays better and recycler heals harder.",
    },
    ion_storm: {
      title: "Ion Storm",
      desc: "The whole arena overclocks: enemies, shots and pressure spike, while dash and core gains improve.",
    },
    breaker_surge: {
      title: "Breaker Surge",
      desc: "Cutters and hunter packs crash the lane harder. Banking is faster, but keeping the caravan intact matters more.",
    },
    reclaimer_uplink: {
      title: "Reclaimer Uplink",
      desc: "Recovery beacons spike salvage and dash tempo, while recycler lanes attract denser crossfire.",
    },
  },
  ru: {
    salvage_surge: {
      title: "\u0428\u043a\u0432\u0430\u043b \u0434\u043e\u0431\u044b\u0447\u0438",
      desc: "\u041d\u0430 \u043f\u043e\u043b\u0435 \u0431\u043e\u043b\u044c\u0448\u0435 \u043b\u043e\u043c\u0430 \u0438 \u0432\u044b\u0433\u043e\u0434\u043d\u0435\u0435 \u0441\u0434\u0430\u0447\u0430, \u043d\u043e \u0440\u043e\u0439 \u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044f \u0431\u044b\u0441\u0442\u0440\u0435\u0435.",
    },
    crossfire_protocol: {
      title: "\u041f\u0440\u043e\u0442\u043e\u043a\u043e\u043b \u043f\u0435\u0440\u0435\u043a\u0440\u0435\u0441\u0442\u043d\u043e\u0433\u043e \u043e\u0433\u043d\u044f",
      desc: "\u0422\u0430\u0440\u0430\u043d\u044b \u0447\u0430\u0449\u0435 \u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u043d\u0430 \u0441\u0442\u0440\u0435\u043b\u043a\u043e\u0432. \u0412\u044b\u0441\u0442\u0440\u0435\u043b\u044b \u043b\u0435\u0442\u044f\u0442 \u0431\u044b\u0441\u0442\u0440\u0435\u0435, \u0437\u0430\u0442\u043e \u0424\u041b\u0418\u041f \u043e\u0442\u043a\u0430\u0442\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0440\u0430\u043d\u044c\u0448\u0435.",
    },
    razor_parade: {
      title: "\u041f\u0430\u0440\u0430\u0434 \u0440\u0435\u0437\u0447\u0438\u043a\u043e\u0432",
      desc: "\u0420\u0435\u0437\u0447\u0438\u043a\u0438 \u0432\u044b\u0445\u043e\u0434\u044f\u0442 \u0447\u0430\u0449\u0435. \u0421\u0434\u0430\u0432\u0430\u0442\u044c \u0445\u0432\u043e\u0441\u0442 \u043b\u0435\u0433\u0447\u0435, \u0430 \u043a\u0430\u0440\u0430\u0432\u0430\u043d \u0435\u0434\u0435\u0442 \u0447\u0443\u0442\u044c \u0440\u0435\u0437\u0432\u0435\u0435.",
    },
    iron_convoy: {
      title: "\u0416\u0435\u043b\u0435\u0437\u043d\u044b\u0439 \u043a\u043e\u043d\u0432\u043e\u0439",
      desc: "\u0412\u0440\u0430\u0433\u0438 \u0441\u0442\u0430\u043d\u043e\u0432\u044f\u0442\u0441\u044f \u043f\u0440\u043e\u0447\u043d\u0435\u0435, \u043d\u043e heavy-\u043b\u043e\u043c \u0434\u043e\u0440\u043e\u0436\u0435, \u0430 \u043f\u0435\u0440\u0435\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a \u043b\u0435\u0447\u0438\u0442 \u0441\u0438\u043b\u044c\u043d\u0435\u0435.",
    },
    ion_storm: {
      title: "\u0418\u043e\u043d\u043d\u0430\u044f \u0431\u0443\u0440\u044f",
      desc: "\u0410\u0440\u0435\u043d\u0430 \u0432\u0445\u043e\u0434\u0438\u0442 \u0432 \u0440\u0430\u0437\u043d\u043e\u0441: \u0432\u0440\u0430\u0433\u0438 \u0438 \u0438\u0445 \u0441\u043d\u0430\u0440\u044f\u0434\u044b \u0443\u0441\u043a\u043e\u0440\u044f\u044e\u0442\u0441\u044f, \u0437\u0430\u0442\u043e \u0440\u044b\u0432\u043e\u043a \u0438 \u044f\u0434\u0440\u0430 \u0441\u0442\u0430\u043d\u043e\u0432\u044f\u0442\u0441\u044f \u0446\u0435\u043d\u043d\u0435\u0435.",
    },
    breaker_surge: {
      title: "\u041d\u0430\u0442\u0438\u0441\u043a \u0440\u0435\u0437\u0447\u0438\u043a\u043e\u0432",
      desc: "\u0420\u0435\u0437\u0447\u0438\u043a\u0438 \u0438 \u043e\u0445\u043e\u0442\u043d\u0438\u0447\u044c\u0438 \u0441\u0442\u0430\u0438 \u0434\u0430\u0432\u044f\u0442 \u0441\u0438\u043b\u044c\u043d\u0435\u0435. \u0421\u0434\u0430\u0447\u0430 \u0438\u0434\u0451\u0442 \u0431\u044b\u0441\u0442\u0440\u0435\u0435, \u043d\u043e \u0445\u0432\u043e\u0441\u0442 \u043d\u0443\u0436\u043d\u043e \u0443\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u0446\u0435\u043b\u044b\u043c.",
    },
    reclaimer_uplink: {
      title: "\u041a\u0430\u043d\u0430\u043b \u0441\u0431\u043e\u0440\u0449\u0438\u043a\u043e\u0432",
      desc: "\u041c\u0430\u044f\u043a\u0438 \u0434\u043e\u0431\u044b\u0447\u0438 \u0443\u0441\u0438\u043b\u0438\u0432\u0430\u044e\u0442 \u0441\u0431\u043e\u0440 \u0438 \u0440\u044b\u0432\u043e\u043a, \u043d\u043e \u0443 \u043f\u0435\u0440\u0435\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0430 \u0441\u0433\u0443\u0449\u0430\u0435\u0442\u0441\u044f \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u044b\u0439 \u043e\u0433\u043e\u043d\u044c.",
    },
  },
};

const LEVEL_OBJECTIVE_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    bank_bolts: {
      title: "Cash In",
      desc: "Bank enough bolts during this level.",
    },
    deflect_projectiles: {
      title: "Return Fire",
      desc: "Deflect enemy shots back into the swarm.",
    },
    tail_segments: {
      title: "Full Caravan",
      desc: "Finish the level with a long scrap chain intact.",
    },
    heavy_scrap: {
      title: "Heavy Freight",
      desc: "Secure extra heavy scrap before the level ends.",
    },
    hull_integrity: {
      title: "Hold The Line",
      desc: "Finish the level with strong hull integrity.",
    },
  },
  ru: {
    bank_bolts: {
      title: "\u0421\u0434\u0430\u0439 \u0434\u043e\u0431\u044b\u0447\u0443",
      desc: "\u0421\u0434\u0430\u0439 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0431\u043e\u043b\u0442\u043e\u0432 \u0432 \u044d\u0442\u043e\u043c \u0443\u0440\u043e\u0432\u043d\u0435.",
    },
    deflect_projectiles: {
      title: "\u0412\u0435\u0440\u043d\u0438 \u043e\u0433\u043e\u043d\u044c",
      desc: "\u041e\u0442\u0431\u0438\u0432\u0430\u0439 \u0432\u0440\u0430\u0436\u0435\u0441\u043a\u0438\u0435 \u0432\u044b\u0441\u0442\u0440\u0435\u043b\u044b \u043e\u0431\u0440\u0430\u0442\u043d\u043e \u0432 \u0440\u043e\u0439.",
    },
    tail_segments: {
      title: "\u041f\u043e\u043b\u043d\u044b\u0439 \u043a\u0430\u0440\u0430\u0432\u0430\u043d",
      desc: "\u0417\u0430\u043a\u043e\u043d\u0447\u0438 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0441 \u0434\u043b\u0438\u043d\u043d\u043e\u0439 \u0446\u0435\u043f\u044c\u044e \u043b\u043e\u043c\u0430.",
    },
    heavy_scrap: {
      title: "\u0422\u044f\u0436\u0451\u043b\u044b\u0439 \u0433\u0440\u0443\u0437",
      desc: "\u0423\u0441\u043f\u0435\u0439 \u0441\u043e\u0431\u0440\u0430\u0442\u044c \u043f\u043e\u0431\u043e\u043b\u044c\u0448\u0435 heavy-\u043b\u043e\u043c\u0430 \u0434\u043e \u043a\u043e\u043d\u0446\u0430 \u0443\u0440\u043e\u0432\u043d\u044f.",
    },
    hull_integrity: {
      title: "\u0414\u0435\u0440\u0436\u0438 \u043a\u043e\u0440\u043f\u0443\u0441",
      desc: "\u0414\u043e\u0439\u0434\u0438 \u0434\u043e \u043a\u043e\u043d\u0446\u0430 \u0443\u0440\u043e\u0432\u043d\u044f \u0441 \u0437\u0430\u043f\u0430\u0441\u043e\u043c HP.",
    },
  },
};

const LEVEL_FINALE_COPY: Record<Locale, Record<string, UpgradeCopy>> = {
  en: {
    crossfire_overseer: {
      title: "Crossfire Overseer",
      desc: "A commander-pattern finale with layered shooter angles and flank pressure.",
    },
    blade_dancer: {
      title: "Blade Dancer",
      desc: "A cutter-led finale that keeps collapsing onto the tail line.",
    },
    scrap_juggernaut: {
      title: "Scrap Juggernaut",
      desc: "A hulking convoy finale with tanky pressure and heavy salvage drops.",
    },
    salvage_storm: {
      title: "Salvage Storm",
      desc: "A rare sector event that floods the arena with salvage bursts and ambushes.",
    },
    ion_tempest: {
      title: "Ion Tempest",
      desc: "A rare sector event with storm barrages, rare shards and edge-fire volleys.",
    },
    breaker_ring: {
      title: "Breaker Ring",
      desc: "A cutter-heavy boss ring that keeps collapsing toward the caravan spine.",
    },
    core_monsoon: {
      title: "Core Monsoon",
      desc: "A salvage squall event with shard bursts, heavy drops and recycler-lane crossfire.",
    },
  },
  ru: {
    crossfire_overseer: {
      title: "\u0421\u043c\u043e\u0442\u0440\u044f\u0449\u0438\u0439 \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u043e\u0433\u043e \u043e\u0433\u043d\u044f",
      desc: "\u0424\u0438\u043d\u0430\u043b \u0441 \u043a\u043e\u043c\u0430\u043d\u0434\u0438\u0440\u0441\u043a\u0438\u043c \u043f\u0430\u0442\u0442\u0435\u0440\u043d\u043e\u043c: \u0443\u0433\u043b\u044b, \u0444\u043b\u0430\u043d\u0433\u0438 \u0438 \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u044b\u0439 \u043e\u0433\u043e\u043d\u044c.",
    },
    blade_dancer: {
      title: "\u0422\u0430\u043d\u0446\u043e\u0440 \u043b\u0435\u0437\u0432\u0438\u0439",
      desc: "\u0424\u0438\u043d\u0430\u043b \u043f\u043e\u0434 \u0434\u0438\u043a\u0442\u043e\u0432\u043a\u0443 \u0440\u0435\u0437\u0447\u0438\u043a\u043e\u0432, \u0433\u0434\u0435 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0432\u0441\u0451 \u0432\u0440\u0435\u043c\u044f \u0441\u0432\u0430\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043d\u0430 \u0445\u0432\u043e\u0441\u0442.",
    },
    scrap_juggernaut: {
      title: "\u041b\u043e\u043c\u043e\u0432\u043e\u0439 \u0434\u0436\u0430\u0433\u0433\u0435\u0440\u043d\u0430\u0443\u0442",
      desc: "\u0422\u044f\u0436\u0451\u043b\u044b\u0439 \u0444\u0438\u043d\u0430\u043b-\u043a\u043e\u043d\u0432\u043e\u0439: \u0442\u0430\u043d\u043a\u043e\u0432\u043e\u0435 \u0434\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0438 heavy-\u0432\u044b\u0431\u0440\u043e\u0441\u044b \u043b\u043e\u043c\u0430.",
    },
    salvage_storm: {
      title: "\u0428\u043a\u0432\u0430\u043b \u0434\u043e\u0431\u044b\u0447\u0438",
      desc: "\u0420\u0435\u0434\u043a\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u0435\u043a\u0442\u043e\u0440\u0430: \u0430\u0440\u0435\u043d\u0443 \u0437\u0430\u0432\u0430\u043b\u0438\u0432\u0430\u044e\u0442 \u0432\u044b\u0431\u0440\u043e\u0441\u044b \u043b\u043e\u043c\u0430 \u0438 \u0437\u0430\u0441\u0430\u0434\u044b.",
    },
    ion_tempest: {
      title: "\u0418\u043e\u043d\u043d\u044b\u0439 \u0442\u0435\u043c\u043f\u0435\u0441\u0442",
      desc: "\u0420\u0435\u0434\u043a\u043e\u0435 \u0441\u043e\u0431\u044b\u0442\u0438\u0435 \u0441\u0435\u043a\u0442\u043e\u0440\u0430: \u0433\u0440\u0430\u043d\u0438\u0447\u043d\u044b\u0435 \u0437\u0430\u043b\u043f\u044b, \u0440\u0435\u0434\u043a\u0438\u0435 \u043e\u0441\u043a\u043e\u043b\u043a\u0438 \u0438 \u0448\u0442\u043e\u0440\u043c\u043e\u0432\u044b\u0435 \u0432\u043e\u043b\u043d\u044b.",
    },
    breaker_ring: {
      title: "\u041a\u043e\u043b\u044c\u0446\u043e \u0440\u0435\u0437\u0447\u0438\u043a\u043e\u0432",
      desc: "\u0424\u0438\u043d\u0430\u043b, \u0433\u0434\u0435 \u0440\u0435\u0437\u0447\u0438\u043a\u0438 \u0441\u0445\u043b\u043e\u043f\u044b\u0432\u0430\u044e\u0442 \u043a\u043e\u043b\u044c\u0446\u043e \u0432\u043e\u043a\u0440\u0443\u0433 \u043a\u0430\u0440\u0430\u0432\u0430\u043d\u0430.",
    },
    core_monsoon: {
      title: "\u041c\u0443\u0441\u0441\u043e\u043d \u044f\u0434\u0435\u0440",
      desc: "\u0428\u043a\u0432\u0430\u043b \u0434\u043e\u0431\u044b\u0447\u0438: \u043e\u0441\u043a\u043e\u043b\u043a\u0438, heavy-\u0432\u044b\u0431\u0440\u043e\u0441\u044b \u0438 \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u044b\u0439 \u043e\u0433\u043e\u043d\u044c \u0443 \u043b\u0438\u043d\u0438\u0438 \u043f\u0435\u0440\u0435\u0440\u0430\u0431\u043e\u0442\u0447\u0438\u043a\u0430.",
    },
  },
};

const PATTERN_TITLES: Record<Locale, Record<string, string>> = {
  en: {
    pincer_chasers: "Pincer Chasers",
    snipers: "Snipers",
    cutters_window: "Cutter Window",
    hunter_sweep: "Hunter Sweep",
    crossfire_lane: "Crossfire Lane",
    hook_and_cut: "Hook and Cut",
    siege_circle: "Siege Circle",
    crossfire_overseer: "Crossfire Overseer",
    blade_dancer: "Blade Dancer",
    scrap_juggernaut: "Scrap Juggernaut",
    salvage_storm: "Salvage Storm",
    ion_tempest: "Ion Tempest",
    breaker_ring: "Breaker Ring",
    core_monsoon: "Core Monsoon",
  },
  ru: {
    pincer_chasers: "Клещи",
    snipers: "Снайперы",
    cutters_window: "Окно резчиков",
    hunter_sweep: "Охотничий заход",
    crossfire_lane: "Линия перекрёстного огня",
    hook_and_cut: "Зацеп и рез",
    siege_circle: "Кольцо осады",
    crossfire_overseer: "\u0421\u043c\u043e\u0442\u0440\u044f\u0449\u0438\u0439 \u043f\u0435\u0440\u0435\u043a\u0440\u0451\u0441\u0442\u043d\u043e\u0433\u043e \u043e\u0433\u043d\u044f",
    blade_dancer: "\u0422\u0430\u043d\u0446\u043e\u0440 \u043b\u0435\u0437\u0432\u0438\u0439",
    scrap_juggernaut: "\u041b\u043e\u043c\u043e\u0432\u043e\u0439 \u0434\u0436\u0430\u0433\u0433\u0435\u0440\u043d\u0430\u0443\u0442",
    salvage_storm: "\u0428\u043a\u0432\u0430\u043b \u0434\u043e\u0431\u044b\u0447\u0438",
    ion_tempest: "\u0418\u043e\u043d\u043d\u044b\u0439 \u0442\u0435\u043c\u043f\u0435\u0441\u0442",
    breaker_ring: "\u041a\u043e\u043b\u044c\u0446\u043e \u0440\u0435\u0437\u0447\u0438\u043a\u043e\u0432",
    core_monsoon: "\u041c\u0443\u0441\u0441\u043e\u043d \u044f\u0434\u0435\u0440",
  },
};

export function resolveLocale(setting: LanguageSetting, languages: readonly string[] | null = null): Locale {
  if (setting === "ru" || setting === "en") return setting;
  const nav = languages ?? getNavigatorLanguages();
  for (const language of nav) {
    const normalized = `${language}`.toLowerCase();
    if (normalized.startsWith("ru")) return "ru";
    if (normalized.startsWith("en")) return "en";
  }
  return "en";
}

export function normalizeLanguageSetting(value: unknown): LanguageSetting {
  if (value === "ru" || value === "en" || value === "auto") return value;
  return "auto";
}

export function t(locale: Locale, key: string, params?: Record<string, unknown>): string {
  const table = MESSAGES[locale] ?? MESSAGES.en;
  const fallback = MESSAGES.en[key];
  const value = table[key] ?? fallback;
  if (typeof value === "function") return value(params);
  return value ?? key;
}

export function formatNumber(locale: Locale, value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(Math.floor(safe));
}

export function formatDecimal(locale: Locale, value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(INTL_LOCALES[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatVolume(locale: Locale, value: number): string {
  if (value <= 0) return t(locale, "settings.off");
  return `${Math.round(value * 100)}%`;
}

export function formatResource(locale: Locale, currency: string, amount: number): string {
  return `${formatNumber(locale, amount)} ${resourceLabel(locale, currency, amount)}`;
}

export function formatQualityLabel(locale: Locale, quality: "auto" | "low" | "medium" | "high"): string {
  return t(locale, `settings.${quality}`);
}

export function getLanguageSettingLabel(locale: Locale, setting: LanguageSetting): string {
  if (setting === "ru") return "RU";
  if (setting === "en") return "EN";
  return t(locale, "settings.auto");
}

export function getLanguageName(locale: Locale, setting: LanguageSetting): string {
  const resolved = setting === "auto" ? resolveLocale("auto") : setting;
  const key = setting === "auto" ? "language.auto" : `language.${resolved}`;
  return t(locale, key);
}

export function getUpgradeCopy(locale: Locale, upgrade: RunUpgradeDef): UpgradeCopy {
  const copy = UPGRADE_COPY[locale][upgrade.id] ?? UPGRADE_COPY.en[upgrade.id];
  return {
    title: copy?.title ?? upgrade.ui?.title ?? upgrade.name,
    desc: copy?.desc ?? upgrade.ui?.desc ?? "",
  };
}

export function getMetaNodeName(locale: Locale, nodeId: string, fallbackName: string): string {
  return (
    EXTRA_META_NODE_COPY[locale][nodeId]?.title ??
    EXTRA_META_NODE_COPY.en[nodeId]?.title ??
    META_NODE_COPY[locale][nodeId]?.title ??
    META_NODE_COPY.en[nodeId]?.title ??
    fallbackName
  );
}

export function getMetaNodeDescription(locale: Locale, nodeId: string): string {
  return (
    EXTRA_META_NODE_COPY[locale][nodeId]?.desc ??
    EXTRA_META_NODE_COPY.en[nodeId]?.desc ??
    META_NODE_COPY[locale][nodeId]?.desc ??
    META_NODE_COPY.en[nodeId]?.desc ??
    t(locale, "menu.workshopHint")
  );
}

export function getDailyVariantCopy(locale: Locale, variantId: string, fallbackTitle = "", fallbackDesc = ""): UpgradeCopy {
  const copy =
    EXTRA_DAILY_VARIANT_COPY[locale][variantId] ??
    EXTRA_DAILY_VARIANT_COPY.en[variantId] ??
    DAILY_VARIANT_COPY[locale][variantId] ??
    DAILY_VARIANT_COPY.en[variantId];
  return {
    title: copy?.title ?? fallbackTitle ?? variantId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getDailyRotationCopy(
  locale: Locale,
  rotationId: string,
  fallbackBadge = "",
  fallbackTitle = "",
  fallbackDesc = ""
): RotationCopy {
  const copy = DAILY_ROTATION_COPY[locale][rotationId] ?? DAILY_ROTATION_COPY.en[rotationId];
  return {
    badge: copy?.badge ?? fallbackBadge ?? rotationId,
    title: copy?.title ?? fallbackTitle ?? rotationId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getLiveopsEventCopy(
  locale: Locale,
  eventId: "comeback" | "tomorrow_offer",
  fallbackTitle = "",
  fallbackDesc = ""
): UpgradeCopy {
  const copy = LIVEOPS_EVENT_COPY[locale][eventId] ?? LIVEOPS_EVENT_COPY.en[eventId];
  return {
    title: copy?.title ?? fallbackTitle ?? eventId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getLevelModifierCopy(locale: Locale, modifierId: string, fallbackTitle = "", fallbackDesc = ""): UpgradeCopy {
  const copy = LEVEL_MODIFIER_COPY[locale][modifierId] ?? LEVEL_MODIFIER_COPY.en[modifierId];
  return {
    title: copy?.title ?? fallbackTitle ?? modifierId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getLevelObjectiveCopy(locale: Locale, objectiveId: string, fallbackTitle = "", fallbackDesc = ""): UpgradeCopy {
  const copy = LEVEL_OBJECTIVE_COPY[locale][objectiveId] ?? LEVEL_OBJECTIVE_COPY.en[objectiveId];
  return {
    title: copy?.title ?? fallbackTitle ?? objectiveId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getLevelFinaleCopy(locale: Locale, finaleId: string, fallbackTitle = "", fallbackDesc = ""): UpgradeCopy {
  const copy = LEVEL_FINALE_COPY[locale][finaleId] ?? LEVEL_FINALE_COPY.en[finaleId];
  return {
    title: copy?.title ?? fallbackTitle ?? finaleId,
    desc: copy?.desc ?? fallbackDesc ?? "",
  };
}

export function getPatternTitle(locale: Locale, patternId?: string | null): string {
  if (!patternId) return t(locale, "wave.pressure");
  return PATTERN_TITLES[locale][patternId] ?? PATTERN_TITLES.en[patternId] ?? humanizePatternId(patternId);
}

export function getEnemyLabel(locale: Locale, type: EnemyType): string {
  return t(locale, `enemy.${type}`);
}

export function getRarityLabel(locale: Locale, rarity: Rarity): string {
  return t(locale, `rarity.${rarity}`);
}

export function getUpgradeTagLabel(locale: Locale, tag: string): string {
  const key = `tag.${tag}`;
  const label = t(locale, key);
  return label === key ? humanizePatternId(tag).toUpperCase() : label;
}

function getNavigatorLanguages(): string[] {
  try {
    const langs = navigator.languages;
    if (Array.isArray(langs) && langs.length > 0) return langs.map((entry) => `${entry}`);
  } catch {
    // ignore
  }

  try {
    if (typeof navigator.language === "string" && navigator.language.length > 0) return [navigator.language];
  } catch {
    // ignore
  }

  return ["en"];
}

function resourceLabel(locale: Locale, currency: string, amount: number): string {
  if (locale === "ru") {
    if (currency === "cores") return pluralRu(amount, "ядро", "ядра", "ядер");
    return pluralRu(amount, "болт", "болта", "болтов");
  }

  if (currency === "cores") return Math.abs(amount) === 1 ? "core" : "cores";
  return Math.abs(amount) === 1 ? "bolt" : "bolts";
}

function pluralRu(amount: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.floor(amount));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function humanizePatternId(value: string): string {
  return value
    .split("_")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}
