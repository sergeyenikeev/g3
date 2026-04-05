import type { EnemyType, Rarity, RunUpgradeDef } from "../data/types";

export type Locale = "en" | "ru";
export type LanguageSetting = "auto" | Locale;

type MessageValue = string | ((params?: Record<string, unknown>) => string);
type UpgradeCopy = { title: string; desc: string };

const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  ru: "ru-RU",
};

const MESSAGES: Record<Locale, Record<string, MessageValue>> = {
  en: {
    "app.title": "MAGNET CARAVAN",
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
    "menu.tagline": "Flip the field. Bank the haul. Outlast the swarm.",
    "menu.heroLead": "Escort the magnet rig through scrap storms and feed the recycler before the swarm closes in.",
    "menu.controls": "WASD/Arrows: move | Space: flip | Shift: dash",
    "menu.best": (p) => `Best wave: ${p?.bestWave ?? 0} | Best bolts: ${p?.bestBolts ?? 0}`,
    "menu.wallet": (p) => `Wallet: ${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.stockpile": (p) => `Stockpile: ${p?.bolts ?? "0 bolts"} | ${p?.cores ?? "0 cores"}`,
    "menu.workshopHint": "Permanent upgrades apply to all future runs.",
    "menu.workshopFooter": "Buy upgrades with salvaged bolts and rare cores.",
    "menu.close": "CLOSE",
    "menu.level": (p) => `Level ${p?.level ?? 0}/${p?.maxLevel ?? 0}`,
    "menu.buy": "BUY",
    "menu.locked": "LOCKED",
    "menu.installedButton": "INSTALLED",
    "menu.maxed": "MAXED",
    "menu.installedList": (p) => `Installed: ${p?.items ?? ""}`,
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
    "language.auto": "Auto",
    "language.ru": "Russian",
    "language.en": "English",
    "pause.open": "SET",
    "pause.title": "SETTINGS",
    "pause.hint": "Run paused. Changes apply immediately.",
    "pause.resume": "RESUME",
    "pause.menu": "MENU",
    "results.title": "RUN OVER",
    "results.boost": (p) => `BOOST RESULTS x${p?.mult ?? "2"} (Rewarded)`,
    "results.restart": "RESTART",
    "results.menu": "MENU",
    "results.stats": (p) =>
      `Wave: ${p?.wave ?? 0}\nBolts: ${p?.bolts ?? 0}\nCores: ${p?.cores ?? 0}\nWorkshop: +${p?.rewardBolts ?? 0} bolts | +${p?.rewardCores ?? 0} cores`,
    "upgrade.title": (p) => `UPGRADE PICK - WAVE ${p?.wave ?? 1}`,
    "upgrade.reroll": "REROLL (Rewarded)",
    "hud.hp": "HP",
    "hud.wave": "Wave",
    "hud.bolts": "Bolts",
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
    "revive.accept": "REVIVE (Rewarded)",
    "revive.decline": "NO THANKS",
    "wave.upgradePick": "Upgrade pick",
    "wave.trainingLoop": "Training: learn the salvage loop",
    "wave.quickTest": "Quick test wave",
    "wave.breather": "Breather wave: harvest and reset",
    "wave.pressure": "Pressure wave",
    "status.shield": (p) => `Shield ${p?.value ?? 0}`,
    "status.clamp": (p) => `Clamp x${p?.value ?? 0}`,
    "status.anchor": (p) => `Anchor ${p?.value ?? 0}s`,
    "status.anchorReady": "Anchor ready",
    "status.vacuum": (p) => `Vacuum ${p?.value ?? 0}s`,
    "status.vacuumReady": "Vacuum ready",
    "status.drone": "Drone online",
    "status.mines": (p) => `Mines ${p?.value ?? 0}`,
    "status.corePull": (p) => `Core pull x${p?.value ?? "1.00"}`,
    "enemy.chaser": "Chaser",
    "enemy.shooter": "Shooter",
    "enemy.cutter": "Cutter",
    "rarity.common": "COMMON",
    "rarity.uncommon": "UNCOMMON",
    "rarity.rare": "RARE",
    "rarity.epic": "EPIC",
  },
  ru: {
    "app.title": "МАГНИТНЫЙ КАРАВАН",
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
    "menu.tagline": "Переверни поле. Сдай лом. Переживи натиск.",
    "menu.heroLead": "Веди магнитный тягач сквозь штормы лома и корми переработчик, пока рой не сомкнулся.",
    "menu.controls": "WASD/Стрелки: движение | Пробел: флип | Shift: рывок",
    "menu.best": (p) => `Лучшая волна: ${p?.bestWave ?? 0} | Лучшие болты: ${p?.bestBolts ?? 0}`,
    "menu.wallet": (p) => `Кошелёк: ${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.stockpile": (p) => `Запас: ${p?.bolts ?? "0 болтов"} | ${p?.cores ?? "0 ядер"}`,
    "menu.workshopHint": "Постоянные улучшения действуют во всех будущих заездах.",
    "menu.workshopFooter": "Покупай улучшения за собранные болты и редкие ядра.",
    "menu.close": "ЗАКРЫТЬ",
    "menu.level": (p) => `Уровень ${p?.level ?? 0}/${p?.maxLevel ?? 0}`,
    "menu.buy": "КУПИТЬ",
    "menu.locked": "НЕТ СРЕДСТВ",
    "menu.installedButton": "УСТАНОВЛЕНО",
    "menu.maxed": "МАКС.",
    "menu.installedList": (p) => `Установлено: ${p?.items ?? ""}`,
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
    "language.auto": "Авто",
    "language.ru": "Русский",
    "language.en": "Английский",
    "pause.open": "НАСТР.",
    "pause.title": "НАСТРОЙКИ",
    "pause.hint": "Заезд поставлен на паузу. Изменения применяются сразу.",
    "pause.resume": "ПРОДОЛЖИТЬ",
    "pause.menu": "В МЕНЮ",
    "results.title": "ЗАЕЗД ОКОНЧЕН",
    "results.boost": (p) => `УСИЛИТЬ НАГРАДЫ x${p?.mult ?? "2"} (за рекламу)`,
    "results.restart": "ЗАНОВО",
    "results.menu": "МЕНЮ",
    "results.stats": (p) =>
      `Волна: ${p?.wave ?? 0}\nБолты: ${p?.bolts ?? 0}\nЯдра: ${p?.cores ?? 0}\nМастерская: +${p?.rewardBolts ?? 0} болтов | +${p?.rewardCores ?? 0} ядер`,
    "upgrade.title": (p) => `ВЫБОР УЛУЧШЕНИЯ - ВОЛНА ${p?.wave ?? 1}`,
    "upgrade.reroll": "ПЕРЕБРОС (за рекламу)",
    "hud.hp": "HP",
    "hud.wave": "Волна",
    "hud.bolts": "Болты",
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
    "revive.accept": "ПРОДОЛЖИТЬ (за рекламу)",
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
    "status.drone": "Дрон в строю",
    "status.mines": (p) => `Мины ${p?.value ?? 0}`,
    "status.corePull": (p) => `Тяга ядра x${p?.value ?? "1.00"}`,
    "enemy.chaser": "Таран",
    "enemy.shooter": "Стрелок",
    "enemy.cutter": "Резчик",
    "rarity.common": "ОБЫЧНОЕ",
    "rarity.uncommon": "НЕОБЫЧНОЕ",
    "rarity.rare": "РЕДКОЕ",
    "rarity.epic": "ЭПИЧЕСКОЕ",
  },
};

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
    dash_module: { title: "Dash Module", desc: "Unlock Dash for this run and reduce its cooldown by 15%." },
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
    dash_module: { title: "Модуль рывка", desc: "Открывает рывок в этом заезде и снижает его кд на 15%." },
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
      title: "Dash Module",
      desc: "Unlock Dash as a default tool for every future run.",
    },
    meta_recycler_overdrive: {
      title: "Recycler Overdrive",
      desc: "Permanent recycler speed, heavy-scrap payout and heal upgrades.",
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
      title: "Модуль рывка",
      desc: "Открывает рывок как постоянный инструмент во всех будущих заездах.",
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

const PATTERN_TITLES: Record<Locale, Record<string, string>> = {
  en: {
    pincer_chasers: "Pincer Chasers",
    snipers: "Snipers",
    cutters_window: "Cutter Window",
    hunter_sweep: "Hunter Sweep",
    crossfire_lane: "Crossfire Lane",
    hook_and_cut: "Hook and Cut",
    siege_circle: "Siege Circle",
  },
  ru: {
    pincer_chasers: "Клещи",
    snipers: "Снайперы",
    cutters_window: "Окно резчиков",
    hunter_sweep: "Охотничий заход",
    crossfire_lane: "Линия перекрёстного огня",
    hook_and_cut: "Зацеп и рез",
    siege_circle: "Кольцо осады",
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
  return META_NODE_COPY[locale][nodeId]?.title ?? META_NODE_COPY.en[nodeId]?.title ?? fallbackName;
}

export function getMetaNodeDescription(locale: Locale, nodeId: string): string {
  return META_NODE_COPY[locale][nodeId]?.desc ?? META_NODE_COPY.en[nodeId]?.desc ?? t(locale, "menu.workshopHint");
}

export function getDailyVariantCopy(locale: Locale, variantId: string, fallbackTitle = "", fallbackDesc = ""): UpgradeCopy {
  const copy = DAILY_VARIANT_COPY[locale][variantId] ?? DAILY_VARIANT_COPY.en[variantId];
  return {
    title: copy?.title ?? fallbackTitle ?? variantId,
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
