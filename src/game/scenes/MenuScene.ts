import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { MissionObjectiveType } from "../../data/types";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart, type DailyAttemptsInfo } from "../daily/dailyAttempts";
import { claimLoginReward, getLoginRewardStatus, LOGIN_REWARD_DAY_COUNT } from "../daily/loginRewards";
import {
  claimComebackReward,
  claimMissionReward,
  claimStreakReward,
  consumeOnboardingBoost,
  getActiveDailyRotation,
  getBoardId,
  getComebackStatus,
  getMissionStatuses,
  getOnboardingBoostStatus,
  getStreakStatus,
  getTomorrowOfferPreview,
  type MissionStatus,
} from "../liveops/liveops";
import { getMetaNodeCost, getMetaNodeLevel, getMetaWalletAmount, purchaseMetaNode } from "../meta/metaProgression";
import {
  filterLeaderboardEntries,
  getLeaderboardCareerMilestones,
  getLeaderboardCareerProgress,
  getLeaderboardDivision,
  getLeaderboardNextDivision,
  getUnlockedLeaderboardCareerMilestones,
  getNextLeaderboardCareerMilestone,
  type LeaderboardFilter,
} from "../run/leaderboard";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import { bindPageLifecycle } from "../../platform/pageLifecycle";
import type { PlatformAdapter, PlatformLeaderboardSnapshot } from "../../platform/platformAdapter";
import { getPlatformNowMs, signalPlatformGameReady, addPlatformLifecycleListener } from "../../platform/platformRuntime";
import {
  sanitizePilotName,
  type LeaderboardCareerMilestoneId,
  type LeaderboardDivisionId,
  type SaveData,
} from "../../platform/save/saveManager";
import type { SaveManager } from "../../platform/save/saveManager";
import { createEntityTextures } from "../../visual/EntityTextureFactory";
import { getMetaNodeBadgeSpecs } from "../upgrades/upgradeBadges";
import type { PendingStartBoosterPayload } from "../run/runState";
import {
  type LanguageSetting,
  type Locale,
  formatNumber,
  formatQualityLabel,
  formatResource,
  formatVolume,
  getDailyVariantCopy,
  getLanguageSettingLabel,
  getMetaNodeDescription,
  getMetaNodeName,
  normalizeLanguageSetting,
  resolveLocale,
  t,
} from "../../i18n/localization";

const VOLUME_STEPS = [0, 0.3, 0.6, 0.8, 1] as const;
const WORKSHOP_PANEL_WIDTH = 716;
const WORKSHOP_PANEL_HEIGHT = 840;
const UTILITY_PANEL_WIDTH = 472;
const UTILITY_PANEL_HEIGHT = 360;
const MISSIONS_PANEL_WIDTH = 760;
const MISSIONS_PANEL_HEIGHT = 780;
const MENU_LAYOUT_BREAKPOINTS = {
  fullWidth: 1440,
  fullHeight: 820,
  minimalWidth: 1100,
  minimalHeight: 760,
} as const;

type MenuLayoutMode = "full" | "compact" | "minimal";

export class MenuScene extends Phaser.Scene {
  private staticData!: StaticGameData;
  private ads!: AdsManager;
  private analytics!: AnalyticsAdapter;
  private saveManager!: SaveManager;
  private platformAdapter: PlatformAdapter | null = null;
  private saveData: SaveData | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private walletText: Phaser.GameObjects.Text | null = null;
  private workshopDim!: Phaser.GameObjects.Rectangle;
  private workshopBox!: Phaser.GameObjects.Container;
  private workshopWalletText!: Phaser.GameObjects.Text;
  private workshopHintText!: Phaser.GameObjects.Text;
  private workshopFooterText!: Phaser.GameObjects.Text;
  private workshopBuildChips: Phaser.GameObjects.Container[] = [];
  private workshopCards: Phaser.GameObjects.Container[] = [];
  private leaderboardDim!: Phaser.GameObjects.Rectangle;
  private leaderboardBox!: Phaser.GameObjects.Container;
  private leaderboardHintText!: Phaser.GameObjects.Text;
  private leaderboardCareerTitleText!: Phaser.GameObjects.Text;
  private leaderboardCareerText!: Phaser.GameObjects.Text;
  private leaderboardFooterText!: Phaser.GameObjects.Text;
  private leaderboardPlatformText!: Phaser.GameObjects.Text;
  private leaderboardEmptyPanel!: Phaser.GameObjects.Rectangle;
  private leaderboardEmptyText!: Phaser.GameObjects.Text;
  private leaderboardFilterButtons: Array<{
    filter: LeaderboardFilter;
    button: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }> = [];
  private leaderboardRows: Array<{
    bg: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  }> = [];
  private leaderboardFilter: LeaderboardFilter = "all";
  private latestLeaderboardFilter: LeaderboardFilter = "all";
  private latestLeaderboardEntryId: string | null = null;
  private latestLeaderboardRank: number | null = null;
  private latestLeaderboardIsRecord = false;
  private latestPromotionDivision: LeaderboardDivisionId | null = null;
  private latestPromotionReward = { bolts: 0, cores: 0 };
  private latestCareerMilestones: LeaderboardCareerMilestoneId[] = [];
  private latestCareerMilestoneReward = { bolts: 0, cores: 0 };
  private leaderboardRefreshNonce = 0;
  private weeklyRaceRefreshNonce = 0;
  private workshopBusy = false;
  private locale: Locale = "en";
  private languageSetting: LanguageSetting = "auto";
  private audioEnabled = false;
  private menuMusic: Phaser.Sound.BaseSound | null = null;
  private menuTime = 0;
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgTile!: Phaser.GameObjects.TileSprite;
  private menuGlowLeft!: Phaser.GameObjects.Image;
  private menuGlowRight!: Phaser.GameObjects.Image;
  private menuPanel!: Phaser.GameObjects.Rectangle;
  private dailyPanel!: Phaser.GameObjects.Rectangle;
  private heroPanel!: Phaser.GameObjects.Rectangle;
  private heroRecycler!: Phaser.GameObjects.Image;
  private heroTruck!: Phaser.GameObjects.Image;
  private heroEscortA!: Phaser.GameObjects.Image;
  private heroEscortB!: Phaser.GameObjects.Image;
  private heroThreatA!: Phaser.GameObjects.Image;
  private heroThreatB!: Phaser.GameObjects.Image;
  private heroCaptionText!: Phaser.GameObjects.Text;
  private heroHintText!: Phaser.GameObjects.Text;
  private heroBaseX = 0;
  private heroBaseY = 0;
  private suspendReasons = new Set<string>();

  constructor() {
    super("menu");
  }

  create(): void {
    this.staticData = this.registry.get("staticGameData") as StaticGameData;
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.analytics = this.registry.get("analytics") as AnalyticsAdapter;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.platformAdapter = (this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null;
    this.saveData = (this.registry.get("saveData") as SaveData | undefined) ?? this.saveManager.get();
    const save = this.saveData;
    this.languageSetting = normalizeLanguageSetting(save?.settings?.language);
    this.locale = this.resolveLocaleSetting(this.languageSetting);
    this.registry.set("languageSetting", this.languageSetting);
    this.registry.set("locale", this.locale);
    this.latestLeaderboardEntryId = ((this.registry.get("lastLeaderboardEntryId") as string | undefined) ?? null) || null;
    this.latestLeaderboardRank = (this.registry.get("lastLeaderboardRank") as number | undefined) ?? null;
    this.latestLeaderboardIsRecord = Boolean(this.registry.get("lastLeaderboardIsRecord"));
    this.latestPromotionDivision = ((this.registry.get("lastLeaderboardPromotionDivision") as LeaderboardDivisionId | undefined) ?? null) || null;
    this.latestPromotionReward = {
      bolts: (this.registry.get("lastLeaderboardPromotionBolts") as number | undefined) ?? 0,
      cores: (this.registry.get("lastLeaderboardPromotionCores") as number | undefined) ?? 0,
    };
    this.latestCareerMilestones = sanitizeCareerMilestoneIds(this.registry.get("lastLeaderboardCareerMilestones"));
    this.latestCareerMilestoneReward = {
      bolts: Math.max(0, Math.floor((this.registry.get("lastLeaderboardCareerMilestoneBolts") as number | undefined) ?? 0)),
      cores: Math.max(0, Math.floor((this.registry.get("lastLeaderboardCareerMilestoneCores") as number | undefined) ?? 0)),
    };
    const freshWeeklyRank = (this.registry.get("lastWeeklyLeaderboardRank") as number | undefined) ?? null;
    const freshWeeklyDelta = (this.registry.get("lastWeeklyLeaderboardDelta") as number | undefined) ?? null;
    const freshWeeklyDebut = Boolean(this.registry.get("lastWeeklyLeaderboardDebut"));
    this.registry.set("lastWeeklyLeaderboardDelta", null);
    this.registry.set("lastWeeklyLeaderboardDebut", false);
    const storedLeaderboardFilter =
      (this.registry.get("lastLeaderboardFilter") as LeaderboardFilter | undefined) ?? (this.latestLeaderboardIsRecord ? "run" : "all");
    this.latestLeaderboardFilter = this.normalizeLeaderboardFilter(this.saveData?.leaderboard.entries ?? [], storedLeaderboardFilter);
    this.leaderboardFilter = this.normalizeLeaderboardFilter(this.saveData?.leaderboard.entries ?? [], this.latestLeaderboardFilter);
    createEntityTextures(this);
    this.cameras.main.setBackgroundColor(0x060a10);
    this.createMenuBackdrop();
    this.input.once("pointerdown", () => this.enableAudio());
    this.input.keyboard?.once("keydown", () => this.enableAudio());
    if (!(this.sound as any)?.locked) this.enableAudio();
    const releasePageLifecycle = bindPageLifecycle({
      hide: () => this.setExternalPause("page", true),
      show: () => this.setExternalPause("page", false),
    });
    const releasePlatformLifecycle = addPlatformLifecycleListener(this.platformAdapter, {
      pause: () => this.setExternalPause("platform", true),
      resume: () => this.setExternalPause("platform", false),
    });
    const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
    const boosterEnabled = Boolean(boosterCfg?.enabled);
    let rewardBoostEnabled = false;
    let missionsExpanded = false;
    let utilityOpen = false;
    let currentLayoutMode: MenuLayoutMode = getMenuLayoutMode(this.scale.width, this.scale.height);

    const title = this.add
      .text(0, 0, t(this.locale, "app.title"), {
        fontSize: "52px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setShadow(0, 0, "#5cc8ff", 24, true, true)
      .setOrigin(0.5);

    const taglineText = this.add
      .text(0, 0, t(this.locale, "menu.tagline"), {
        fontSize: "18px",
        color: "#7fdfff",
        fontStyle: "700",
        align: "center",
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5)
      .setLineSpacing(4);

    const bestText = this.add
      .text(
        0,
        0,
        buildMenuBestText(this.locale, save, 3),
        {
          fontSize: "15px",
          color: "#98b7c7",
          align: "center",
          wordWrap: { width: 420 },
        }
      )
      .setOrigin(0.5)
      .setLineSpacing(4);

    this.walletText = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0);

    const btnWorkshop = this.add
      .rectangle(0, 0, 196, 40, 0x0f1720, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd166, 0.82)
      .setInteractive({ useHandCursor: true });
    const labelWorkshop = this.add
      .text(0, 0, t(this.locale, "menu.workshop"), {
        fontSize: "16px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const btnLeaderboard = this.add
      .rectangle(0, 0, 196, 36, 0x0f1720, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, this.latestLeaderboardIsRecord ? 0x57c27d : 0x5cc8ff, 0.82)
      .setInteractive({ useHandCursor: true });
    const labelLeaderboard = this.add
      .text(0, 0, t(this.locale, "menu.leaderboard"), {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const btnPilot = this.add
      .rectangle(0, 0, 196, 36, 0x0f1720, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelPilot = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnQuality = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelQuality = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnSfx = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelSfx = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnMusic = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelMusic = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnLanguage = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelLanguage = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const btnUtility = this.add
      .rectangle(0, 0, 112, 34, 0x121a24, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x5cc8ff, 0.76)
      .setInteractive({ useHandCursor: true });
    const labelUtility = this.add
      .text(0, 0, t(this.locale, "pause.open"), {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const order: SaveData["settings"]["visualQuality"][] = ["auto", "low", "medium", "high"];
    let qualityPref: SaveData["settings"]["visualQuality"] = save?.settings?.visualQuality ?? "auto";
    let sfxVolume = snapVolumeStep(save?.settings?.sfxVolume ?? 0.8);
    let musicVolume = snapVolumeStep(save?.settings?.musicVolume ?? 0.6);
    const languageOrder: LanguageSetting[] = ["auto", "ru", "en"];
    const pilotNamePref = save?.settings?.pilotName ?? "";

    const applyQualityLabel = (q: SaveData["settings"]["visualQuality"]) => {
      const label = formatQualityLabel(this.locale, q);
      labelQuality.setText(`${t(this.locale, "settings.gfx")}: ${label}`);
      const stroke = q === "low" ? 0x6e7a86 : q === "medium" ? 0x2d7bff : q === "high" ? 0x3af2ff : 0x3aa4d4;
      btnQuality.setStrokeStyle(2, stroke, 0.8);
    };
    const applyVolumeLabel = (
      button: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      prefixKey: "settings.sfx" | "settings.music",
      value: number
    ) => {
      label.setText(formatVolumeLabel(this.locale, prefixKey, value));
      const stroke = value <= 0 ? 0x5f6b76 : prefixKey === "settings.sfx" ? 0x3aa4d4 : 0x57c27d;
      button.setStrokeStyle(2, stroke, value <= 0 ? 0.55 : 0.8);
    };
    const applyLanguageLabel = (setting: LanguageSetting) => {
      labelLanguage.setText(`${t(this.locale, "settings.language")}: ${getLanguageSettingLabel(this.locale, setting)}`);
      const stroke = setting === "auto" ? 0xffd166 : setting === "ru" ? 0x57c27d : 0x5cc8ff;
      btnLanguage.setStrokeStyle(2, stroke, 0.82);
    };
    const applyPilotLabel = (pilotName: string) => {
      labelPilot.setText(t(this.locale, "menu.pilotButton", { name: pilotName || t(this.locale, "menu.pilotAuto") }));
    };
    applyQualityLabel(qualityPref);
    applyVolumeLabel(btnSfx, labelSfx, "settings.sfx", sfxVolume);
    applyVolumeLabel(btnMusic, labelMusic, "settings.music", musicVolume);
    applyLanguageLabel(this.languageSetting);
    applyPilotLabel(pilotNamePref);

    btnQuality.on("pointerdown", () => {
      const idx = order.indexOf(qualityPref);
      const next = order[(idx + 1) % order.length]!;
      void this.setVisualQuality(next).then(() => {
        qualityPref = next;
        applyQualityLabel(next);
        this.toast(t(this.locale, "toast.graphics", { value: formatQualityLabel(this.locale, next) }));
      });
    });

    btnSfx.on("pointerdown", () => {
      const next = nextVolumeStep(sfxVolume);
      void this.setAudioVolume("sfxVolume", next).then(() => {
        sfxVolume = next;
        applyVolumeLabel(btnSfx, labelSfx, "settings.sfx", next);
        this.toast(t(this.locale, "toast.sfx", { value: formatVolume(this.locale, next) }));
      });
    });

    btnMusic.on("pointerdown", () => {
      const next = nextVolumeStep(musicVolume);
      void this.setAudioVolume("musicVolume", next).then(() => {
        musicVolume = next;
        applyVolumeLabel(btnMusic, labelMusic, "settings.music", next);
        this.toast(t(this.locale, "toast.music", { value: formatVolume(this.locale, next) }));
      });
    });

    btnLanguage.on("pointerdown", () => {
      const idx = languageOrder.indexOf(this.languageSetting);
      const next = languageOrder[(idx + 1) % languageOrder.length]!;
      void this.setLanguage(next).then(() => {
        this.languageSetting = next;
        this.locale = this.resolveLocaleSetting(next);
        this.registry.set("languageSetting", next);
        this.registry.set("locale", this.locale);
        this.scene.restart();
      });
    });
    btnPilot.on("pointerdown", () => void this.editPilotName());

    const btnPlay = this.add
      .rectangle(0, 0, 308, 68, 0x13283d, 0.98)
      .setStrokeStyle(2, 0xffd166, 0.94)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(0, 0, t(this.locale, "menu.play"), { fontSize: "30px", color: "#f7fbff", fontStyle: "700" })
      .setOrigin(0.5);

    btnPlay.on("pointerdown", () => {
      const onboarding = getOnboardingBoostStatus(this.saveManager.get(), this.staticData.liveops);
      void (boosterEnabled && rewardBoostEnabled && !onboarding.eligible ? this.startRunBoosted() : startStandardRun());
    });

    const btnPlayBoost = this.add
      .rectangle(0, 0, 308, 52, 0x13221e, 0.96)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlayBoost = this.add
      .text(0, 0, t(this.locale, "menu.playBoost"), { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnPlayBoost.setVisible(boosterEnabled);
    labelPlayBoost.setVisible(boosterEnabled);
    btnPlayBoost.on("pointerdown", () => void this.startRunBoosted());

    const btnTraining = this.add
      .rectangle(0, 0, 308, 46, 0x0f1720, 0.96)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelTraining = this.add
      .text(0, 0, t(this.locale, "menu.training"), { fontSize: "18px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnTraining.on("pointerdown", () => {
      this.stopMenuMusic();
      this.scene.start("game", { mode: "tutorial" });
      this.scene.launch("ui");
    });

    btnWorkshop.on("pointerdown", () => this.showWorkshop());
    btnLeaderboard.on("pointerdown", () => this.showLeaderboard());

    const btnDaily = this.add
      .rectangle(0, 0, 308, 56, 0x121a24, 0.96)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(0, 0, t(this.locale, "menu.daily"), { fontSize: "18px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const btnDailyBoost = this.add
      .rectangle(0, 0, 308, 46, 0x0f1720, 0.96)
      .setStrokeStyle(2, 0x57c27d, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelDailyBoost = this.add
      .text(0, 0, t(this.locale, "menu.dailyBoost"), {
        fontSize: "13px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    btnDailyBoost.setVisible(boosterEnabled);
    labelDailyBoost.setVisible(boosterEnabled);

    const btnMissions = this.add
      .rectangle(0, 0, 308, 46, 0x0f1720, 0.96)
      .setStrokeStyle(2, 0x5cc8ff, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelMissions = this.add
      .text(0, 0, t(this.locale, "menu.missions"), {
        fontSize: "18px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const boostToggleBg = this.add
      .rectangle(0, 0, 10, 10, 0x101922, 0.96)
      .setStrokeStyle(2, 0x57c27d, 0.58)
      .setInteractive({ useHandCursor: true });
    const boostToggleTrack = this.add.rectangle(0, 0, 42, 22, 0x0b1118, 0.98).setStrokeStyle(2, 0x38566f, 0.74);
    const boostToggleFill = this.add.rectangle(0, 0, 42, 22, 0x57c27d, 0.26).setVisible(false);
    const boostToggleKnob = this.add.rectangle(0, 0, 16, 16, 0xd9f2ff, 0.98).setStrokeStyle(1, 0x5cc8ff, 0.6);
    const boostToggleTitle = this.add
      .text(0, 0, t(this.locale, "menu.boostToggle"), {
        fontSize: "12px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const boostToggleHint = this.add
      .text(0, 0, t(this.locale, "menu.boostToggleHint"), {
        fontSize: "10px",
        color: "#98b7c7",
      })
      .setOrigin(0, 0.5);

    const summaryRewardsCardBg = this.add.rectangle(0, 0, 10, 10, 0x101922, 0.96).setStrokeStyle(2, 0xffd166, 0.28);
    const summaryDailyCardBg = this.add.rectangle(0, 0, 10, 10, 0x101922, 0.96).setStrokeStyle(2, 0x57c27d, 0.26);
    const summaryWeeklyCardBg = this.add.rectangle(0, 0, 10, 10, 0x101922, 0.96).setStrokeStyle(2, 0x5cc8ff, 0.28);
    const summaryRewardsTitle = this.add
      .text(0, 0, t(this.locale, "menu.summaryRewards"), {
        fontSize: "11px",
        color: "#ffd78a",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const summaryRewardsValue = this.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#f7fbff",
        fontStyle: "700",
        align: "left",
      })
      .setOrigin(0, 0.5);
    const summaryDailyTitle = this.add
      .text(0, 0, t(this.locale, "menu.summaryDaily"), {
        fontSize: "11px",
        color: "#8be3bc",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const summaryDailyValue = this.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#f7fbff",
        fontStyle: "700",
        align: "left",
      })
      .setOrigin(0, 0.5);
    const summaryWeeklyTitle = this.add
      .text(0, 0, t(this.locale, "menu.summaryWeekly"), {
        fontSize: "11px",
        color: "#8fd5ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const summaryWeeklyValue = this.add
      .text(0, 0, "", {
        fontSize: "12px",
        color: "#f7fbff",
        fontStyle: "700",
        align: "left",
      })
      .setOrigin(0, 0.5);

    const btnCloseMissions = this.add
      .rectangle(0, 0, 88, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.76)
      .setInteractive({ useHandCursor: true });
    const labelCloseMissions = this.add
      .text(0, 0, t(this.locale, "menu.close"), {
        fontSize: "12px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const dailyInfoTitle = this.add
      .text(0, 0, getMenuDailySummaryTitle(this.locale), {
        fontSize: "12px",
        color: "#8fd5ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const dailyInfo = this.add
      .text(0, 0, "", { fontSize: "10px", color: "#d6e6ef", align: "left", wordWrap: { width: 420 } })
      .setOrigin(0, 0)
      .setLineSpacing(2);

    const liveopsInfo = this.add
      .text(0, 0, "", { fontSize: "11px", color: "#b7e2f5", align: "center", wordWrap: { width: 420 } })
      .setOrigin(0.5)
      .setLineSpacing(2);

    const liveopsTitle = this.add
      .text(0, 0, t(this.locale, "menu.liveopsTitle"), {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const liveopsReadyBadgeBg = this.add
      .rectangle(0, 0, 56, 22, 0xffd166, 0.16)
      .setStrokeStyle(2, 0xffd166, 0.75)
      .setVisible(false);
    const liveopsReadyBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "10px",
        color: "#ffe5a8",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setVisible(false);
    const liveopsCardBg = this.add.rectangle(0, 0, 10, 10, 0x101922, 0.96).setStrokeStyle(2, 0x57c27d, 0.34);
    const dailyInfoCardBg = this.add.rectangle(0, 0, 10, 10, 0x101922, 0.96).setStrokeStyle(2, 0x3aa4d4, 0.34);
    const weeklyRaceCardBg = this.add
      .rectangle(0, 0, 10, 10, 0x101922, 0.96)
      .setStrokeStyle(2, 0xffd166, 0.34)
      .setInteractive({ useHandCursor: true });
    const weeklyRaceTitle = this.add
      .text(0, 0, getMenuWeeklyRaceTitle(this.locale), {
        fontSize: "12px",
        color: "#ffd78a",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const weeklyRaceInfo = this.add
      .text(0, 0, "", {
        fontSize: "11px",
        color: "#ffe9bd",
        align: "left",
        wordWrap: { width: 520 },
      })
      .setOrigin(0, 0)
      .setLineSpacing(2);
    const weeklyRaceBadgeBg = this.add
      .rectangle(0, 0, 64, 20, 0x13283d, 0.96)
      .setStrokeStyle(2, 0x5cc8ff, 0.62);
    const weeklyRaceBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const weeklyRaceJumpBadgeBg = this.add
      .rectangle(0, 0, 72, 20, 0x57c27d, 0.16)
      .setStrokeStyle(2, 0x57c27d, 0.68)
      .setVisible(false);
    const weeklyRaceJumpBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#ecfff4",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setVisible(false);
    const weeklyRaceResetBadgeBg = this.add
      .rectangle(0, 0, 84, 18, 0x13283d, 0.22)
      .setStrokeStyle(2, 0x5cc8ff, 0.6);
    const weeklyRaceResetBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const weeklyRaceRewardBadgeBg = this.add
      .rectangle(0, 0, 96, 18, 0x153325, 0.22)
      .setStrokeStyle(2, 0x57c27d, 0.66);
    const weeklyRaceRewardBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#ecfff4",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const weeklyRaceRiskBadgeBg = this.add
      .rectangle(0, 0, 96, 18, 0x21170c, 0.22)
      .setStrokeStyle(2, 0xffd166, 0.66);
    const weeklyRaceRiskBadgeText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#fff0d4",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    const weeklyRaceProgressTrack = this.add.rectangle(0, 0, 10, 8, 0x0b1118, 0.95).setOrigin(0, 0.5).setStrokeStyle(1, 0x38566f, 0.7);
    const weeklyRaceProgressFill = this.add.rectangle(0, 0, 10, 8, 0x5cc8ff, 0.98).setOrigin(0, 0.5);
    const weeklyRaceProgressText = this.add
      .text(0, 0, "", {
        fontSize: "9px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    weeklyRaceCardBg.on("pointerdown", () => this.showLeaderboard());
    const dailyMissionsTitle = this.add
      .text(0, 0, t(this.locale, "menu.dailyMissionsTitle"), {
        fontSize: "12px",
        color: "#8be3bc",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const weeklyMissionsTitle = this.add
      .text(0, 0, t(this.locale, "menu.weeklyMissionsTitle"), {
        fontSize: "12px",
        color: "#ffd78a",
        fontStyle: "700",
      })
      .setOrigin(0, 0.5);
    const createMissionRow = (accent: number) => {
      const bg = this.add.rectangle(0, 0, 10, 10, 0x10161e, 0.96).setStrokeStyle(2, accent, 0.25);
      const text = this.add
        .text(0, 0, "", {
          fontSize: "10px",
          color: "#d9f2ff",
          align: "center",
          wordWrap: { width: 140 },
        })
        .setOrigin(0.5)
        .setLineSpacing(2);
      return { bg, text };
    };
    const dailyMissionRows = [createMissionRow(0x57c27d), createMissionRow(0x57c27d)];
    const weeklyMissionRows = [createMissionRow(0xffd166), createMissionRow(0xffd166), createMissionRow(0xffd166)];

    const btnClaimOps = this.add
      .rectangle(0, 0, 178, 36, 0x101922, 0.96)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const claimOpsHalo = this.add
      .rectangle(0, 0, 192, 48, 0xffd166, 0.08)
      .setStrokeStyle(2, 0xffd166, 0.38)
      .setVisible(false);
    const labelClaimOps = this.add
      .text(0, 0, t(this.locale, "menu.claimOpsIdle"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnClaimOps.on("pointerdown", () => void claimOpsRewards());
    const liveopsLayerBase = 12;
    [
      liveopsCardBg,
      dailyInfoCardBg,
      weeklyRaceCardBg,
      ...dailyMissionRows.map((row) => row.bg),
      ...weeklyMissionRows.map((row) => row.bg),
    ].forEach((entry) => entry.setDepth(liveopsLayerBase));
    [
      liveopsTitle,
      liveopsInfo,
      liveopsReadyBadgeBg,
      liveopsReadyBadgeText,
      dailyInfoTitle,
      dailyInfo,
      weeklyRaceTitle,
      weeklyRaceInfo,
      weeklyRaceBadgeBg,
      weeklyRaceBadgeText,
      weeklyRaceJumpBadgeBg,
      weeklyRaceJumpBadgeText,
      weeklyRaceResetBadgeBg,
      weeklyRaceResetBadgeText,
      weeklyRaceRewardBadgeBg,
      weeklyRaceRewardBadgeText,
      weeklyRaceRiskBadgeBg,
      weeklyRaceRiskBadgeText,
      weeklyRaceProgressTrack,
      weeklyRaceProgressFill,
      weeklyRaceProgressText,
      dailyMissionsTitle,
      weeklyMissionsTitle,
      ...dailyMissionRows.map((row) => row.text),
      ...weeklyMissionRows.map((row) => row.text),
      btnClaimOps,
      claimOpsHalo,
      labelClaimOps,
      btnCloseMissions,
      labelCloseMissions,
    ].forEach((entry) => entry.setDepth(liveopsLayerBase + 1));

    const controlsText = this.add
      .text(0, 0, t(this.locale, "menu.controls"), {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    const applyDailyButtonState = (
      button: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      active: boolean,
      stroke: number
    ) => {
      button.setAlpha(active ? 1 : 0.58);
      label.setAlpha(active ? 1 : 0.72);
      button.setStrokeStyle(2, active ? stroke : 0x5f6b76, active ? 0.85 : 0.5);
      button.setFillStyle(active ? 0x121a24 : 0x0d131b, active ? 0.95 : 0.9);
    };

    const refreshDailyButtons = (info: DailyAttemptsInfo) => {
      const regularPlan = planDailyStart(info, { boosted: false, boosterEnabled });

      labelDaily.setText(
        regularPlan.canStart
          ? regularPlan.kind === "free"
            ? t(this.locale, "menu.dailyFree")
            : t(this.locale, "menu.dailyRewarded")
          : t(this.locale, "menu.dailyLocked")
      );
      applyDailyButtonState(btnDaily, labelDaily, regularPlan.canStart, regularPlan.kind === "rewarded" ? 0x57c27d : 0x3aa4d4);
      const onboarding = getOnboardingBoostStatus(this.saveManager.get(), this.staticData.liveops);
      const boostVisible = boosterEnabled && !onboarding.eligible;
      if (!boostVisible) rewardBoostEnabled = false;
      boostToggleBg.setVisible(boostVisible);
      boostToggleTrack.setVisible(boostVisible);
      boostToggleFill.setVisible(boostVisible && rewardBoostEnabled);
      boostToggleKnob.setVisible(boostVisible);
      boostToggleTitle.setVisible(boostVisible);
      boostToggleHint.setVisible(boostVisible);
      btnPlayBoost.setVisible(false);
      labelPlayBoost.setVisible(false);
      btnDailyBoost.setVisible(false);
      labelDailyBoost.setVisible(false);
      if (!boostVisible) return;

      boostToggleBg.setStrokeStyle(2, rewardBoostEnabled ? 0x57c27d : 0x38566f, rewardBoostEnabled ? 0.84 : 0.56);
      boostToggleBg.setFillStyle(rewardBoostEnabled ? 0x13261d : 0x101922, 0.96);
      boostToggleTrack.setStrokeStyle(2, rewardBoostEnabled ? 0x57c27d : 0x38566f, rewardBoostEnabled ? 0.82 : 0.7);
      boostToggleTrack.setFillStyle(rewardBoostEnabled ? 0x163223 : 0x0b1118, 0.98);
      boostToggleFill.setFillStyle(0x57c27d, rewardBoostEnabled ? 0.28 : 0);
      boostToggleTitle.setColor(rewardBoostEnabled ? "#ecfff4" : "#d9f2ff");
      boostToggleHint.setColor(rewardBoostEnabled ? "#9ff1c2" : "#98b7c7");
    };

    const syncSaveData = () => {
      this.registry.set("saveData", this.saveManager.get());
      this.saveData = this.saveManager.get();
    };
    const makeOnboardingBoosterPayload = (): PendingStartBoosterPayload => {
      const boost = getOnboardingBoostStatus(this.saveManager.get(), this.staticData.liveops);
      return {
        addTailSegments: boost.addTailSegments,
        addBolts: boost.addBolts,
        addCores: boost.addCores,
        source: "onboarding",
      };
    };
    const setPendingStartBooster = (payload: PendingStartBoosterPayload | null) => {
      this.registry.set("pendingStartBooster", payload);
    };
    const formatMissionText = (status: MissionStatus): string => {
      const target = Math.max(1, Math.floor(status.def.objective.target));
      const title = formatMissionObjectiveLabel(this.locale, status.def.objective.type, target);
      const progress = `${formatNumber(this.locale, Math.min(status.progress, target))}/${formatNumber(this.locale, target)}`;
      const reward = formatLeaderboardReward(this.locale, status.def.reward);
      const state = status.claimed
        ? t(this.locale, "menu.missionClaimed")
        : status.completed
          ? t(this.locale, "menu.missionReady")
          : t(this.locale, "menu.missionProgress");
      return `${state} | ${title}\n${progress}${reward ? ` | ${reward}` : ""}`;
    };
    const applyMissionRows = (
      rows: Array<{ bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }>,
      statuses: readonly MissionStatus[],
      accent: number
    ) => {
      rows.forEach((row, index) => {
        const status = statuses[index];
        if (!status) {
          row.bg.setVisible(false);
          row.text.setVisible(false);
          return;
        }
        row.bg.setVisible(true);
        row.text.setVisible(true);
        const ready = status.completed && !status.claimed;
        const claimed = status.claimed;
        row.bg.setFillStyle(ready ? 0x163223 : claimed ? 0x151c24 : 0x10161e, ready ? 0.98 : 0.96);
        row.bg.setStrokeStyle(2, ready ? 0x57c27d : claimed ? 0x5f6b76 : accent, ready ? 0.8 : claimed ? 0.4 : 0.3);
        row.text.setColor(ready ? "#ecfff4" : claimed ? "#8ca0ad" : "#d9f2ff");
        row.text.setText(formatMissionText(status));
      });
    };
    let liveopsClaimPulse: Phaser.Tweens.Tween | null = null;
    const updateReadyBadge = (readyClaims: number) => {
      const hasReady = readyClaims > 0;
      liveopsReadyBadgeBg.setVisible(hasReady);
      liveopsReadyBadgeText.setVisible(hasReady);
      claimOpsHalo.setVisible(hasReady);
      liveopsCardBg.setStrokeStyle(2, hasReady ? 0xffd166 : 0x57c27d, hasReady ? 0.46 : 0.34);
      if (!hasReady) {
        liveopsReadyBadgeBg.setAlpha(1);
        liveopsReadyBadgeText.setAlpha(1);
        claimOpsHalo.setAlpha(0);
        claimOpsHalo.setScale(1);
        btnClaimOps.setScale(1);
        labelClaimOps.setScale(1);
        if (liveopsClaimPulse) {
          liveopsClaimPulse.stop();
          liveopsClaimPulse = null;
        }
        return;
      }

      liveopsReadyBadgeText.setText(t(this.locale, "menu.readyBadge", { count: formatNumber(this.locale, readyClaims) }));
      liveopsReadyBadgeBg.setSize(Math.max(60, liveopsReadyBadgeText.width + 18), 22);
      liveopsReadyBadgeBg.setAlpha(1);
      liveopsReadyBadgeText.setAlpha(1);
      claimOpsHalo.setAlpha(0.14);
      if (!liveopsClaimPulse) {
        liveopsClaimPulse = this.tweens.add({
          targets: claimOpsHalo,
          alpha: { from: 0.16, to: 0.04 },
          scaleX: { from: 1, to: 1.06 },
          scaleY: { from: 1, to: 1.14 },
          duration: 820,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    };
    let weeklyRaceJumpPulse: Phaser.Tweens.Tween | null = null;
    let weeklyRaceHotPulse: Phaser.Tweens.Tween | null = null;
    let weeklyRaceResetPulse: Phaser.Tweens.Tween | null = null;
    let weeklyRaceResetTicker: Phaser.Time.TimerEvent | null = null;
    let positionWeeklyRaceResetBadge = () => {};
    let positionWeeklyRaceSignalBadges = () => {};
    let positionWeeklyRaceBody = () => {};
    const refreshWeeklyRaceResetBadge = () => {
      const remainingMs = getNextWeeklyResetAtMs(getPlatformNowMs(this.registry)) - getPlatformNowMs(this.registry);
      const resetState = remainingMs <= 6 * 60 * 60 * 1000 ? "closing" : remainingMs <= 24 * 60 * 60 * 1000 ? "soon" : "steady";
      const style =
        resetState === "closing"
          ? { fill: 0xff8a3d, stroke: 0xffd166, text: "#1b1206" }
          : resetState === "soon"
            ? { fill: 0xffd166, stroke: 0xffd166, text: "#1b1305" }
            : { fill: 0x13283d, stroke: 0x5cc8ff, text: "#d9f2ff" };
      weeklyRaceResetBadgeText.setText(getMenuWeeklyResetBadgeLabel(this.locale, remainingMs));
      fitTextScaleToWidth(weeklyRaceResetBadgeText, 84, 0.64);
      weeklyRaceResetBadgeBg.setSize(Math.max(64, weeklyRaceResetBadgeText.displayWidth + 16), 18);
      weeklyRaceResetBadgeBg.setFillStyle(style.fill, resetState === "steady" ? 0.22 : 0.24);
      weeklyRaceResetBadgeBg.setStrokeStyle(2, style.stroke, resetState === "steady" ? 0.62 : 0.76);
      weeklyRaceResetBadgeText.setColor(style.text);
      positionWeeklyRaceResetBadge();
      if (resetState === "closing") {
        if (!weeklyRaceResetPulse) {
          weeklyRaceResetPulse = this.tweens.add({
            targets: [weeklyRaceResetBadgeBg, weeklyRaceResetBadgeText],
            alpha: { from: 1, to: 0.74 },
            duration: 760,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      } else if (weeklyRaceResetPulse) {
        weeklyRaceResetPulse.stop();
        weeklyRaceResetPulse = null;
        weeklyRaceResetBadgeBg.setAlpha(1);
        weeklyRaceResetBadgeText.setAlpha(1);
      }
    };
    const refreshWeeklyCompetitionCard = async (save: SaveData) => {
      const requestNonce = ++this.weeklyRaceRefreshNonce;
      const weeklyBoardId = getBoardId(this.staticData.leaderboards, "weekly");
      let snapshot: PlatformLeaderboardSnapshot | null = null;
      if (this.platformAdapter?.getLeaderboard) {
        try {
          snapshot = await this.platformAdapter.getLeaderboard(weeklyBoardId, "weekly");
        } catch {
          snapshot = null;
        }
      }
      if (requestNonce !== this.weeklyRaceRefreshNonce) return;

      const localWeekly = save.liveops.weeklyLeaderboard;
      const localBest = localWeekly.entries[0] ?? null;
      const currentScore = Math.max(0, snapshot?.currentPlayerScore ?? localBest?.score ?? 0);
      const currentRank = snapshot?.currentPlayerRank ?? null;
      const division = getLeaderboardDivision(currentScore);
      const nextDivision = getLeaderboardNextDivision(currentScore);
      const remaining = nextDivision ? Math.max(0, nextDivision.minScore - currentScore) : 0;
      const divisionGap = nextDivision ? Math.max(1, nextDivision.minScore - division.minScore) : 1;
      const progressRatio =
        currentScore <= 0
          ? 0
          : nextDivision
            ? Phaser.Math.Clamp((currentScore - division.minScore) / divisionGap, 0, 1)
            : 1;
      const activeRewardDivision = currentScore > 0 && division.id !== "scrapper" ? division.id : nextDivision?.id ?? "raider";
      const reward = getMenuBoardDivisionReward(this.staticData.leaderboards, "weekly", activeRewardDivision);
      const heldReward = currentScore > 0 ? getMenuBoardDivisionReward(this.staticData.leaderboards, "weekly", division.id) : { bolts: 0, cores: 0 };
      const hasReward = reward.bolts > 0 || reward.cores > 0;
      const heldRewardCompact = formatCompactRewardLabel(this.locale, heldReward) || getMenuWeeklyRaceNoRewardCompactLabel(this.locale);
      const nextReward = nextDivision ? getMenuBoardDivisionReward(this.staticData.leaderboards, "weekly", nextDivision.id) : null;
      const rewardDelta =
        nextReward && nextDivision
          ? {
              bolts: Math.max(0, nextReward.bolts - heldReward.bolts),
              cores: Math.max(0, nextReward.cores - heldReward.cores),
            }
          : null;
      const rewardDeltaCompact =
        rewardDelta && (rewardDelta.bolts > 0 || rewardDelta.cores > 0) ? formatCompactRewardLabel(this.locale, rewardDelta) : null;
      const nextRewardCompact =
        nextReward && (nextReward.bolts > 0 || nextReward.cores > 0) ? formatCompactRewardLabel(this.locale, nextReward) : null;
      const usingPlatformBoard = snapshot?.source === "platform";
      const weeklyJumpState: "debut" | "up" | "down" | null =
        freshWeeklyDebut ? "debut" : typeof freshWeeklyDelta === "number" && freshWeeklyDelta > 0 ? "up" : typeof freshWeeklyDelta === "number" && freshWeeklyDelta < 0 ? "down" : null;
      const hotRunThreshold = nextDivision
        ? Math.max(3000, Math.min(9000, Math.floor(divisionGap * 0.18), Math.floor(Math.max(currentScore, division.minScore) * 0.14)))
        : 0;
      const nearPromoThreshold = nextDivision ? Math.max(Math.max(2500, Math.floor(divisionGap * 0.22)), hotRunThreshold + 900) : 0;
      const raceState: "enter" | "climbing" | "payout" | "near_promo" | "hot_run" | "top" =
        currentScore <= 0
          ? "enter"
          : !nextDivision
            ? "top"
            : remaining <= hotRunThreshold
              ? "hot_run"
              : remaining <= nearPromoThreshold
                ? "near_promo"
                : hasReward
                  ? "payout"
                  : "climbing";
      const stateStyle =
        raceState === "hot_run"
          ? { fill: 0xff8a3d, stroke: 0xffd166, text: "#1b1206" }
          : raceState === "near_promo"
          ? { fill: 0xffd166, stroke: 0xffd166, text: "#1b1305" }
          : raceState === "payout"
            ? { fill: 0x57c27d, stroke: 0x57c27d, text: "#07130b" }
            : raceState === "top"
              ? { fill: 0xd9f2ff, stroke: 0x5cc8ff, text: "#06111a" }
              : raceState === "enter"
                ? { fill: 0x13283d, stroke: 0x5cc8ff, text: "#d9f2ff" }
                : { fill: 0x1a3240, stroke: 0x7fcfff, text: "#d9f2ff" };
      const barColor =
        raceState === "hot_run" ? 0xff8a3d : raceState === "near_promo" ? 0xffd166 : raceState === "payout" ? 0x57c27d : raceState === "top" ? 0xd9f2ff : 0x5cc8ff;

      weeklyRaceTitle.setText(getMenuWeeklyRaceTitle(this.locale));
      weeklyRaceTitle.setColor(usingPlatformBoard ? "#ffd78a" : "#9fd8ff");
      weeklyRaceInfo.setColor(usingPlatformBoard ? "#ffe9bd" : "#d6e6ef");
      weeklyRaceCardBg.setStrokeStyle(
        2,
        raceState === "hot_run" ? 0xffa24d : currentScore > 0 ? (usingPlatformBoard ? 0xffd166 : 0x5cc8ff) : 0x5f6b76,
        raceState === "hot_run" ? 0.72 : currentScore > 0 ? 0.46 : 0.3
      );
      weeklyRaceCardBg.setFillStyle(raceState === "hot_run" ? (usingPlatformBoard ? 0x22180b : 0x1c150f) : usingPlatformBoard ? 0x18140b : 0x101922, 0.96);
      weeklyRaceBadgeText.setText(getMenuWeeklyRaceStateBadgeLabel(this.locale, raceState));
      weeklyRaceBadgeBg.setSize(Math.max(62, weeklyRaceBadgeText.width + 16), 20);
      weeklyRaceBadgeBg.setFillStyle(stateStyle.fill, raceState === "top" ? 0.92 : 0.96);
      weeklyRaceBadgeBg.setStrokeStyle(2, stateStyle.stroke, 0.78);
      weeklyRaceBadgeText.setColor(stateStyle.text);
      refreshWeeklyRaceResetBadge();
      weeklyRaceRewardBadgeText.setText(getMenuWeeklyRaceHeldRewardBadgeLabel(this.locale, heldRewardCompact));
      fitTextScaleToWidth(weeklyRaceRewardBadgeText, 126, 0.78);
      weeklyRaceRewardBadgeBg.setSize(Math.max(76, weeklyRaceRewardBadgeText.displayWidth + 16), 18);
      weeklyRaceRewardBadgeBg.setFillStyle(heldReward.bolts > 0 || heldReward.cores > 0 ? 0x153325 : 0x13283d, heldReward.bolts > 0 || heldReward.cores > 0 ? 0.24 : 0.2);
      weeklyRaceRewardBadgeBg.setStrokeStyle(2, heldReward.bolts > 0 || heldReward.cores > 0 ? 0x57c27d : 0x5cc8ff, heldReward.bolts > 0 || heldReward.cores > 0 ? 0.72 : 0.58);
      weeklyRaceRewardBadgeText.setColor(heldReward.bolts > 0 || heldReward.cores > 0 ? "#ecfff4" : "#d9f2ff");
      const riskBadge = getMenuWeeklyRaceRiskBadgeConfig(
        this.locale,
        raceState === "top",
        rewardDeltaCompact,
        heldReward.bolts === 0 && heldReward.cores === 0 ? nextRewardCompact : null
      );
      weeklyRaceRiskBadgeText.setText(riskBadge.label);
      fitTextScaleToWidth(weeklyRaceRiskBadgeText, 132, 0.76);
      weeklyRaceRiskBadgeBg.setSize(Math.max(82, weeklyRaceRiskBadgeText.displayWidth + 16), 18);
      weeklyRaceRiskBadgeBg.setFillStyle(riskBadge.fill, riskBadge.alpha);
      weeklyRaceRiskBadgeBg.setStrokeStyle(2, riskBadge.stroke, riskBadge.strokeAlpha);
      weeklyRaceRiskBadgeText.setColor(riskBadge.text);
      if (weeklyJumpState) {
        const jumpStyle =
          weeklyJumpState === "debut"
            ? { fill: 0xffd166, stroke: 0xffd166, text: "#1b1305" }
            : weeklyJumpState === "up"
              ? { fill: 0x57c27d, stroke: 0x57c27d, text: "#07130b" }
              : { fill: 0x5f6b76, stroke: 0x7e8a95, text: "#dce5eb" };
        weeklyRaceJumpBadgeBg.setVisible(true);
        weeklyRaceJumpBadgeText.setVisible(true);
        weeklyRaceJumpBadgeText.setText(
          getMenuWeeklyRaceJumpLabel(
            this.locale,
            weeklyJumpState,
            weeklyJumpState === "debut" ? freshWeeklyRank : Math.abs(freshWeeklyDelta ?? 0)
          )
        );
        weeklyRaceJumpBadgeBg.setSize(Math.max(70, weeklyRaceJumpBadgeText.width + 16), 20);
        weeklyRaceJumpBadgeBg.setFillStyle(jumpStyle.fill, weeklyJumpState === "down" ? 0.18 : 0.2);
        weeklyRaceJumpBadgeBg.setStrokeStyle(2, jumpStyle.stroke, weeklyJumpState === "down" ? 0.44 : 0.74);
        weeklyRaceJumpBadgeText.setColor(jumpStyle.text);
        if (weeklyJumpState !== "down" && !weeklyRaceJumpPulse) {
          weeklyRaceJumpPulse = this.tweens.add({
            targets: [weeklyRaceJumpBadgeBg, weeklyRaceJumpBadgeText],
            scaleX: { from: 1, to: 1.06 },
            scaleY: { from: 1, to: 1.08 },
            duration: 860,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
        if (weeklyJumpState === "down" && weeklyRaceJumpPulse) {
          weeklyRaceJumpPulse.stop();
          weeklyRaceJumpPulse = null;
          weeklyRaceJumpBadgeBg.setScale(1);
          weeklyRaceJumpBadgeText.setScale(1);
        }
      } else {
        weeklyRaceJumpBadgeBg.setVisible(false);
        weeklyRaceJumpBadgeText.setVisible(false);
        weeklyRaceJumpBadgeBg.setScale(1);
        weeklyRaceJumpBadgeText.setScale(1);
        if (weeklyRaceJumpPulse) {
          weeklyRaceJumpPulse.stop();
          weeklyRaceJumpPulse = null;
        }
      }
      weeklyRaceProgressFill.setFillStyle(barColor, 0.98);
      weeklyRaceProgressFill.displayWidth = progressRatio <= 0 ? 0 : Math.max(8, Math.round(weeklyRaceProgressTrack.width * progressRatio));
      weeklyRaceProgressFill.setVisible(progressRatio > 0 || !nextDivision);
      weeklyRaceProgressText.setColor(raceState === "hot_run" ? "#fff0d4" : "#d9f2ff");
      weeklyRaceProgressText.setText(
        nextDivision
          ? raceState === "hot_run"
            ? getMenuWeeklyRaceHotProgressLabel(this.locale, t(this.locale, `leaderboard.division.${nextDivision.id}`))
            : getMenuWeeklyRaceProgressLabel(
                this.locale,
                Math.round(progressRatio * 100),
                t(this.locale, `leaderboard.division.${nextDivision.id}`)
              )
          : getMenuWeeklyRaceProgressTopLabel(this.locale)
      );
      if (raceState === "hot_run") {
        if (!weeklyRaceHotPulse) {
          weeklyRaceHotPulse = this.tweens.add({
            targets: [weeklyRaceBadgeBg, weeklyRaceProgressFill, weeklyRaceProgressText],
            alpha: { from: 1, to: 0.76 },
            duration: 760,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
        }
      } else if (weeklyRaceHotPulse) {
        weeklyRaceHotPulse.stop();
        weeklyRaceHotPulse = null;
        weeklyRaceBadgeBg.setAlpha(1);
        weeklyRaceProgressFill.setAlpha(1);
        weeklyRaceProgressText.setAlpha(1);
      }
      weeklyRaceInfo.setText(
        [
          currentScore > 0
            ? currentRank
              ? formatMenuWeeklyRaceRankLine(
                  this.locale,
                  currentRank,
                  t(this.locale, `leaderboard.division.${division.id}`),
                  formatNumber(this.locale, currentScore)
                )
              : formatMenuWeeklyRaceBestLine(
                  this.locale,
                  t(this.locale, `leaderboard.division.${division.id}`),
                  formatNumber(this.locale, currentScore)
                )
            : getMenuWeeklyRaceEntryLine(this.locale),
          currentScore > 0
            ? nextDivision
              ? raceState === "hot_run"
                ? formatMenuWeeklyRaceHotLine(
                    this.locale,
                    t(this.locale, `leaderboard.division.${nextDivision.id}`),
                    formatNumber(this.locale, remaining)
                  )
                : formatMenuWeeklyRaceTargetLine(
                    this.locale,
                    t(this.locale, `leaderboard.division.${nextDivision.id}`),
                    formatNumber(this.locale, remaining),
                    formatNumber(this.locale, nextDivision.minScore)
                  )
              : getMenuWeeklyRaceTopLine(this.locale)
            : formatMenuWeeklyRaceLaunchLine(
                this.locale,
                t(this.locale, `leaderboard.division.${activeRewardDivision}`),
                nextDivision ? formatNumber(this.locale, nextDivision.minScore) : formatNumber(this.locale, 0)
          ),
        ].join("\n")
      );
      positionWeeklyRaceBody();
    };
    let liveopsClaimBusy = false;
    const refreshPlayButton = () => {
      const onboarding = getOnboardingBoostStatus(this.saveManager.get(), this.staticData.liveops);
      if (onboarding.eligible) {
        labelPlay.setText(
          t(this.locale, "menu.playFreeBoost", {
            usesLeft: formatNumber(this.locale, onboarding.usesLeft),
          })
        );
        btnPlay.setStrokeStyle(2, 0x57c27d, 0.94).setFillStyle(0x153325, 0.98);
      } else {
        labelPlay.setText(t(this.locale, "menu.play"));
        btnPlay.setStrokeStyle(2, 0xffd166, 0.94).setFillStyle(0x13283d, 0.98);
      }
      labelPlay.setStyle({ fontSize: onboarding.eligible ? "18px" : "24px", align: "center" });
      labelPlay.setWordWrapWidth(Math.max(180, btnPlay.width - 28), true);
      fitTextScaleToWidth(labelPlay, Math.max(180, btnPlay.width - 28), 0.68);
    };
    const refreshLiveopsPanel = async () => {
      const dateUtc = this.getCurrentDateUtc();
      const save = this.saveManager.get();
      const streak = getStreakStatus(save, this.staticData.liveops, dateUtc);
      const comeback = getComebackStatus(save, this.staticData.liveops);
      const dailyMissions = getMissionStatuses(save, this.staticData.liveops, "daily", dateUtc);
      const weeklyMissions = getMissionStatuses(save, this.staticData.liveops, "weekly", dateUtc);
      const dailyDone = dailyMissions.filter((mission) => mission.completed).length;
      const weeklyDone = weeklyMissions.filter((mission) => mission.completed).length;
      const readyClaims =
        (streak.canClaim ? 1 : 0) +
        (comeback.eligible ? 1 : 0) +
        dailyMissions.filter((mission) => mission.completed && !mission.claimed).length +
        weeklyMissions.filter((mission) => mission.completed && !mission.claimed).length;
      const rotation = getActiveDailyRotation(this.staticData.daily, dateUtc);
      const tomorrow = getTomorrowOfferPreview(this.staticData.liveops);
      liveopsInfo.setText(
        [
          formatMenuLiveopsHeadline(
            this.locale,
            rotation?.ui?.badge ?? null,
            rotation?.ui?.title ?? rotation?.id ?? null,
            comeback.eligible,
            comeback.daysAway,
            formatLeaderboardReward(this.locale, comeback.reward),
            tomorrow.title
          ),
          formatMenuLiveopsStatusLine(
            this.locale,
            formatNumber(this.locale, streak.day),
            streak.canClaim,
            formatNumber(this.locale, readyClaims),
            formatNumber(this.locale, dailyDone),
            formatNumber(this.locale, dailyMissions.length),
            formatNumber(this.locale, weeklyDone),
            formatNumber(this.locale, weeklyMissions.length)
          ),
        ]
          .filter(Boolean)
          .join("\n")
      );
      summaryRewardsValue.setText(formatMenuRewardsSummary(this.locale, readyClaims));
      summaryDailyValue.setText(formatMenuProgressSummary(this.locale, dailyDone, dailyMissions.length));
      summaryWeeklyValue.setText(formatMenuProgressSummary(this.locale, weeklyDone, weeklyMissions.length));
      dailyMissionsTitle.setText(
        `${t(this.locale, "menu.dailyMissionsTitle")} ${formatNumber(this.locale, dailyDone)}/${formatNumber(this.locale, dailyMissions.length)}`
      );
      weeklyMissionsTitle.setText(
        `${t(this.locale, "menu.weeklyMissionsTitle")} ${formatNumber(this.locale, weeklyDone)}/${formatNumber(this.locale, weeklyMissions.length)}`
      );
      applyMissionRows(dailyMissionRows, dailyMissions, 0x57c27d);
      applyMissionRows(weeklyMissionRows, weeklyMissions, 0xffd166);
      await refreshWeeklyCompetitionCard(save);
      labelClaimOps.setText(t(this.locale, "menu.claimAction"));
      fitTextScaleToWidth(labelClaimOps, Math.max(96, btnClaimOps.width - 18), 0.76);
      btnClaimOps.setStrokeStyle(2, readyClaims > 0 ? 0xffd166 : 0x5f6b76, readyClaims > 0 ? 0.84 : 0.5);
      btnClaimOps.setFillStyle(readyClaims > 0 ? 0x101922 : 0x0c1117, readyClaims > 0 ? 0.96 : 0.9);
      labelClaimOps.setAlpha(readyClaims > 0 ? 1 : 0.72);
      updateReadyBadge(readyClaims);
      refreshPlayButton();
    };
    const refreshDailyAndLiveops = async () => {
      const info = await this.ensureDailyNormalizedAndRefresh(dailyInfo);
      refreshDailyButtons(info);
      await refreshLiveopsPanel();
      layoutMenu(this.scale);
    };
    const claimOpsRewards = async () => {
      if (liveopsClaimBusy) return;
      liveopsClaimBusy = true;
      try {
        const dateUtc = this.getCurrentDateUtc();
        let save = this.saveManager.get();
        const totalReward = { bolts: 0, cores: 0 };
        let claimedSomething = false;

        const streakResult = claimStreakReward(save, this.staticData.liveops, dateUtc);
        if (streakResult.ok) {
          save = streakResult.save;
          totalReward.bolts += streakResult.reward.bolts;
          totalReward.cores += streakResult.reward.cores;
          claimedSomething = true;
          this.analytics.track(ANALYTICS_EVENTS.STREAK_CLAIM, { dateUtc, day: streakResult.day, reward: streakResult.reward });
        }

        const comebackResult = claimComebackReward(save, this.staticData.liveops, dateUtc);
        if (comebackResult.ok) {
          save = comebackResult.save;
          totalReward.bolts += comebackResult.reward.bolts;
          totalReward.cores += comebackResult.reward.cores;
          claimedSomething = true;
          this.analytics.track(ANALYTICS_EVENTS.COMEBACK_CLAIM, {
            dateUtc,
            daysAway: comebackResult.daysAway,
            reward: comebackResult.reward,
          });
        }

        for (const period of ["daily", "weekly"] as const) {
          for (const status of getMissionStatuses(save, this.staticData.liveops, period, dateUtc)) {
            if (!status.completed || status.claimed) continue;
            const result = claimMissionReward(save, this.staticData.liveops, period, dateUtc, status.def.id);
            if (!result.ok) continue;
            save = result.save;
            totalReward.bolts += result.reward.bolts;
            totalReward.cores += result.reward.cores;
            claimedSomething = true;
            this.analytics.track(ANALYTICS_EVENTS.MISSION_CLAIM, {
              dateUtc,
              period,
              missionId: status.def.id,
              reward: result.reward,
            });
          }
        }

        if (!claimedSomething) {
          this.toast(t(this.locale, "toast.noOpsReady"));
          return;
        }

        await this.saveManager.save(save);
        syncSaveData();
        this.refreshWalletSummary();
        await refreshDailyAndLiveops();
        this.toast(t(this.locale, "toast.opsClaimed", { reward: formatLeaderboardReward(this.locale, totalReward) }));
      } finally {
        liveopsClaimBusy = false;
      }
    };
    const startStandardRun = async () => {
      const dateUtc = this.getCurrentDateUtc();
      let save = this.saveManager.get();
      const onboarding = getOnboardingBoostStatus(save, this.staticData.liveops);
      let startKind: "standard" | "free_boosted" = "standard";
      setPendingStartBooster(null);

      if (onboarding.eligible) {
        save = consumeOnboardingBoost(save);
        await this.saveManager.save(save);
        syncSaveData();
        setPendingStartBooster(makeOnboardingBoosterPayload());
        startKind = "free_boosted";
        this.analytics.track(ANALYTICS_EVENTS.BOOSTER_FREE_USED, {
          dateUtc,
          usesLeftAfter: formatNumber(this.locale, Math.max(0, onboarding.usesLeft - 1)),
        });
        this.toast(
          t(this.locale, "toast.freeBoostApplied", {
            reward: formatLeaderboardReward(this.locale, { bolts: onboarding.addBolts, cores: onboarding.addCores }),
          })
        );
      }

      this.analytics.track(ANALYTICS_EVENTS.MENU_CTA_PLAY, { dateUtc, startKind });
      this.stopMenuMusic();
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    };

    btnDaily.on("pointerdown", () => void this.startDaily(boosterEnabled && rewardBoostEnabled));
    btnDailyBoost.disableInteractive();
    btnMissions.on("pointerdown", () => {
      missionsExpanded = true;
      utilityOpen = false;
      layoutMenu(this.scale);
      void refreshDailyAndLiveops();
    });
    btnCloseMissions.on("pointerdown", () => {
      missionsExpanded = false;
      layoutMenu(this.scale);
    });
    boostToggleBg.on("pointerdown", () => {
      if (!boosterEnabled) return;
      rewardBoostEnabled = !rewardBoostEnabled;
      refreshPlayButton();
      refreshDailyButtons(getDailyAttemptsInfo(this.staticData.daily, this.saveManager.get(), this.getCurrentDateUtc()));
      layoutMenu(this.scale);
    });
    this.createWorkshopUi();
    this.createLeaderboardUi();

    const utilityDepthBase = 80;
    const utilityPanelBg = this.add
      .rectangle(0, 0, UTILITY_PANEL_WIDTH, UTILITY_PANEL_HEIGHT, 0x0f1720, 0.98)
      .setStrokeStyle(2, 0x5cc8ff, 0.8)
      .setDepth(utilityDepthBase)
      .setVisible(false);
    const utilityPanelAccent = this.add.rectangle(0, 0, UTILITY_PANEL_WIDTH - 64, 2, 0xffd166, 0.84).setDepth(utilityDepthBase + 1).setVisible(false);
    const utilityPanelTitle = this.add
      .text(0, 0, t(this.locale, "pause.title"), {
        fontSize: "24px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setDepth(utilityDepthBase + 1)
      .setOrigin(0.5)
      .setVisible(false);
    const utilityPanelHint = this.add
      .text(0, 0, t(this.locale, "menu.utilityHint"), {
        fontSize: "11px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: UTILITY_PANEL_WIDTH - 64 },
      })
      .setDepth(utilityDepthBase + 1)
      .setOrigin(0.5)
      .setVisible(false);
    const btnCloseUtility = this.add
      .rectangle(0, 0, 106, 34, 0x121a24, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x5cc8ff, 0.76)
      .setDepth(utilityDepthBase + 2)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    const labelCloseUtility = this.add
      .text(0, 0, t(this.locale, "menu.close"), {
        fontSize: "12px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setDepth(utilityDepthBase + 3)
      .setOrigin(0.5)
      .setVisible(false);
    [
      btnWorkshop,
      labelWorkshop,
      btnLeaderboard,
      labelLeaderboard,
      btnQuality,
      labelQuality,
      btnSfx,
      labelSfx,
      btnMusic,
      labelMusic,
      btnLanguage,
      labelLanguage,
    ].forEach((entry) => entry.setDepth(utilityDepthBase + 2));
    const setUtilityVisible = (visible: boolean) => {
      utilityPanelBg.setVisible(visible);
      utilityPanelAccent.setVisible(visible);
      utilityPanelTitle.setVisible(visible);
      utilityPanelHint.setVisible(visible);
      btnCloseUtility.setVisible(visible);
      labelCloseUtility.setVisible(visible);
      btnQuality.setVisible(visible);
      labelQuality.setVisible(visible);
      btnSfx.setVisible(visible);
      labelSfx.setVisible(visible);
      btnMusic.setVisible(visible);
      labelMusic.setVisible(visible);
      btnLanguage.setVisible(visible);
      labelLanguage.setVisible(visible);
    };
    const closeUtility = () => {
      utilityOpen = false;
      setUtilityVisible(false);
      layoutMenu(this.scale);
    };
    btnUtility.on("pointerdown", () => {
      utilityOpen = !utilityOpen;
      if (missionsExpanded) missionsExpanded = false;
      setUtilityVisible(utilityOpen);
      layoutMenu(this.scale);
    });
    btnCloseUtility.on("pointerdown", closeUtility);

    const layoutMenu = (s: { width: number; height: number }) => {
      const mode = getMenuLayoutMode(s.width, s.height);
      currentLayoutMode = mode;
      const compact = mode !== "full";
      const minimal = mode === "minimal";
      const topInset = minimal ? 14 : 18;
      const topGap = 10;
      const topButtonHeight = 34;
      const contentTop = topInset + topButtonHeight + (minimal ? 18 : compact ? 26 : 34);
      const shortDesktop = mode === "compact" && s.height <= 820;
      const utilityVisible = utilityOpen && !missionsExpanded;
      const showPreview = !missionsExpanded && mode === "full";
      const leftX = showPreview ? Math.round(s.width * 0.31) : s.width / 2;
      const titleY = minimal
        ? contentTop + 18
        : compact
          ? Math.max(contentTop + 16, Math.round(s.height * 0.14))
          : Math.max(contentTop + 22, Math.round(s.height * 0.2));

      this.walletText?.setPosition(topInset, topInset).setStyle({ fontSize: minimal ? "13px" : "14px" });
      if (this.walletText) {
        fitTextScaleToWidth(this.walletText, Math.max(180, Math.min(s.width * 0.34, minimal ? 220 : 320)), 0.74);
      }

      btnWorkshop.setOrigin(0, 0).setSize(146, topButtonHeight);
      btnLeaderboard.setOrigin(0, 0).setSize(156, topButtonHeight);
      btnPilot.setOrigin(0, 0).setSize(minimal ? 136 : 164, topButtonHeight);
      btnUtility.setOrigin(0, 0).setSize(112, topButtonHeight);
      btnQuality.setOrigin(0, 0);
      btnSfx.setOrigin(0, 0);
      btnMusic.setOrigin(0, 0);
      btnLanguage.setOrigin(0, 0);

      const placeTopButton = (
        button: Phaser.GameObjects.Rectangle,
        label: Phaser.GameObjects.Text,
        width: number,
        cursorX: number,
        visible: boolean
      ) => {
        button.setVisible(visible);
        label.setVisible(visible);
        if (!visible) return cursorX;
        button.setPosition(cursorX - width, topInset);
        label.setPosition(button.x + width / 2, button.y + topButtonHeight / 2);
        fitTextScaleToWidth(label, width - 18, 0.72);
        return button.x - topGap;
      };

      let navCursorX = s.width - topInset;
      navCursorX = placeTopButton(btnUtility, labelUtility, btnUtility.width, navCursorX, !missionsExpanded);
      navCursorX = placeTopButton(btnLeaderboard, labelLeaderboard, btnLeaderboard.width, navCursorX, !missionsExpanded && !utilityVisible && !minimal);
      navCursorX = placeTopButton(btnWorkshop, labelWorkshop, btnWorkshop.width, navCursorX, !missionsExpanded && !utilityVisible && !minimal);
      navCursorX = placeTopButton(btnPilot, labelPilot, btnPilot.width, navCursorX, !missionsExpanded);

      setUtilityVisible(utilityVisible);
      if (utilityVisible) {
        const panelWidth = Math.min(UTILITY_PANEL_WIDTH, s.width - 28);
        const panelHeight = Math.min(UTILITY_PANEL_HEIGHT, s.height - 28);
        const panelCenterX = s.width - topInset - panelWidth / 2;
        const panelCenterY = topInset + topButtonHeight + 16 + panelHeight / 2;
        const panelLeft = panelCenterX - panelWidth / 2;
        const panelTop = panelCenterY - panelHeight / 2;
        const settingsButtonWidth = Math.floor((panelWidth - 52) / 2);

        utilityPanelBg.setSize(panelWidth, panelHeight).setPosition(panelCenterX, panelCenterY);
        utilityPanelAccent.setSize(panelWidth - 48, 2).setPosition(panelCenterX, panelTop + 48);
        utilityPanelTitle.setPosition(panelCenterX, panelTop + 24);
        utilityPanelHint.setPosition(panelCenterX, panelTop + 64).setWordWrapWidth(panelWidth - 48, true);
        btnCloseUtility.setPosition(panelLeft + panelWidth - 18 - btnCloseUtility.width, panelTop + 16);
        labelCloseUtility.setPosition(btnCloseUtility.x + btnCloseUtility.width / 2, btnCloseUtility.y + btnCloseUtility.height / 2);
        fitTextScaleToWidth(labelCloseUtility, btnCloseUtility.width - 16, 0.76);

        btnWorkshop.setVisible(true).setPosition(panelLeft + 18, panelTop + 88).setSize(settingsButtonWidth, 38);
        labelWorkshop.setVisible(true).setPosition(btnWorkshop.x + btnWorkshop.width / 2, btnWorkshop.y + btnWorkshop.height / 2);
        btnLeaderboard.setVisible(true).setPosition(panelLeft + 34 + settingsButtonWidth, panelTop + 88).setSize(settingsButtonWidth, 38);
        labelLeaderboard.setVisible(true).setPosition(btnLeaderboard.x + btnLeaderboard.width / 2, btnLeaderboard.y + btnLeaderboard.height / 2);
        fitTextScaleToWidth(labelWorkshop, btnWorkshop.width - 18, 0.72);
        fitTextScaleToWidth(labelLeaderboard, btnLeaderboard.width - 18, 0.72);

        const settingsButtons = [
          { button: btnQuality, label: labelQuality, x: panelLeft + 18, y: panelTop + 142 },
          { button: btnSfx, label: labelSfx, x: panelLeft + 34 + settingsButtonWidth, y: panelTop + 142 },
          { button: btnMusic, label: labelMusic, x: panelLeft + 18, y: panelTop + 196 },
          { button: btnLanguage, label: labelLanguage, x: panelLeft + 34 + settingsButtonWidth, y: panelTop + 196 },
        ];
        for (const entry of settingsButtons) {
          entry.button.setSize(settingsButtonWidth, 38).setPosition(entry.x, entry.y);
          entry.label.setPosition(entry.button.x + entry.button.width / 2, entry.button.y + entry.button.height / 2);
          fitTextScaleToWidth(entry.label, entry.button.width - 18, 0.72);
        }
      }

      title.setPosition(leftX, titleY);
      taglineText.setPosition(leftX, titleY + (shortDesktop ? 40 : 58));
      bestText.setPosition(leftX, titleY + (shortDesktop ? 70 : 110));

      this.layoutMenuBackdrop(s.width, s.height, showPreview ? "full" : mode, showPreview ? Math.round(s.width * 0.76) : 0, showPreview ? Math.round(s.height * 0.53) : 0, showPreview);
      const menuPanelWidth = Math.min(showPreview ? 520 : minimal ? s.width - 28 : 560, s.width - 24);
      this.menuPanel.setSize(menuPanelWidth, this.menuPanel.height);
      const menuInnerWidth = Math.max(280, this.menuPanel.width - 42);
      title.setStyle({ fontSize: minimal ? "36px" : shortDesktop ? "40px" : "52px" });
      title.setScale(1);
      fitTextScaleToWidth(title, menuInnerWidth, minimal ? 0.78 : compact ? 0.72 : shortDesktop ? 0.76 : 0.84);
      taglineText.setStyle({ fontSize: minimal ? "14px" : compact ? "16px" : shortDesktop ? "13px" : "18px" });
      taglineText.setWordWrapWidth(menuInnerWidth, true);
      bestText.setStyle({ fontSize: minimal ? "12px" : compact ? "13px" : shortDesktop ? "12px" : "15px" });
      bestText.setWordWrapWidth(menuInnerWidth, true);
      controlsText.setStyle({ fontSize: compact ? "14px" : "15px", align: "center" });
      controlsText.setWordWrapWidth(Math.max(260, this.dailyPanel.width - 28), true);
      this.heroCaptionText.setStyle({ fontSize: "16px", align: "center" });
      this.heroCaptionText.setWordWrapWidth(this.heroPanel.width - 42, true);
      fitTextScaleToWidth(this.heroCaptionText, this.heroPanel.width - 42, 0.78);
      this.heroHintText.setStyle({ fontSize: "12px", align: "center" });
      this.heroHintText.setWordWrapWidth(this.heroPanel.width - 54, true);
      fitTextScaleToWidth(labelWorkshop, btnWorkshop.width - 18, 0.8);
      fitTextScaleToWidth(labelLeaderboard, btnLeaderboard.width - 18, 0.8);
      fitTextScaleToWidth(labelPilot, btnPilot.width - 18, 0.72);
      fitTextScaleToWidth(labelQuality, btnQuality.width - 18, 0.72);
      fitTextScaleToWidth(labelSfx, btnSfx.width - 18, 0.72);
      fitTextScaleToWidth(labelMusic, btnMusic.width - 18, 0.72);
      fitTextScaleToWidth(labelLanguage, btnLanguage.width - 18, 0.72);
      const liveopsPanel = getLiveopsPanelMetrics(s.width, compact, s.height);
      const stackedMissions = liveopsPanel.stacked;
      const summaryWidth = Math.min(minimal ? s.width - 24 : showPreview ? 560 : liveopsPanel.width, s.width - 24);
      const summaryHeight = minimal ? 168 : compact ? 132 : 140;
      const summaryBottom = s.height - (minimal ? 12 : 18);
      const summaryTop = summaryBottom - summaryHeight;
      const summaryCenterY = summaryTop + summaryHeight / 2;
      const ctaBottomLimit = summaryTop - (minimal ? 14 : 20);
      btnPlayBoost.setVisible(false);
      labelPlayBoost.setVisible(false);
      btnDailyBoost.setVisible(false);
      labelDailyBoost.setVisible(false);

      const ctaWidth = Math.min(this.menuPanel.width - 48, minimal ? 320 : compact ? 336 : 352);
      btnPlay.setSize(ctaWidth, minimal ? 52 : shortDesktop ? 50 : 56);
      btnTraining.setSize(ctaWidth, minimal ? 36 : shortDesktop ? 38 : 40);
      btnDaily.setSize(ctaWidth, minimal ? 40 : shortDesktop ? 42 : 46);
      btnMissions.setSize(ctaWidth, minimal ? 36 : shortDesktop ? 38 : 40);
      labelTraining.setStyle({ fontSize: minimal ? "15px" : "16px", align: "center" });
      fitTextScaleToWidth(labelTraining, btnTraining.width - 22, 0.76);
      labelDaily.setStyle({ fontSize: minimal ? "14px" : "15px", align: "center" });
      labelDaily.setWordWrapWidth(btnDaily.width - 24, true);
      fitTextScaleToWidth(labelDaily, btnDaily.width - 24, 0.76);
      labelMissions.setStyle({ fontSize: minimal ? "15px" : "16px", align: "center" });
      fitTextScaleToWidth(labelMissions, btnMissions.width - 22, 0.76);
      boostToggleTitle.setStyle({ fontSize: minimal ? "11px" : "12px", align: "left" });
      boostToggleHint.setStyle({ fontSize: minimal ? "9px" : "10px", align: "left" });
      const showBoostToggle = boosterEnabled && !getOnboardingBoostStatus(this.saveManager.get(), this.staticData.liveops).eligible && !missionsExpanded;
      title.setVisible(!missionsExpanded);
      taglineText.setVisible(!missionsExpanded);
      this.menuPanel.setVisible(!missionsExpanded);
      btnPlay.setVisible(!missionsExpanded);
      labelPlay.setVisible(!missionsExpanded);
      btnDaily.setVisible(!missionsExpanded);
      labelDaily.setVisible(!missionsExpanded);
      btnTraining.setVisible(!missionsExpanded);
      labelTraining.setVisible(!missionsExpanded);
      btnMissions.setVisible(!missionsExpanded);
      labelMissions.setVisible(!missionsExpanded);
      boostToggleBg.setVisible(showBoostToggle);
      boostToggleTrack.setVisible(showBoostToggle);
      boostToggleFill.setVisible(showBoostToggle && rewardBoostEnabled);
      boostToggleKnob.setVisible(showBoostToggle);
      boostToggleTitle.setVisible(showBoostToggle);
      boostToggleHint.setVisible(showBoostToggle);
      const ctaEntries = [
        { kind: "button" as const, button: btnPlay, label: labelPlay, height: btnPlay.height },
        ...(showBoostToggle ? [{ kind: "boost" as const, height: 44 }] : []),
        { kind: "button" as const, button: btnDaily, label: labelDaily, height: btnDaily.height },
        { kind: "button" as const, button: btnTraining, label: labelTraining, height: btnTraining.height },
        { kind: "button" as const, button: btnMissions, label: labelMissions, height: btnMissions.height },
      ];
      const ctaGap = minimal ? 6 : compact ? 6 : 8;
      const ctaStackHeight =
        ctaEntries.reduce((sum, entry) => sum + entry.height, 0) + Math.max(0, ctaEntries.length - 1) * ctaGap;
      const titleBottom = titleY + title.displayHeight / 2;
      const desiredTaglineY = Math.round(titleBottom + (minimal ? 8 : shortDesktop ? 8 : compact ? 10 : 14) + taglineText.displayHeight / 2);
      taglineText.setPosition(leftX, desiredTaglineY);
      const taglineBottom = taglineText.y + taglineText.displayHeight / 2;
      bestText.setVisible(false);
      if (!minimal) {
        const bestTargetY = Math.round(taglineBottom + (shortDesktop ? 8 : 12) + bestText.displayHeight / 2);
        const maxSummaryEntries = shortDesktop ? 1 : 3;
        const maxBestBottom = ctaBottomLimit - ctaStackHeight - 10;
        for (let summaryEntries = maxSummaryEntries; summaryEntries >= 0; summaryEntries -= 1) {
          bestText.setText(buildMenuBestText(this.locale, this.saveManager.get(), summaryEntries));
          bestText.setPosition(leftX, bestTargetY);
          if (bestText.y + bestText.displayHeight / 2 <= maxBestBottom) {
            bestText.setVisible(true);
            break;
          }
        }
      }
      const bestBottom = bestText.visible ? bestText.y + bestText.displayHeight / 2 : taglineBottom;
      const preferredCtaTop = minimal ? Math.round(s.height * 0.29) : compact ? Math.round(s.height * 0.34) : Math.round(s.height * 0.39);
      const minCtaTop = bestBottom + (minimal ? 12 : 16);
      const maxCtaTop = ctaBottomLimit - ctaStackHeight;
      const ctaTop = Phaser.Math.Clamp(preferredCtaTop, minCtaTop, Math.max(minCtaTop, maxCtaTop));
      let ctaCursor = ctaTop;
      for (const entry of ctaEntries) {
        const y = ctaCursor + entry.height / 2;
        if (entry.kind === "button") {
          entry.button.setPosition(leftX, y);
          entry.label.setPosition(entry.button.x, y);
        } else {
          boostToggleBg.setSize(Math.min(ctaWidth, 312), 40).setPosition(leftX, y);
          boostToggleTrack.setPosition(boostToggleBg.x - boostToggleBg.width / 2 + 34, boostToggleBg.y);
          boostToggleFill.setPosition(boostToggleTrack.x, boostToggleTrack.y).setSize(boostToggleTrack.width, boostToggleTrack.height);
          boostToggleKnob.setPosition(boostToggleTrack.x + (rewardBoostEnabled ? 10 : -10), boostToggleTrack.y);
          boostToggleTitle.setPosition(boostToggleTrack.x + 30, boostToggleBg.y - 8);
          boostToggleHint.setPosition(boostToggleTrack.x + 30, boostToggleBg.y + 10);
          fitTextScaleToWidth(boostToggleTitle, boostToggleBg.width - 84, 0.72);
          fitTextScaleToWidth(boostToggleHint, boostToggleBg.width - 84, 0.72);
        }
        ctaCursor += entry.height + ctaGap;
      }
      const ctaBottom = ctaCursor - ctaGap;
      const menuPanelTop = Math.max(contentTop - 20, titleY - title.displayHeight / 2 - 18);
      const menuPanelBottom = Math.min(summaryTop - 12, ctaBottom + 18);
      this.menuPanel.setPosition(leftX, (menuPanelTop + menuPanelBottom) / 2).setSize(this.menuPanel.width, Math.max(180, menuPanelBottom - menuPanelTop));
      refreshPlayButton();
      if (!missionsExpanded) {
        const summaryLeft = leftX - summaryWidth / 2;

        this.dailyPanel.setPosition(leftX, summaryCenterY).setSize(summaryWidth, summaryHeight);

        liveopsTitle.setPosition(summaryLeft + 16, summaryTop + 18).setVisible(true);
        btnCloseMissions.setVisible(false);
        labelCloseMissions.setVisible(false);

        btnClaimOps.setSize(minimal ? 104 : 116, 30).setPosition(summaryLeft + summaryWidth - 14, summaryTop + 12).setOrigin(1, 0);
        labelClaimOps.setPosition(btnClaimOps.x - btnClaimOps.width / 2, btnClaimOps.y + btnClaimOps.height / 2);
        fitTextScaleToWidth(labelClaimOps, Math.max(88, btnClaimOps.width - 16), 0.72);
        claimOpsHalo
          .setPosition(btnClaimOps.x - btnClaimOps.width / 2, btnClaimOps.y + btnClaimOps.height / 2)
          .setSize(btnClaimOps.width + 12, btnClaimOps.height + 10);
        liveopsReadyBadgeBg.setPosition(btnClaimOps.x - btnClaimOps.width - 12 - liveopsReadyBadgeBg.width / 2, btnClaimOps.y + btnClaimOps.height / 2);
        liveopsReadyBadgeText.setPosition(liveopsReadyBadgeBg.x, liveopsReadyBadgeBg.y);

        liveopsCardBg.setVisible(false);
        liveopsInfo.setVisible(false);
        summaryRewardsTitle.setStyle({ fontSize: minimal ? "10px" : "11px" });
        summaryDailyTitle.setStyle({ fontSize: minimal ? "10px" : "11px" });
        summaryWeeklyTitle.setStyle({ fontSize: minimal ? "10px" : "11px" });
        summaryRewardsValue.setStyle({ fontSize: minimal ? "12px" : "13px" });
        summaryDailyValue.setStyle({ fontSize: minimal ? "12px" : "13px" });
        summaryWeeklyValue.setStyle({ fontSize: minimal ? "12px" : "13px" });

        summaryRewardsCardBg.setVisible(true);
        summaryDailyCardBg.setVisible(true);
        summaryWeeklyCardBg.setVisible(true);
        summaryRewardsTitle.setVisible(true);
        summaryRewardsValue.setVisible(true);
        summaryDailyTitle.setVisible(true);
        summaryDailyValue.setVisible(true);
        summaryWeeklyTitle.setVisible(true);
        summaryWeeklyValue.setVisible(true);

        if (minimal) {
          const cardWidth = summaryWidth - 24;
          const cardHeight = 34;
          const rows = [
            { bg: summaryRewardsCardBg, title: summaryRewardsTitle, value: summaryRewardsValue, y: summaryTop + 66 },
            { bg: summaryDailyCardBg, title: summaryDailyTitle, value: summaryDailyValue, y: summaryTop + 104 },
            { bg: summaryWeeklyCardBg, title: summaryWeeklyTitle, value: summaryWeeklyValue, y: summaryTop + 142 },
          ];
          for (const entry of rows) {
            entry.bg.setPosition(leftX, entry.y).setSize(cardWidth, cardHeight);
            entry.title.setPosition(summaryLeft + 14, entry.y - 8);
            entry.value.setPosition(summaryLeft + 14, entry.y + 8);
            fitTextScaleToWidth(entry.title, cardWidth - 18, 0.72);
            fitTextScaleToWidth(entry.value, cardWidth - 18, 0.72);
          }
        } else {
          const cardGap = 10;
          const cardWidth = Math.floor((summaryWidth - 24 - cardGap * 2) / 3);
          const cardY = summaryTop + 88;
          const cards = [
            { bg: summaryRewardsCardBg, title: summaryRewardsTitle, value: summaryRewardsValue, x: summaryLeft + 12 + cardWidth / 2 },
            { bg: summaryDailyCardBg, title: summaryDailyTitle, value: summaryDailyValue, x: summaryLeft + 12 + cardWidth * 1.5 + cardGap },
            { bg: summaryWeeklyCardBg, title: summaryWeeklyTitle, value: summaryWeeklyValue, x: summaryLeft + 12 + cardWidth * 2.5 + cardGap * 2 },
          ];
          for (const entry of cards) {
            entry.bg.setPosition(entry.x, cardY).setSize(cardWidth, 54);
            entry.title.setPosition(entry.x - cardWidth / 2 + 12, cardY - 12);
            entry.value.setPosition(entry.x - cardWidth / 2 + 12, cardY + 9);
            fitTextScaleToWidth(entry.title, cardWidth - 18, 0.72);
            fitTextScaleToWidth(entry.value, cardWidth - 16, 0.72);
          }
        }

        dailyInfoCardBg.setVisible(false);
        dailyInfoTitle.setVisible(false);
        dailyInfo.setVisible(false);
        weeklyRaceCardBg.setVisible(false);
        weeklyRaceTitle.setVisible(false);
        weeklyRaceInfo.setVisible(false);
        weeklyRaceBadgeBg.setVisible(false);
        weeklyRaceBadgeText.setVisible(false);
        weeklyRaceJumpBadgeBg.setVisible(false);
        weeklyRaceJumpBadgeText.setVisible(false);
        weeklyRaceResetBadgeBg.setVisible(false);
        weeklyRaceResetBadgeText.setVisible(false);
        weeklyRaceRewardBadgeBg.setVisible(false);
        weeklyRaceRewardBadgeText.setVisible(false);
        weeklyRaceRiskBadgeBg.setVisible(false);
        weeklyRaceRiskBadgeText.setVisible(false);
        weeklyRaceProgressTrack.setVisible(false);
        weeklyRaceProgressFill.setVisible(false);
        weeklyRaceProgressText.setVisible(false);
        dailyMissionsTitle.setVisible(false);
        weeklyMissionsTitle.setVisible(false);
        dailyMissionRows.forEach((row) => {
          row.bg.setVisible(false);
          row.text.setVisible(false);
        });
        weeklyMissionRows.forEach((row) => {
          row.bg.setVisible(false);
          row.text.setVisible(false);
        });

        controlsText.setVisible(false);
        if (this.toastText) this.toastText.setPosition(s.width / 2, Math.round((ctaBottom + summaryTop) / 2));
        this.layoutWorkshop();
        this.layoutLeaderboard();
        return;
      }
      title.setVisible(false);
      taglineText.setVisible(false);
      bestText.setVisible(false);
      this.menuPanel.setVisible(false);
      btnPlay.setVisible(false);
      labelPlay.setVisible(false);
      btnDaily.setVisible(false);
      labelDaily.setVisible(false);
      btnTraining.setVisible(false);
      labelTraining.setVisible(false);
      btnMissions.setVisible(false);
      labelMissions.setVisible(false);
      boostToggleBg.setVisible(false);
      boostToggleTrack.setVisible(false);
      boostToggleFill.setVisible(false);
      boostToggleKnob.setVisible(false);
      boostToggleTitle.setVisible(false);
      boostToggleHint.setVisible(false);
      summaryRewardsCardBg.setVisible(false);
      summaryDailyCardBg.setVisible(false);
      summaryWeeklyCardBg.setVisible(false);
      summaryRewardsTitle.setVisible(false);
      summaryRewardsValue.setVisible(false);
      summaryDailyTitle.setVisible(false);
      summaryDailyValue.setVisible(false);
      summaryWeeklyTitle.setVisible(false);
      summaryWeeklyValue.setVisible(false);
      controlsText.setVisible(false);
      this.dailyPanel.setPosition(s.width / 2, s.height / 2).setSize(Math.min(s.width - 28, MISSIONS_PANEL_WIDTH), Math.min(s.height - 28, MISSIONS_PANEL_HEIGHT));
      const detailCenterX = this.dailyPanel.x;
      const detailPanelTop = this.dailyPanel.y - this.dailyPanel.height / 2;
      const panelLeft = detailCenterX - this.dailyPanel.width / 2;
      const innerWidth = this.dailyPanel.width - 24;
      const innerLeft = panelLeft + 12;
      const columnGap = 12;
      const columnWidth = Math.floor((innerWidth - columnGap) / 2);
      const leftColumnCenter = panelLeft + 12 + columnWidth / 2;
      const rightColumnLeft = innerLeft + columnWidth + columnGap;
      const rightColumnCenter = panelLeft + 12 + columnWidth + columnGap + columnWidth / 2;
      const claimButtonWidth = stackedMissions ? Math.min(148, innerWidth - 116) : Math.min(160, innerWidth - 132);
      const claimButtonHeight = 32;
      const denseDesktop = !stackedMissions && shortDesktop;
      const panelBottom = detailPanelTop + this.dailyPanel.height;
      const controlsTargetY = panelBottom - (stackedMissions ? 18 : 16);
      const maxMissionBottom = controlsTargetY - controlsText.displayHeight / 2 - 10;
      const headerTitleY = detailPanelTop + 18;
      const headerButtonY = detailPanelTop + 12;
      const liveopsCardY = detailPanelTop + (denseDesktop ? 76 : 82);
      const liveopsCardHeight = denseDesktop ? 52 : 58;
      const detailSummaryLine = `${t(this.locale, "menu.summaryRewards")} ${summaryRewardsValue.text} | ${t(this.locale, "menu.summaryDaily")} ${summaryDailyValue.text} | ${t(this.locale, "menu.summaryWeekly")} ${summaryWeeklyValue.text}`;

      liveopsCardBg.setVisible(true);
      liveopsInfo.setVisible(true);
      dailyInfoCardBg.setVisible(true);
      dailyInfoTitle.setVisible(true);
      dailyInfo.setVisible(true);
      weeklyRaceCardBg.setVisible(true);
      weeklyRaceTitle.setVisible(true);
      weeklyRaceInfo.setVisible(true);
      weeklyRaceBadgeBg.setVisible(true);
      weeklyRaceBadgeText.setVisible(true);
      weeklyRaceResetBadgeBg.setVisible(true);
      weeklyRaceResetBadgeText.setVisible(true);
      weeklyRaceRewardBadgeBg.setVisible(true);
      weeklyRaceRewardBadgeText.setVisible(true);
      weeklyRaceRiskBadgeBg.setVisible(true);
      weeklyRaceRiskBadgeText.setVisible(true);
      weeklyRaceProgressTrack.setVisible(true);
      weeklyRaceProgressFill.setVisible(true);
      weeklyRaceProgressText.setVisible(true);
      dailyMissionsTitle.setVisible(true);
      weeklyMissionsTitle.setVisible(true);
      dailyMissionRows.forEach((row) => {
        row.bg.setVisible(true);
        row.text.setVisible(true);
      });
      weeklyMissionRows.forEach((row) => {
        row.bg.setVisible(true);
        row.text.setVisible(true);
      });

      liveopsTitle.setPosition(panelLeft + 16, headerTitleY);
      btnCloseMissions.setSize(88, 32);
      btnClaimOps.setSize(claimButtonWidth, claimButtonHeight);
      btnCloseMissions.setVisible(true).setOrigin(1, 0).setPosition(panelLeft + this.dailyPanel.width - 16, headerButtonY);
      labelCloseMissions.setVisible(true).setPosition(btnCloseMissions.x - btnCloseMissions.width / 2, btnCloseMissions.y + btnCloseMissions.height / 2);
      btnClaimOps.setPosition(btnCloseMissions.x - btnCloseMissions.width - 12, headerButtonY).setOrigin(1, 0);
      labelClaimOps.setPosition(btnClaimOps.x - btnClaimOps.width / 2, btnClaimOps.y + btnClaimOps.height / 2);
      labelClaimOps.setStyle({ fontSize: stackedMissions ? "11px" : "12px" });
      claimOpsHalo
        .setPosition(btnClaimOps.x - btnClaimOps.width / 2, btnClaimOps.y + btnClaimOps.height / 2)
        .setSize(btnClaimOps.width + 14, btnClaimOps.height + 12);
      const badgeX = Math.min(
        btnClaimOps.x - btnClaimOps.width - 14 - liveopsReadyBadgeBg.width / 2,
        panelLeft + 24 + liveopsTitle.width + liveopsReadyBadgeBg.width / 2
      );
      liveopsReadyBadgeBg.setPosition(badgeX, headerTitleY);
      liveopsReadyBadgeText.setPosition(badgeX, headerTitleY);

      liveopsCardBg.setPosition(detailCenterX, liveopsCardY).setSize(innerWidth, liveopsCardHeight).setFillStyle(0x162330, 0.98);
      liveopsInfo.setText(detailSummaryLine);
      liveopsInfo.setOrigin(0, 0.5).setPosition(panelLeft + 16, liveopsCardY);
      liveopsInfo.setStyle({ fontSize: stackedMissions ? "11px" : denseDesktop ? "10px" : "12px", align: "left" });
      liveopsInfo.setWordWrapWidth(innerWidth - 32, true);
      liveopsInfo.setColor("#d9f2ff");
      dailyMissionsTitle.setStyle({ fontSize: denseDesktop ? "11px" : "12px" });
      weeklyMissionsTitle.setStyle({ fontSize: denseDesktop ? "11px" : "12px" });
      fitTextScaleToWidth(dailyMissionsTitle, stackedMissions ? innerWidth - 32 : columnWidth - 12, 0.82);
      fitTextScaleToWidth(weeklyMissionsTitle, stackedMissions ? innerWidth - 32 : columnWidth - 12, 0.72);

      if (stackedMissions) {
        const weeklyCardTop = detailPanelTop + 196;
        dailyInfoCardBg.setPosition(detailCenterX, detailPanelTop + 148).setSize(innerWidth, 84).setFillStyle(0x14222d, 0.98);
        dailyInfoTitle.setPosition(panelLeft + 16, detailPanelTop + 118);
        dailyInfo.setPosition(panelLeft + 16, detailPanelTop + 134);
        dailyInfo.setStyle({ fontSize: "11px" });
        dailyInfo.setWordWrapWidth(innerWidth - 24, true);
        dailyInfo.setColor("#d6e6ef");

        weeklyRaceCardBg.setPosition(detailCenterX, detailPanelTop + 258).setSize(innerWidth, 128);
        weeklyRaceTitle.setPosition(panelLeft + 16, detailPanelTop + 210);
        weeklyRaceInfo.setPosition(panelLeft + 16, detailPanelTop + 248);
        weeklyRaceInfo.setStyle({ fontSize: "11px" });
        weeklyRaceInfo.setWordWrapWidth(innerWidth - 24, true);
        weeklyRaceBadgeBg.setPosition(innerLeft + innerWidth - 12 - weeklyRaceBadgeBg.width / 2, detailPanelTop + 210);
        weeklyRaceBadgeText.setPosition(weeklyRaceBadgeBg.x, weeklyRaceBadgeBg.y);
        positionWeeklyRaceResetBadge = () => {
          weeklyRaceResetBadgeBg.setPosition(panelLeft + 16 + weeklyRaceResetBadgeBg.width / 2, detailPanelTop + 232);
          weeklyRaceResetBadgeText.setPosition(weeklyRaceResetBadgeBg.x, weeklyRaceResetBadgeBg.y);
        };
        positionWeeklyRaceResetBadge();
        weeklyRaceJumpBadgeBg.setPosition(weeklyRaceBadgeBg.x, detailPanelTop + 232);
        weeklyRaceJumpBadgeText.setPosition(weeklyRaceJumpBadgeBg.x, weeklyRaceJumpBadgeBg.y);
        positionWeeklyRaceSignalBadges = () => {
          const rowY = Math.max(detailPanelTop + 286, weeklyRaceInfo.y + weeklyRaceInfo.displayHeight + 16);
          weeklyRaceRewardBadgeBg.setPosition(panelLeft + 16 + weeklyRaceRewardBadgeBg.width / 2, rowY);
          weeklyRaceRewardBadgeText.setPosition(weeklyRaceRewardBadgeBg.x, weeklyRaceRewardBadgeBg.y);
          weeklyRaceRiskBadgeBg.setPosition(panelLeft + innerWidth - 16 - weeklyRaceRiskBadgeBg.width / 2, rowY);
          weeklyRaceRiskBadgeText.setPosition(weeklyRaceRiskBadgeBg.x, weeklyRaceRiskBadgeBg.y);
        };
        positionWeeklyRaceBody = () => {
          positionWeeklyRaceSignalBadges();
          const signalRowY = weeklyRaceRewardBadgeBg.y;
          const progressY = signalRowY + 26;
          weeklyRaceProgressTrack.setPosition(innerLeft + 14, progressY).setSize(innerWidth - 28, 10);
          weeklyRaceProgressFill.setPosition(weeklyRaceProgressTrack.x, weeklyRaceProgressTrack.y).setSize(weeklyRaceProgressFill.width, 10);
          weeklyRaceProgressText.setPosition(weeklyRaceProgressTrack.x + weeklyRaceProgressTrack.width / 2, weeklyRaceProgressTrack.y);
          const cardBottom = progressY + 12;
          weeklyRaceCardBg.setPosition(detailCenterX, (weeklyCardTop + cardBottom) / 2).setSize(innerWidth, cardBottom - weeklyCardTop);

          const stackedRowWidth = innerWidth;
          const dailyTitleY = cardBottom + 30;
          const weeklyTitleY = dailyTitleY + 114;

          const dailyMissionYs = [dailyTitleY + 34, dailyTitleY + 78];
          dailyMissionRows.forEach((row, index) => {
            row.bg.setPosition(detailCenterX, dailyMissionYs[index] ?? dailyMissionYs[dailyMissionYs.length - 1]).setSize(stackedRowWidth, 38);
            row.text.setPosition(detailCenterX, dailyMissionYs[index] ?? dailyMissionYs[dailyMissionYs.length - 1]);
            row.text.setWordWrapWidth(stackedRowWidth - 18, true);
          });
          dailyMissionsTitle.setPosition(panelLeft + 16, (dailyMissionYs[0] ?? dailyTitleY + 34) - 38);

          const weeklyMissionYs = [weeklyTitleY + 34, weeklyTitleY + 78, weeklyTitleY + 122];
          weeklyMissionRows.forEach((row, index) => {
            row.bg.setPosition(detailCenterX, weeklyMissionYs[index] ?? weeklyMissionYs[weeklyMissionYs.length - 1]).setSize(stackedRowWidth, 38);
            row.text.setPosition(detailCenterX, weeklyMissionYs[index] ?? weeklyMissionYs[weeklyMissionYs.length - 1]);
            row.text.setWordWrapWidth(stackedRowWidth - 18, true);
          });
          weeklyMissionsTitle.setPosition(panelLeft + 16, (weeklyMissionYs[0] ?? weeklyTitleY + 34) - 40);
          const lastWeeklyMissionBottom =
            (weeklyMissionRows[weeklyMissionRows.length - 1]?.bg.y ?? weeklyTitleY) +
            (weeklyMissionRows[weeklyMissionRows.length - 1]?.bg.height ?? 38) / 2;
          const overflow = Math.max(0, lastWeeklyMissionBottom - maxMissionBottom);
          if (overflow > 0) {
            dailyMissionsTitle.y -= overflow;
            weeklyMissionsTitle.y -= overflow;
            dailyMissionRows.forEach((row) => {
              row.bg.y -= overflow;
              row.text.y -= overflow;
            });
            weeklyMissionRows.forEach((row) => {
              row.bg.y -= overflow;
              row.text.y -= overflow;
            });
          }
        };
        positionWeeklyRaceBody();
      } else {
        const weeklyCardTop = detailPanelTop + (denseDesktop ? 109 : 114);
        dailyInfoCardBg
          .setPosition(leftColumnCenter, detailPanelTop + (denseDesktop ? 146 : 154))
          .setSize(columnWidth, denseDesktop ? 74 : 84)
          .setFillStyle(0x14222d, 0.98);
        dailyInfoTitle.setPosition(panelLeft + 16, detailPanelTop + (denseDesktop ? 116 : 124));
        dailyInfo.setPosition(panelLeft + 16, detailPanelTop + (denseDesktop ? 130 : 140));
        dailyInfo.setStyle({ fontSize: denseDesktop ? "10px" : "11px" });
        dailyInfo.setWordWrapWidth(columnWidth - 24, true);
        dailyInfo.setColor("#d6e6ef");

        weeklyRaceCardBg.setPosition(rightColumnCenter, detailPanelTop + (denseDesktop ? 166 : 176)).setSize(columnWidth, denseDesktop ? 120 : 130);
        weeklyRaceTitle.setPosition(rightColumnLeft + 4, detailPanelTop + 126);
        weeklyRaceInfo.setPosition(rightColumnLeft + 4, detailPanelTop + (denseDesktop ? 158 : 166));
        weeklyRaceInfo.setStyle({ fontSize: denseDesktop ? "10px" : "11px" });
        weeklyRaceInfo.setWordWrapWidth(columnWidth - 24, true);
        weeklyRaceBadgeBg.setPosition(rightColumnLeft + columnWidth - 12 - weeklyRaceBadgeBg.width / 2, detailPanelTop + 126);
        weeklyRaceBadgeText.setPosition(weeklyRaceBadgeBg.x, weeklyRaceBadgeBg.y);
        positionWeeklyRaceResetBadge = () => {
          weeklyRaceResetBadgeBg.setPosition(rightColumnLeft + 4 + weeklyRaceResetBadgeBg.width / 2, detailPanelTop + 144);
          weeklyRaceResetBadgeText.setPosition(weeklyRaceResetBadgeBg.x, weeklyRaceResetBadgeBg.y);
        };
        positionWeeklyRaceResetBadge();
        weeklyRaceJumpBadgeBg.setPosition(weeklyRaceBadgeBg.x, detailPanelTop + 144);
        weeklyRaceJumpBadgeText.setPosition(weeklyRaceJumpBadgeBg.x, weeklyRaceJumpBadgeBg.y);
        positionWeeklyRaceSignalBadges = () => {
          const rowY = Math.max(detailPanelTop + (denseDesktop ? 194 : 206), weeklyRaceInfo.y + weeklyRaceInfo.displayHeight + 14);
          weeklyRaceRewardBadgeBg.setPosition(rightColumnLeft + 4 + weeklyRaceRewardBadgeBg.width / 2, rowY);
          weeklyRaceRewardBadgeText.setPosition(weeklyRaceRewardBadgeBg.x, weeklyRaceRewardBadgeBg.y);
          weeklyRaceRiskBadgeBg.setPosition(rightColumnLeft + columnWidth - 20 - weeklyRaceRiskBadgeBg.width / 2, rowY);
          weeklyRaceRiskBadgeText.setPosition(weeklyRaceRiskBadgeBg.x, weeklyRaceRiskBadgeBg.y);
        };
        positionWeeklyRaceBody = () => {
          positionWeeklyRaceSignalBadges();
          const signalRowY = weeklyRaceRewardBadgeBg.y;
          const progressY = signalRowY + 24;
          weeklyRaceProgressTrack.setPosition(rightColumnLeft + 4, progressY).setSize(columnWidth - 24, 10);
          weeklyRaceProgressFill.setPosition(weeklyRaceProgressTrack.x, weeklyRaceProgressTrack.y).setSize(weeklyRaceProgressFill.width, 10);
          weeklyRaceProgressText.setPosition(weeklyRaceProgressTrack.x + weeklyRaceProgressTrack.width / 2, weeklyRaceProgressTrack.y);
          weeklyRaceProgressText.setStyle({ fontSize: denseDesktop ? "8px" : "9px" });
          const cardBottom = progressY + 12;
          weeklyRaceCardBg.setPosition(rightColumnCenter, (weeklyCardTop + cardBottom) / 2).setSize(columnWidth, cardBottom - weeklyCardTop);

          const missionTitleY = cardBottom + (denseDesktop ? 13 : 10);

          const dailyMissionYs = denseDesktop ? [missionTitleY + 30, missionTitleY + 68] : [missionTitleY + 36, missionTitleY + 82];
          dailyMissionRows.forEach((row, index) => {
            row.bg.setPosition(leftColumnCenter, dailyMissionYs[index] ?? dailyMissionYs[dailyMissionYs.length - 1]).setSize(columnWidth, denseDesktop ? 34 : 40);
            row.text.setPosition(leftColumnCenter, dailyMissionYs[index] ?? dailyMissionYs[dailyMissionYs.length - 1]);
            row.text.setStyle({ fontSize: denseDesktop ? "9px" : "10px" });
            row.text.setWordWrapWidth(columnWidth - 16, true);
          });
          dailyMissionsTitle.setPosition(panelLeft + 16, (dailyMissionYs[0] ?? missionTitleY + (denseDesktop ? 30 : 36)) - (denseDesktop ? 30 : 38));

          const weeklyMissionYs = denseDesktop ? [missionTitleY + 30, missionTitleY + 68, missionTitleY + 106] : [missionTitleY + 36, missionTitleY + 82, missionTitleY + 128];
          weeklyMissionRows.forEach((row, index) => {
            row.bg.setPosition(rightColumnCenter, weeklyMissionYs[index] ?? weeklyMissionYs[weeklyMissionYs.length - 1]).setSize(columnWidth, denseDesktop ? 34 : 40);
            row.text.setPosition(rightColumnCenter, weeklyMissionYs[index] ?? weeklyMissionYs[weeklyMissionYs.length - 1]);
            row.text.setStyle({ fontSize: denseDesktop ? "9px" : "10px" });
            row.text.setWordWrapWidth(columnWidth - 16, true);
          });
          weeklyMissionsTitle.setPosition(
            panelLeft + 28 + columnWidth,
            (weeklyMissionYs[0] ?? missionTitleY + (denseDesktop ? 30 : 36)) - (denseDesktop ? 32 : 40)
          );
          const lastWeeklyMissionBottom =
            (weeklyMissionRows[weeklyMissionRows.length - 1]?.bg.y ?? missionTitleY) +
            (weeklyMissionRows[weeklyMissionRows.length - 1]?.bg.height ?? (denseDesktop ? 34 : 40)) / 2;
          const overflow = Math.max(0, lastWeeklyMissionBottom - maxMissionBottom);
          if (overflow > 0) {
            dailyMissionsTitle.y -= overflow;
            weeklyMissionsTitle.y -= overflow;
            dailyMissionRows.forEach((row) => {
              row.bg.y -= overflow;
              row.text.y -= overflow;
            });
            weeklyMissionRows.forEach((row) => {
              row.bg.y -= overflow;
              row.text.y -= overflow;
            });
          }
        };
        positionWeeklyRaceBody();
      }

      controlsText.setPosition(leftX, controlsTargetY);
      controlsText.setStyle({ fontSize: compact ? "12px" : "13px" });
      if (this.toastText) this.toastText.setPosition(s.width / 2, Math.min(s.height * 0.93, panelBottom - 18));
      this.layoutWorkshop();
      this.layoutLeaderboard();
    };

    const onResize = (s: Phaser.Structs.Size) => layoutMenu(s);
    this.scale.on("resize", onResize);
    weeklyRaceResetTicker = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: refreshWeeklyRaceResetBadge,
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
      weeklyRaceResetTicker?.remove(false);
      weeklyRaceResetTicker = null;
      weeklyRaceResetPulse?.stop();
      weeklyRaceResetPulse = null;
      releasePageLifecycle();
      releasePlatformLifecycle();
      this.suspendReasons.clear();
    });

    layoutMenu(this.scale);
    refreshWeeklyRaceResetBadge();
    this.refreshWalletSummary();
    this.time.delayedCall(0, () => {
      void signalPlatformGameReady(this.platformAdapter, this.registry);
    });
    const sessionSummary =
      (this.registry.get("liveopsSessionSummary") as
        | {
            weeklyRewardGranted?: { reward: { bolts: number; cores: number } } | null;
            comebackEligible?: boolean;
          }
        | undefined) ?? null;
    if (sessionSummary?.weeklyRewardGranted) {
      this.toast(
        t(this.locale, "toast.weeklyBoardReward", {
          reward: formatLeaderboardReward(this.locale, sessionSummary.weeklyRewardGranted.reward),
        })
      );
    }
    if (sessionSummary?.comebackEligible) {
      const comeback = getComebackStatus(this.saveManager.get(), this.staticData.liveops);
      if (comeback.eligible) {
        this.toast(
          t(this.locale, "toast.comebackReady", {
            days: formatNumber(this.locale, comeback.daysAway),
            reward: formatLeaderboardReward(this.locale, comeback.reward),
          })
        );
      }
    }
    void refreshDailyAndLiveops();
  }

  update(_time: number, dtMs: number): void {
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000));
    this.menuTime += dt;

    if (this.bgFar) {
      this.bgFar.tilePositionX = this.menuTime * 10;
      this.bgFar.tilePositionY = 24 + Math.sin(this.menuTime * 0.12) * 18;
    }
    if (this.bgTile) {
      this.bgTile.tilePositionX = this.menuTime * 18;
      this.bgTile.tilePositionY = this.menuTime * 6;
    }

    if (this.menuGlowLeft) {
      this.menuGlowLeft.setAlpha(0.16 + Math.sin(this.menuTime * 1.3) * 0.03);
      this.menuGlowLeft.setRotation(this.menuTime * 0.03);
    }
    if (this.menuGlowRight) {
      this.menuGlowRight.setAlpha(0.14 + Math.cos(this.menuTime * 1.05) * 0.035);
      this.menuGlowRight.setRotation(-this.menuTime * 0.025);
    }

    if (!this.heroRecycler) return;

    this.heroRecycler.setRotation(this.menuTime * 0.15);
    this.heroTruck.setPosition(
      this.heroBaseX - 8 + Math.sin(this.menuTime * 1.4) * 10,
      this.heroBaseY + 104 + Math.cos(this.menuTime * 1.1) * 6
    );
    this.heroTruck.setRotation(-0.08 + Math.sin(this.menuTime * 0.9) * 0.04);

    this.heroEscortA.setPosition(
      this.heroBaseX - 82 + Math.cos(this.menuTime * 1.8) * 8,
      this.heroBaseY + 22 + Math.sin(this.menuTime * 1.2) * 10
    );
    this.heroEscortB.setPosition(
      this.heroBaseX + 94 + Math.cos(this.menuTime * 1.35 + 1.1) * 10,
      this.heroBaseY - 28 + Math.sin(this.menuTime * 1.55 + 0.7) * 10
    );
    this.heroThreatA.setPosition(
      this.heroBaseX - 122 + Math.sin(this.menuTime * 1.5) * 12,
      this.heroBaseY - 112 + Math.cos(this.menuTime * 1.8) * 8
    );
    this.heroThreatA.setRotation(0.25 + Math.sin(this.menuTime * 1.25) * 0.1);
    this.heroThreatB.setPosition(
      this.heroBaseX + 132 + Math.cos(this.menuTime * 1.1) * 12,
      this.heroBaseY + 62 + Math.sin(this.menuTime * 1.6) * 10
    );
    this.heroThreatB.setRotation(-this.menuTime * 0.8);
  }

  private createMenuBackdrop(): void {
    const { width, height } = this.scale;
    this.bgFar = this.add
      .tileSprite(0, 0, width, height, "bg_far_silhouette")
      .setOrigin(0, 0)
      .setDepth(-20)
      .setAlpha(0.88);
    this.bgTile = this.add.tileSprite(0, 0, width, height, "bg_tile_256").setOrigin(0, 0).setDepth(-19).setAlpha(0.82);

    this.menuGlowLeft = this.add
      .image(0, 0, "vfx_glow_blob")
      .setDepth(-18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x2d7bff)
      .setAlpha(0.16)
      .setScale(8.5, 6.4);
    this.menuGlowRight = this.add
      .image(0, 0, "vfx_glow_blob")
      .setDepth(-18)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd166)
      .setAlpha(0.14)
      .setScale(9.4, 7.2);

    this.menuPanel = this.add.rectangle(0, 0, 420, 446, 0x08111a, 0.76).setDepth(-12).setStrokeStyle(2, 0x3aa4d4, 0.42);
    this.dailyPanel = this.add.rectangle(0, 0, 420, 356, 0x0b141d, 0.84).setDepth(-12).setStrokeStyle(2, 0x5cc8ff, 0.32);
    this.heroPanel = this.add.rectangle(0, 0, 450, 520, 0x08111a, 0.72).setDepth(-12).setStrokeStyle(2, 0xffd166, 0.36);

    this.heroRecycler = this.add.image(0, 0, "recycler").setDepth(-10).setScale(1.08);
    this.heroTruck = this.add.image(0, 0, "player").setDepth(-9).setScale(3.7);
    this.heroEscortA = this.add.image(0, 0, "scrap_heavy").setDepth(-9).setScale(1.4).setAlpha(0.92);
    this.heroEscortB = this.add.image(0, 0, "scrap_rare").setDepth(-9).setScale(1.42).setAlpha(0.92);
    this.heroThreatA = this.add.image(0, 0, "enemy_chaser").setDepth(-9).setScale(1.8).setAlpha(0.95);
    this.heroThreatB = this.add.image(0, 0, "enemy_cutter").setDepth(-9).setScale(1.72).setAlpha(0.95);

    this.heroCaptionText = this.add
      .text(0, 0, t(this.locale, "menu.tagline"), {
        fontSize: "17px",
        color: "#f3f7fb",
        fontStyle: "700",
        align: "center",
        wordWrap: { width: 360 },
      })
      .setDepth(-8)
      .setOrigin(0.5);
    this.heroHintText = this.add
      .text(0, 0, t(this.locale, "menu.heroLead"), {
        fontSize: "13px",
        color: "#9eb6c4",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setDepth(-8)
      .setOrigin(0.5);
  }

  private layoutMenuBackdrop(
    width: number,
    height: number,
    mode: MenuLayoutMode,
    previewX: number,
    previewY: number,
    showPreview: boolean
  ): void {
    this.bgFar.setSize(width, height).setDisplaySize(width, height);
    this.bgTile.setSize(width, height).setDisplaySize(width, height);
    this.menuGlowLeft.setPosition(Math.round(width * 0.2), Math.round(height * 0.2));
    this.menuGlowRight.setPosition(Math.round(width * 0.83), Math.round(height * 0.66));

    this.heroBaseX = previewX;
    this.heroBaseY = previewY;

    this.heroPanel.setVisible(showPreview);
    this.heroRecycler.setVisible(showPreview);
    this.heroTruck.setVisible(showPreview);
    this.heroEscortA.setVisible(showPreview);
    this.heroEscortB.setVisible(showPreview);
    this.heroThreatA.setVisible(showPreview);
    this.heroThreatB.setVisible(showPreview);
    this.heroCaptionText.setVisible(showPreview);
    this.heroHintText.setVisible(showPreview);

    if (showPreview) {
      this.heroPanel.setPosition(this.heroBaseX, this.heroBaseY + 18).setSize(mode === "full" ? 450 : 400, mode === "full" ? 520 : 460);
      this.heroCaptionText.setPosition(this.heroBaseX, this.heroBaseY - (mode === "full" ? 206 : 176));
      this.heroHintText.setPosition(this.heroBaseX, this.heroBaseY + (mode === "full" ? 206 : 176));
      this.heroRecycler.setPosition(this.heroBaseX, this.heroBaseY);
    }
  }

  private createWorkshopUi(): void {
    this.workshopDim = this.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.74)
      .setOrigin(0, 0)
      .setDepth(1400)
      .setScrollFactor(0)
      .setInteractive();
    this.workshopDim.setVisible(false);
    this.workshopDim.on("pointerdown", () => this.hideWorkshop());

    const halfWidth = WORKSHOP_PANEL_WIDTH / 2;
    const halfHeight = WORKSHOP_PANEL_HEIGHT / 2;
    const panel = this.add
      .rectangle(0, 0, WORKSHOP_PANEL_WIDTH, WORKSHOP_PANEL_HEIGHT, 0x0f1720, 0.98)
      .setStrokeStyle(2, 0xffd166, 0.82);
    const accent = this.add.rectangle(0, -halfHeight + 48, WORKSHOP_PANEL_WIDTH - 96, 2, 0x5cc8ff, 0.84);
    const title = this.add
      .text(0, -halfHeight + 22, t(this.locale, "menu.workshop"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setShadow(0, 0, "#5cc8ff", 18, true, true)
      .setOrigin(0.5);
    this.workshopWalletText = this.add
      .text(-halfWidth + 40, -halfHeight + 64, "", {
        fontSize: "16px",
        color: "#d9f2ff",
        fontStyle: "700",
        wordWrap: { width: WORKSHOP_PANEL_WIDTH - 96 },
      })
      .setOrigin(0, 0);
    this.workshopHintText = this.add
      .text(-halfWidth + 40, -halfHeight + 98, t(this.locale, "menu.installedBuild"), {
        fontSize: "12px",
        color: "#98b7c7",
        fontStyle: "700",
        wordWrap: { width: WORKSHOP_PANEL_WIDTH - 96 },
      })
      .setOrigin(0, 0);

    const btnClose = this.add
      .rectangle(halfWidth - 52, -halfHeight + 22, 72, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelClose = this.add
      .text(halfWidth - 52, -halfHeight + 22, t(this.locale, "menu.close"), {
        fontSize: "12px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    btnClose.on("pointerdown", () => this.hideWorkshop());

    this.workshopFooterText = this.add
      .text(-halfWidth + 40, halfHeight - 52, t(this.locale, "menu.workshopFooter"), {
        fontSize: "12px",
        color: "#98b7c7",
        wordWrap: { width: WORKSHOP_PANEL_WIDTH - 96 },
      })
      .setOrigin(0, 0);

    this.workshopBox = this.add
      .container(0, 0, [panel, accent, title, this.workshopWalletText, this.workshopHintText, btnClose, labelClose, this.workshopFooterText])
      .setDepth(1401)
      .setScrollFactor(0);
    this.workshopBox.setVisible(false);
  }

  private createLeaderboardUi(): void {
    this.leaderboardDim = this.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.78)
      .setOrigin(0, 0)
      .setDepth(1450)
      .setScrollFactor(0)
      .setInteractive();
    this.leaderboardDim.setVisible(false);
    this.leaderboardDim.on("pointerdown", () => this.hideLeaderboard());

    const panelWidth = 700;
    const panelHeight = 940;
    const halfWidth = panelWidth / 2;
    const halfHeight = panelHeight / 2;
    const headerTitleY = -halfHeight + 22;
    const headerAccentY = -halfHeight + 48;
    const headerHintY = -halfHeight + 92;
    const filterY = -halfHeight + 152;
    const rowsStartY = -halfHeight + 218;
    const rowStep = 48;

    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x0f1720, 0.98).setStrokeStyle(2, 0x5cc8ff, 0.82);
    const accent = this.add.rectangle(0, headerAccentY, 592, 2, 0xffd166, 0.9);
    const title = this.add
      .text(0, headerTitleY, t(this.locale, "menu.leaderboardTitle"), {
        fontSize: "28px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setShadow(0, 0, "#5cc8ff", 18, true, true)
      .setOrigin(0.5);
    this.leaderboardHintText = this.add
      .text(0, headerHintY, "", {
        fontSize: "12px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);

    const btnClose = this.add
      .rectangle(halfWidth - 58, headerTitleY, 72, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelClose = this.add
      .text(halfWidth - 58, headerTitleY, t(this.locale, "menu.close"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnClose.on("pointerdown", () => this.hideLeaderboard());

    this.leaderboardFilterButtons = [];
    const filters: LeaderboardFilter[] = ["all", "run", "daily"];
    filters.forEach((filter, index) => {
      const x = -184 + index * 184;
      const button = this.add
        .rectangle(x, filterY, 148, 38, 0x121a24, 0.96)
        .setStrokeStyle(2, 0x5f6b76, 0.58)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, filterY, t(this.locale, `leaderboard.filter.${filter}`), {
          fontSize: "14px",
          color: "#d9f2ff",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      button.on("pointerdown", () => {
        this.leaderboardFilter = filter;
        void this.refreshLeaderboardSummary();
      });
      this.leaderboardFilterButtons.push({ filter, button, label });
    });

    this.leaderboardRows = [];
    for (let i = 0; i < 8; i++) {
      const y = rowsStartY + i * rowStep;
      const bg = this.add.rectangle(0, y, 620, 46, 0x121a24, 0.96).setStrokeStyle(2, 0x2a556d, 0.55);
      const text = this.add
        .text(-290, y - 16, "", {
          fontSize: "13px",
          color: "#d9f2ff",
          wordWrap: { width: 580 },
        })
        .setOrigin(0, 0)
        .setLineSpacing(3);
      this.leaderboardRows.push({ bg, text });
    }

    this.leaderboardEmptyPanel = this.add
      .rectangle(0, -86, 620, 172, 0x121a24, 0.96)
      .setStrokeStyle(2, 0x2a556d, 0.55)
      .setVisible(false);
    this.leaderboardEmptyText = this.add
      .text(0, -86, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        align: "center",
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5)
      .setLineSpacing(5)
      .setVisible(false);

    this.leaderboardFooterText = this.add
      .text(0, 316, "", {
        fontSize: "12px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5, 0)
      .setLineSpacing(3);
    this.leaderboardCareerTitleText = this.add
      .text(-290, 170, t(this.locale, "menu.careerMilestonesTitle"), {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0);
    this.leaderboardCareerText = this.add
      .text(-290, 196, "", {
        fontSize: "12px",
        color: "#98b7c7",
        wordWrap: { width: 580 },
      })
      .setOrigin(0, 0)
      .setLineSpacing(4);
    this.leaderboardPlatformText = this.add
      .text(0, 392, "", {
        fontSize: "10px",
        color: "#a9d7ee",
        align: "center",
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5, 0)
      .setLineSpacing(3);

    const children: Phaser.GameObjects.GameObject[] = [
      panel,
      accent,
      title,
      this.leaderboardHintText,
      this.leaderboardCareerTitleText,
      this.leaderboardCareerText,
      btnClose,
      labelClose,
      this.leaderboardFooterText,
      this.leaderboardPlatformText,
      this.leaderboardEmptyPanel,
      this.leaderboardEmptyText,
      ...this.leaderboardFilterButtons.flatMap((entry) => [entry.button, entry.label]),
      ...this.leaderboardRows.flatMap((row) => [row.bg, row.text]),
    ];

    this.leaderboardBox = this.add.container(0, 0, children).setDepth(1451).setScrollFactor(0);
    this.leaderboardBox.setVisible(false);
  }

  private layoutWorkshop(): void {
    if (!this.workshopDim || !this.workshopBox) return;
    const { width, height } = this.scale;
    this.workshopDim.setSize(width, height);
    const scale = Math.min(1, (width - 32) / WORKSHOP_PANEL_WIDTH, (height - 32) / WORKSHOP_PANEL_HEIGHT);
    this.workshopBox.setScale(scale).setPosition(width / 2, height / 2);
  }

  private layoutLeaderboard(): void {
    if (!this.leaderboardDim || !this.leaderboardBox) return;
    const { width, height } = this.scale;
    this.leaderboardDim.setSize(width, height);
    const scale = Math.min(1, (width - 48) / 700, (height - 48) / 940);
    this.leaderboardBox.setScale(scale).setPosition(width / 2, height / 2);
  }

  private showWorkshop(): void {
    this.hideLeaderboard();
    this.analytics.track(ANALYTICS_EVENTS.MENU_CTA_WORKSHOP, { dateUtc: this.getCurrentDateUtc() });
    this.refreshWorkshopSummary();
    this.workshopDim.setVisible(true);
    this.workshopBox.setVisible(true);
    this.layoutWorkshop();
  }

  private hideWorkshop(): void {
    this.workshopDim.setVisible(false);
    this.workshopBox.setVisible(false);
  }

  private showLeaderboard(): void {
    this.hideWorkshop();
    this.analytics.track(ANALYTICS_EVENTS.MENU_CTA_LEADERBOARD, { dateUtc: this.getCurrentDateUtc() });
    this.analytics.track(ANALYTICS_EVENTS.LEADERBOARD_OPEN, {
      dateUtc: this.getCurrentDateUtc(),
      boardId: getBoardId(this.staticData.leaderboards, "all_time"),
      filter: this.leaderboardFilter,
    });
    void this.refreshLeaderboardSummary();
    this.leaderboardDim.setVisible(true);
    this.leaderboardBox.setVisible(true);
    this.layoutLeaderboard();
  }

  private hideLeaderboard(): void {
    this.leaderboardDim.setVisible(false);
    this.leaderboardBox.setVisible(false);
  }

  private async refreshLeaderboardSummary(): Promise<void> {
    const save = this.saveManager.get();
    this.saveData = save;
    this.refreshWalletSummary();
    const requestNonce = ++this.leaderboardRefreshNonce;

    const hasDaily = save.leaderboard.entries.some((entry) => entry.mode === "daily");
    const hasRun = save.leaderboard.entries.some((entry) => entry.mode === "run");
    this.leaderboardFilter = this.normalizeLeaderboardFilter(save.leaderboard.entries, this.leaderboardFilter);
    this.latestLeaderboardFilter = this.normalizeLeaderboardFilter(save.leaderboard.entries, this.latestLeaderboardFilter);
    const filtered = filterLeaderboardEntries(save.leaderboard.entries, this.leaderboardFilter);
    const bestScore = save.leaderboard.entries.reduce((best, entry) => Math.max(best, entry.score), 0);
    const nextDivision = getLeaderboardNextDivision(bestScore);
    const careerMilestones = getLeaderboardCareerMilestones();
    const claimedMilestones = new Set<LeaderboardCareerMilestoneId>(save.leaderboard.claimedMilestones);
    for (const milestoneId of this.latestCareerMilestones) claimedMilestones.add(milestoneId);
    const careerProgress = getLeaderboardCareerProgress({
      bestScore,
      bestWave: save.stats.bestWave,
      bestBolts: save.stats.bestBolts,
      highestDivision: save.leaderboard.highestDivision,
    });
    const unlockedMilestones = new Set<LeaderboardCareerMilestoneId>(getUnlockedLeaderboardCareerMilestones(careerProgress));
    const nextMilestone = getNextLeaderboardCareerMilestone(careerProgress, [...claimedMilestones]);

    for (const entry of this.leaderboardFilterButtons) {
      const selected = entry.filter === this.leaderboardFilter;
      const disabled = (entry.filter === "daily" && !hasDaily) || (entry.filter === "run" && !hasRun);
      entry.button.setFillStyle(selected ? 0x183246 : 0x121a24, selected ? 0.98 : 0.94);
      entry.button.setStrokeStyle(2, selected ? 0xffd166 : disabled ? 0x5f6b76 : 0x3aa4d4, selected ? 0.9 : disabled ? 0.45 : 0.72);
      entry.button.setAlpha(disabled ? 0.55 : 1);
      entry.label.setAlpha(disabled ? 0.65 : 1);
      entry.label.setText(t(this.locale, `leaderboard.filter.${entry.filter}`));
    }

    this.leaderboardHintText.setText(
      [
        t(this.locale, "menu.leaderboardHint", {
          mode: t(this.locale, `leaderboard.filter.${this.leaderboardFilter}`),
          pilot: save.settings.pilotName || t(this.locale, "menu.pilotAuto"),
        }),
        nextMilestone
          ? t(this.locale, "menu.leaderboardCareerStatus", {
              count: formatNumber(this.locale, claimedMilestones.size),
              total: formatNumber(this.locale, careerMilestones.length),
              title: t(this.locale, `leaderboard.milestone.${nextMilestone.id}`),
            })
          : t(this.locale, "menu.leaderboardCareerComplete", {
              count: formatNumber(this.locale, claimedMilestones.size),
              total: formatNumber(this.locale, careerMilestones.length),
        }),
      ].join("\n")
    );
    this.leaderboardHintText.setStyle({ fontSize: "12px" });
    if (this.leaderboardHintText.height > 42) {
      this.leaderboardHintText.setStyle({ fontSize: "11px" });
    }
    this.leaderboardPlatformText.setText(getPortalBoardLoadingLabel(this.locale));
    const hasVisibleEntries = filtered.length > 0;
    this.leaderboardEmptyPanel.setVisible(!hasVisibleEntries);
    this.leaderboardEmptyText
      .setVisible(!hasVisibleEntries)
      .setText([t(this.locale, "menu.leaderboardEmpty"), t(this.locale, "menu.leaderboardScoring")].join("\n\n"));

    for (let i = 0; i < this.leaderboardRows.length; i++) {
      const row = this.leaderboardRows[i]!;
      const entry = filtered[i];
      if (!entry) {
        row.bg.setVisible(false);
        row.text.setVisible(false);
        continue;
      }

      const rank = i + 1;
      const isLatest = entry.id === this.latestLeaderboardEntryId;
      const accent =
        rank === 1
          ? 0xffd166
          : rank === 2
            ? 0x5cc8ff
            : rank === 3
              ? 0x57c27d
              : isLatest
                ? 0xffd166
                : 0x2a556d;
      const modeLabel = entry.mode === "daily" ? t(this.locale, "leaderboard.mode.daily") : t(this.locale, "leaderboard.mode.run");
      const divisionLabel = t(this.locale, `leaderboard.division.${getLeaderboardDivision(entry.score).id}`);
      const badge = isLatest ? (this.latestLeaderboardIsRecord ? t(this.locale, "leaderboard.recordBadge") : t(this.locale, "leaderboard.lastRun")) : "";
      const secondary = entry.mode === "daily" && entry.dailyDateUtc ? entry.dailyDateUtc : `${t(this.locale, "hud.level")} ${formatNumber(this.locale, entry.level)}`;

      row.bg
        .setVisible(true)
        .setFillStyle(isLatest ? 0x173028 : 0x121a24, isLatest ? 0.98 : 0.94)
        .setStrokeStyle(2, accent, isLatest ? 0.92 : 0.72);
      row.text.setVisible(true).setText(
        `${rank}. ${entry.pilot} [${modeLabel} | ${divisionLabel}]  ${formatNumber(this.locale, entry.score)}\n${secondary} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, entry.wave)} | ${t(this.locale, "hud.bolts")} ${formatNumber(this.locale, entry.bolts)} | ${t(this.locale, "results.cores")} ${formatNumber(this.locale, entry.cores)}${badge ? ` | ${badge}` : ""}`
      );
    }

    this.leaderboardCareerTitleText.setText(t(this.locale, "menu.careerMilestonesTitle"));
    this.leaderboardCareerText.setText(
      careerMilestones
        .map((milestone) =>
          formatCareerMilestoneLine(
            this.locale,
            milestone,
            careerProgress,
            unlockedMilestones.has(milestone.id),
            this.latestCareerMilestones.includes(milestone.id)
          )
        )
        .join("\n")
    );

    this.leaderboardFooterText.setText(
      this.latestPromotionDivision && (this.latestPromotionReward.bolts > 0 || this.latestPromotionReward.cores > 0)
        ? t(this.locale, "menu.leaderboardPromotion", {
            division: t(this.locale, `leaderboard.division.${this.latestPromotionDivision}`),
            reward: formatLeaderboardReward(this.locale, this.latestPromotionReward),
          })
        : this.latestCareerMilestones.length > 0
          ? t(this.locale, "menu.leaderboardMilestoneUnlock", {
              titles: formatCareerMilestoneTitles(this.locale, this.latestCareerMilestones),
              reward: formatLeaderboardReward(this.locale, this.latestCareerMilestoneReward),
            })
        : this.latestLeaderboardEntryId && this.latestLeaderboardRank
        ? this.latestLeaderboardIsRecord
          ? t(this.locale, "menu.leaderboardRecord", {
              rank: formatNumber(this.locale, this.latestLeaderboardRank),
              mode: t(this.locale, `leaderboard.filter.${this.latestLeaderboardFilter}`),
            })
          : t(this.locale, "menu.leaderboardLatest", {
              rank: formatNumber(this.locale, this.latestLeaderboardRank),
              mode: t(this.locale, `leaderboard.filter.${this.latestLeaderboardFilter}`),
            })
        : save.leaderboard.entries.length > 0
          ? nextDivision
            ? t(this.locale, "menu.leaderboardCareerNext", {
                division: t(this.locale, `leaderboard.division.${save.leaderboard.highestDivision}`),
                nextDivision: t(this.locale, `leaderboard.division.${nextDivision.id}`),
                score: formatNumber(this.locale, nextDivision.minScore),
              })
          : t(this.locale, "menu.leaderboardCareerTop", {
              division: t(this.locale, `leaderboard.division.${save.leaderboard.highestDivision}`),
            })
        : t(this.locale, "menu.leaderboardScoring")
    );

    await this.refreshPlatformLeaderboardSummary(requestNonce);
  }

  private normalizeLeaderboardFilter(entries: readonly SaveData["leaderboard"]["entries"][number][], filter: LeaderboardFilter): LeaderboardFilter {
    if (filter === "all") return "all";
    const hasRequestedMode = entries.some((entry) => entry.mode === filter);
    if (hasRequestedMode) return filter;
    if (filter === "daily") return entries.some((entry) => entry.mode === "run") ? "run" : "all";
    return entries.some((entry) => entry.mode === "daily") ? "daily" : "all";
  }

  private async refreshPlatformLeaderboardSummary(requestNonce: number): Promise<void> {
    if (!this.leaderboardPlatformText) return;
    const adapter = this.platformAdapter;
    if (!adapter?.getLeaderboard) {
      if (requestNonce === this.leaderboardRefreshNonce) {
        this.leaderboardPlatformText.setText(getPortalBoardUnavailableLabel(this.locale));
      }
      return;
    }

    const boardKeys = ["weekly", "daily", "all_time"] as const;
    const snapshots = await Promise.all(
      boardKeys.map(async (key) => {
        try {
          const snapshot =
            (await adapter.getLeaderboard?.(
              getBoardId(this.staticData.leaderboards, key),
              key === "all_time" ? "all_time" : key
            )) ?? null;
          return { key, snapshot };
        } catch {
          return { key, snapshot: null };
        }
      })
    );
    if (requestNonce !== this.leaderboardRefreshNonce) return;

    const lines = snapshots.map(({ key, snapshot }) => this.formatPortalBoardSummaryLine(key, snapshot));
    this.leaderboardPlatformText.setText(
      lines.length > 0 ? [getPortalBoardsTitle(this.locale), ...lines].join("\n") : getPortalBoardUnavailableLabel(this.locale)
    );
  }

  private formatPortalBoardSummaryLine(
    key: "daily" | "weekly" | "all_time",
    snapshot: PlatformLeaderboardSnapshot | null
  ): string {
    const boardLabel = getPortalBoardLabel(this.locale, key);
    if (!snapshot) return `${boardLabel}: ${getPortalBoardUnavailableLabel(this.locale)}`;

    const currentScore =
      snapshot.currentPlayerScore ??
      snapshot.entries.find((entry) => entry.isCurrentPlayer)?.score ??
      snapshot.entries[0]?.score ??
      0;
    const currentRank =
      snapshot.currentPlayerRank ??
      snapshot.entries.find((entry) => entry.isCurrentPlayer)?.rank ??
      null;
    const division = t(this.locale, `leaderboard.division.${getLeaderboardDivision(currentScore).id}`);
    const nextDivision = getLeaderboardNextDivision(currentScore);
    const nextLabel = nextDivision ? `${t(this.locale, `leaderboard.division.${nextDivision.id}`)} ${formatNumber(this.locale, nextDivision.minScore)}` : getPortalBoardTopLabel(this.locale);
    const sourceSuffix = snapshot.source === "local" ? ` | ${getPortalBoardFallbackLabel(this.locale)}` : "";

    return `${boardLabel}: ${currentRank ? `#${formatNumber(this.locale, currentRank)}` : getPortalBoardUnrankedLabel(this.locale)} | ${formatNumber(this.locale, currentScore)} | ${division} | ${nextLabel}${sourceSuffix}`;
  }

  private refreshWalletSummary(): void {
    const save = this.saveManager.get();
    this.saveData = save;
    const wallet = save.meta.wallet;
    this.walletText?.setText(
      t(this.locale, "menu.wallet", {
        bolts: formatResource(this.locale, "bolts", wallet.bolts ?? 0),
        cores: formatResource(this.locale, "cores", wallet.cores ?? 0),
      })
    );
  }

  private refreshWorkshopSummary(): void {
    const save = this.saveManager.get();
    this.saveData = save;
    this.refreshWalletSummary();

    this.workshopWalletText.setText(
      t(this.locale, "menu.stockpile", {
        bolts: formatResource(this.locale, "bolts", getMetaWalletAmount(save, "bolts")),
        cores: formatResource(this.locale, "cores", getMetaWalletAmount(save, "cores")),
      })
    );
    const activeMetaEntries = this.staticData.metaTree.nodes
      .map((node) => ({ node, level: Math.max(0, Math.floor(save.meta.nodeLevels[node.id] ?? 0)) }))
      .filter((entry) => entry.level > 0);
    this.workshopHintText.setText(activeMetaEntries.length > 0 ? t(this.locale, "menu.installedBuild") : t(this.locale, "menu.installedNone"));

    for (const chip of this.workshopBuildChips) chip.destroy();
    this.workshopBuildChips = [];
    let chipCursorX = -312;
    let chipCursorY = -278;
    const chipRowWidth = 624;
    for (const entry of activeMetaEntries) {
      const badge = getMetaNodeBadgeSpecs(this.locale, entry.node.id, 1)[0];
      if (!badge) continue;
      const chip = createMenuBadge(this, 0, -244, `${badge.label} ${entry.level}`, badge.fill, badge.stroke, badge.textColor);
      const chipBg = chip.list[0] as Phaser.GameObjects.Rectangle | undefined;
      const chipWidth = chipBg?.width ?? 0;
      if (chipCursorX > -312 && chipCursorX + chipWidth > -312 + chipRowWidth) {
        chipCursorX = -312;
        chipCursorY += 24;
      }
      chip.setPosition(chipCursorX + chipWidth / 2, chipCursorY);
      chipCursorX += chipWidth + 8;
      this.workshopBuildChips.push(chip);
      this.workshopBox.add(chip);
    }

    for (const card of this.workshopCards) card.destroy();
    this.workshopCards = [];

    const cardWidth = 304;
    const cardHeight = 92;
    const cardGapX = 16;
    const cardGapY = 6;
    const cardOriginLeft = -312;
    const leftCardX = cardOriginLeft + cardWidth / 2;
    const rightCardX = leftCardX + cardWidth + cardGapX;
    const cardRows = Math.ceil(this.staticData.metaTree.nodes.length / 2);
    const desiredCardsStartY = this.workshopBuildChips.length > 0 ? chipCursorY + 44 : -184;
    const maxCardsBottom = this.workshopFooterText.y - 22;
    const maxCardsStartY = maxCardsBottom - cardHeight / 2 - Math.max(0, cardRows - 1) * (cardHeight + cardGapY);
    const cardsStartY = Math.min(desiredCardsStartY, maxCardsStartY);

    this.staticData.metaTree.nodes.forEach((node, idx) => {
      const level = getMetaNodeLevel(save, node.id);
      const cost = getMetaNodeCost(this.staticData.metaTree, node.id, level);
      const currencyAmount = cost ? getMetaWalletAmount(save, cost.currency) : 0;
      const costAmount = cost?.amount ?? Number.POSITIVE_INFINITY;
      const affordable = Boolean(cost) && currencyAmount >= costAmount;
      const maxed = level >= node.maxLevel || !cost;
      const badge = getMetaNodeBadgeSpecs(this.locale, node.id, 1)[0];
      const column = idx % 2;
      const row = Math.floor(idx / 2);
      const x = column === 0 ? leftCardX : rightCardX;
      const y = cardsStartY + row * (cardHeight + cardGapY);
      const accentColor = maxed ? 0x57c27d : badge?.stroke ?? (cost?.currency === "cores" ? 0xffd166 : idx % 2 === 0 ? 0x5cc8ff : 0x3aa4d4);
      const textLeft = -cardWidth / 2 + 18;
      const buttonCenterX = cardWidth / 2 - 58;
      const buttonWidth = 108;
      const buttonY = 6;
      const buttonLeft = buttonCenterX - buttonWidth / 2;
      const textWrapWidth = Math.max(120, Math.floor(buttonLeft - textLeft - 14));

      const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x121a24, 0.97).setStrokeStyle(2, accentColor, maxed ? 0.72 : 0.58);
      const accent = this.add.rectangle(-cardWidth / 2 + 4, 0, 6, cardHeight, accentColor, 0.92);
      const title = this.add
        .text(textLeft, -32, getMetaNodeName(this.locale, node.id, node.name), {
          fontSize: "14px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: Math.min(140, textWrapWidth) },
        })
        .setOrigin(0, 0);
      const badgeNode = badge ? createMenuBadge(this, 0, -24, badge.label, badge.fill, badge.stroke, badge.textColor) : null;
      const desc = this.add
        .text(textLeft, -10, getMetaNodeDescription(this.locale, node.id), {
          fontSize: "9px",
          color: "#98b7c7",
          wordWrap: { width: Math.min(148, textWrapWidth + 4) },
        })
        .setOrigin(0, 0);
      if (desc.displayHeight > 18) {
        desc.setScale(Phaser.Math.Clamp(18 / desc.displayHeight, 0.76, 1));
      }
      const levelY = Math.max(14, Math.min(22, desc.y + desc.displayHeight + 5));
      const progressY = Math.min(cardHeight / 2 - 12, levelY + 14);
      const levelText = this.add
        .text(textLeft, levelY, t(this.locale, "menu.level", { level, maxLevel: node.maxLevel }), {
          fontSize: "10px",
          color: maxed ? "#57c27d" : "#7fdfff",
          fontStyle: "700",
        })
        .setOrigin(0, 0);
      const progressWidth = Math.max(98, textWrapWidth - 10);
      fitTextScaleToWidth(levelText, progressWidth, 0.84);
      const progressBg = this.add.rectangle(textLeft, progressY, progressWidth, 6, 0x0b141d, 0.95).setOrigin(0, 0.5);
      const progressFill = this.add
        .rectangle(
          textLeft,
          progressY,
          progressWidth * Phaser.Math.Clamp(node.maxLevel <= 0 ? 1 : level / node.maxLevel, 0, 1),
          6,
          accentColor,
          0.98
        )
        .setOrigin(0, 0.5);

      const btn = this.add
        .rectangle(buttonCenterX, buttonY, buttonWidth, 34, affordable ? 0x1b2635 : 0x0d131b, 0.98)
        .setStrokeStyle(2, maxed ? 0x57c27d : affordable ? 0xffd166 : 0x5f6b76, 0.86);
      const priceLabel = cost ? formatResource(this.locale, cost.currency, cost.amount) : t(this.locale, "menu.maxed");
      const btnLabel = this.add
        .text(
          buttonCenterX,
          buttonY - 6,
          maxed ? t(this.locale, "menu.installedButton") : affordable ? t(this.locale, "menu.buy") : t(this.locale, "menu.locked"),
          { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" }
        )
        .setOrigin(0.5);
      const costLabel = this.add
        .text(buttonCenterX, buttonY + 10, priceLabel, {
          fontSize: "10px",
          color: maxed ? "#57c27d" : affordable ? "#ffd166" : "#98b7c7",
          fontStyle: "700",
          align: "center",
          wordWrap: { width: 98 },
        })
        .setOrigin(0.5);
      fitTextScaleToWidth(btnLabel, buttonWidth - 18, 0.76);
      fitTextScaleToWidth(costLabel, buttonWidth - 16, 0.76);
      if (badgeNode) {
        badgeNode.setPosition(buttonCenterX, -22);
      }

      if (!maxed && affordable) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => void this.buyMetaNode(node.id));
      }

      const card = this.add
        .container(x, y, [bg, accent, title, ...(badgeNode ? [badgeNode] : []), desc, levelText, progressBg, progressFill, btn, btnLabel, costLabel])
        .setDepth(1402);
      this.workshopCards.push(card);
      this.workshopBox.add(card);
    });
  }

  private async buyMetaNode(nodeId: string): Promise<void> {
    if (this.workshopBusy) return;
    this.workshopBusy = true;
    try {
      const save = this.saveManager.get();
      const result = purchaseMetaNode(this.staticData.metaTree, save, nodeId);
      if (!result.ok) {
        this.toast(result.reason === "insufficient_funds" ? t(this.locale, "menu.notEnough") : t(this.locale, "menu.upgradeUnavailable"));
        return;
      }

      await this.saveManager.save(result.save);
      this.registry.set("saveData", this.saveManager.get());
      this.saveData = this.saveManager.get();
      this.analytics.track(ANALYTICS_EVENTS.WORKSHOP_PURCHASE, {
        dateUtc: this.getCurrentDateUtc(),
        nodeId,
        currency: result.cost.currency,
        amount: result.cost.amount,
        level: getMetaNodeLevel(this.saveData, nodeId),
      });
      this.refreshWorkshopSummary();
      this.toast(
        t(this.locale, "menu.installedToast", {
          name: getMetaNodeName(this.locale, nodeId, nodeId),
          cost: formatResource(this.locale, result.cost.currency, result.cost.amount),
        })
      );
    } finally {
      this.workshopBusy = false;
    }
  }

  private async ensureDailyNormalizedAndRefresh(dailyInfoText: Phaser.GameObjects.Text): Promise<DailyAttemptsInfo> {
    const dateUtc = this.getCurrentDateUtc();
    const save = this.saveManager.get();
    const loginRewardResult = claimLoginReward(save, dateUtc);
    const normalized = normalizeDailySave(loginRewardResult.save, dateUtc);
    if (normalized !== save) {
      await this.saveManager.save(normalized);
      this.registry.set("saveData", this.saveManager.get());
    }
    this.saveData = this.saveManager.get();
    if (loginRewardResult.claimed) {
      this.refreshWalletSummary();
    }

    const sel = pickDailyVariant(this.staticData.daily, dateUtc);
    const variant = this.staticData.daily.dailyVariants.find((v) => v.id === sel.variantId);
    const copy = getDailyVariantCopy(this.locale, sel.variantId, variant?.ui?.title ?? sel.variantId, variant?.ui?.desc ?? "");
    const loginRewardStatus = getLoginRewardStatus(this.saveData, dateUtc);
    const currentLoginDay = loginRewardStatus.lastClaimDay ?? loginRewardStatus.nextDay;
    const currentLoginReward = loginRewardStatus.lastClaimReward ?? loginRewardStatus.nextReward;

    const info = getDailyAttemptsInfo(this.staticData.daily, this.saveData, dateUtc);
    const best =
      this.saveData.daily.lastDateUtc === dateUtc
        ? t(this.locale, "menu.bestToday", {
            wave: formatNumber(this.locale, this.saveData.daily.bestWave),
            bolts: formatNumber(this.locale, this.saveData.daily.bestBolts),
          })
        : t(this.locale, "menu.bestNone");
    dailyInfoText.setText(
      [
        `${t(this.locale, "menu.seedLine", { seed: dateUtc })} | ${copy.title}`,
        formatMenuDailyLoginLine(
          this.locale,
          formatNumber(this.locale, currentLoginDay),
          formatNumber(this.locale, LOGIN_REWARD_DAY_COUNT),
          formatLeaderboardReward(this.locale, currentLoginReward)
        ),
        formatMenuDailyStatusLine(
          this.locale,
          formatNumber(this.locale, info.attemptsUsed),
          formatNumber(this.locale, info.maxAttempts),
          best,
          info.canStartFree ? "free" : info.canStartRewarded ? "rewarded" : "locked"
        ),
      ]
        .filter(Boolean)
        .join("\n")
    );
    return info;
  }

  private async startRunBoosted(): Promise<void> {
    const cfg = this.staticData.balances.ads?.rewarded?.startBooster;
    if (!cfg?.enabled) return;
    const dateUtc = this.getCurrentDateUtc();

    const res = await this.ads.showRewarded(AD_PLACEMENTS.START_BOOSTER);
    if (res.ok && res.rewarded) {
      const payload: PendingStartBoosterPayload = {
        addTailSegments: Math.max(0, Math.floor(cfg.addTailSegments)),
        addBolts: Math.max(0, Math.floor(cfg.addBolts)),
        addCores: Math.max(0, Math.floor(cfg.addCores)),
        source: "rewarded",
      };
      this.registry.set("pendingStartBooster", payload);
      this.analytics.track(ANALYTICS_EVENTS.BOOSTER_REWARDED_ACCEPT, {
        dateUtc,
        mode: "run",
        placement: AD_PLACEMENTS.START_BOOSTER,
        reward: { bolts: payload.addBolts, cores: payload.addCores, tailSegments: payload.addTailSegments },
      });
      this.analytics.track(ANALYTICS_EVENTS.MENU_CTA_PLAY, { dateUtc, startKind: "rewarded_boosted" });
      this.stopMenuMusic();
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
      return;
    }

    this.toast(t(this.locale, "menu.rewardedBoosterDenied"));
  }

  private async startDaily(boosted: boolean): Promise<void> {
    const dateUtc = this.getCurrentDateUtc();
    this.registry.set("pendingStartBooster", null);
    const save0 = this.saveManager.get();
    const normalized = normalizeDailySave(save0, dateUtc);
    if (normalized !== save0) {
      await this.saveManager.save(normalized);
      this.registry.set("saveData", this.saveManager.get());
    }

    const save = this.saveManager.get();
    const info = getDailyAttemptsInfo(this.staticData.daily, save, dateUtc);
    const plan = planDailyStart(info, {
      boosted,
      boosterEnabled: Boolean(this.staticData.balances.ads?.rewarded?.startBooster?.enabled),
    });

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ENTER, {
      dateUtc,
      attemptsUsed: info.attemptsUsed,
      maxAttempts: info.maxAttempts,
      startKind: plan.kind,
      boosted,
    });

    if (!plan.canStart) {
      this.toast(plan.reason === "booster_disabled" ? t(this.locale, "menu.boosterDisabled") : t(this.locale, "menu.noDailyAttempts"));
      return;
    }

    let boosterGranted = false;

    if (plan.needsBoosterRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_START_BOOSTER);
      if (!(res.ok && res.rewarded)) {
        this.toast(t(this.locale, "menu.rewardedBoosterDenied"));
        return;
      }
      boosterGranted = true;
      this.analytics.track(ANALYTICS_EVENTS.BOOSTER_REWARDED_ACCEPT, {
        dateUtc,
        mode: "daily",
        placement: AD_PLACEMENTS.DAILY_START_BOOSTER,
        reward: {
          bolts: Math.max(0, Math.floor(this.staticData.balances.ads?.rewarded?.startBooster?.addBolts ?? 0)),
          cores: Math.max(0, Math.floor(this.staticData.balances.ads?.rewarded?.startBooster?.addCores ?? 0)),
          tailSegments: Math.max(0, Math.floor(this.staticData.balances.ads?.rewarded?.startBooster?.addTailSegments ?? 0)),
        },
      });
    }

    if (plan.needsAttemptRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_ATTEMPT);
      if (!(res.ok && res.rewarded)) {
        this.toast(t(this.locale, "menu.rewardedAttemptDenied"));
        return;
      }
    }

    const next = consumeDailyAttempt(this.saveManager.get(), dateUtc);
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ATTEMPT_USED, {
      dateUtc,
      rewarded: plan.attemptWasRewarded,
      attemptsUsed: next.daily.attemptsUsed,
      boosted,
      startKind: plan.kind,
    });

    this.analytics.track(ANALYTICS_EVENTS.MENU_CTA_DAILY, {
      dateUtc,
      startKind: plan.kind,
      attemptsUsed: next.daily.attemptsUsed,
      boosted,
    });

    if (boosterGranted) {
      const cfg = this.staticData.balances.ads?.rewarded?.startBooster;
      this.registry.set("pendingStartBooster", {
        addTailSegments: Math.max(0, Math.floor(cfg?.addTailSegments ?? 0)),
        addBolts: Math.max(0, Math.floor(cfg?.addBolts ?? 0)),
        addCores: Math.max(0, Math.floor(cfg?.addCores ?? 0)),
        source: "rewarded",
      } satisfies PendingStartBoosterPayload);
    }
    this.stopMenuMusic();
    this.scene.start("game", { mode: "daily" });
    this.scene.launch("ui");
  }

  private async setVisualQuality(quality: SaveData["settings"]["visualQuality"]): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, visualQuality: quality } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
  }

  private async setAudioVolume(key: "sfxVolume" | "musicVolume", value: number): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, [key]: value } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
    if (key === "musicVolume") {
      (this.menuMusic as any)?.setVolume?.(value);
      if (this.menuMusic && typeof (this.menuMusic as any).volume === "number") (this.menuMusic as any).volume = value;
    }
  }

  private async setLanguage(language: LanguageSetting): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, language } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
  }

  private async setPilotName(pilotName: string): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, pilotName: sanitizePilotName(pilotName) } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
  }

  private async editPilotName(): Promise<void> {
    const promptFn = typeof window !== "undefined" && typeof window.prompt === "function" ? window.prompt.bind(window) : null;
    if (!promptFn) {
      this.toast(t(this.locale, "menu.pilotUnsupported"));
      return;
    }

    const current = this.saveManager.get().settings.pilotName ?? "";
    const submitted = promptFn(t(this.locale, "menu.pilotPrompt"), current);
    if (submitted === null) return;

    const next = sanitizePilotName(submitted);
    if (next === current) return;

    await this.setPilotName(next);
    this.toast(t(this.locale, "toast.pilot", { value: next || t(this.locale, "menu.pilotAuto") }));
    this.scene.restart();
  }

  private toast(msg: string): void {
    const { width, height } = this.scale;
    if (this.toastText) this.toastText.destroy();
    this.toastText = this.add.text(width / 2, height * 0.93, msg, { fontSize: "14px", color: "#d9f2ff" }).setOrigin(0.5);
    this.time.delayedCall(1500, () => {
      this.toastText?.destroy();
      this.toastText = null;
    });
  }

  private enableAudio(): void {
    if (this.audioEnabled) return;
    this.audioEnabled = true;

    try {
      const sm: any = this.sound;
      if (sm?.locked && typeof sm.unlock === "function") sm.unlock();
    } catch {
      // ignore
    }

    this.resumeMenuMusicIfAllowed();
  }

  private stopMenuMusic(): void {
    try {
      const track = (this.sound as any).get?.("music_menu") as Phaser.Sound.BaseSound | undefined;
      if (!track) return;
      if (typeof (track as any).pause === "function" && ((track as any).isPlaying || (track as any).isPaused === false)) {
        (track as any).pause();
        return;
      }
      if (track.isPlaying) track.stop();
    } catch {
      // ignore
    }
  }

  private getCurrentDateUtc(): string {
    return getUtcYyyymmdd(new Date(getPlatformNowMs(this.registry)));
  }

  private resolveLocaleSetting(setting: LanguageSetting): Locale {
    const platformLanguageHint = (this.registry.get("platformLanguageHint") as string | undefined) ?? null;
    return resolveLocale(setting, platformLanguageHint ? [platformLanguageHint] : null);
  }

  private setExternalPause(reason: string, paused: boolean): void {
    if (paused) this.suspendReasons.add(reason);
    else this.suspendReasons.delete(reason);

    if (this.suspendReasons.size > 0) {
      this.stopMenuMusic();
      return;
    }

    this.resumeMenuMusicIfAllowed();
  }

  private resumeMenuMusicIfAllowed(): void {
    if (!this.audioEnabled) return;
    if (this.suspendReasons.size > 0) return;

    try {
      const battleMusic = (this.sound as any).get?.("music_main") as Phaser.Sound.BaseSound | undefined;
      if (battleMusic?.isPlaying) battleMusic.stop();

      const volume = this.saveData?.settings?.musicVolume ?? 0.6;
      const existing = (this.sound as any).get?.("music_menu") as Phaser.Sound.BaseSound | undefined;
      this.menuMusic = existing ?? this.sound.add("music_menu", { loop: true, volume });
      (this.menuMusic as any)?.setVolume?.(volume);
      if (this.menuMusic && typeof (this.menuMusic as any).volume === "number") (this.menuMusic as any).volume = volume;

      if (typeof (this.menuMusic as any)?.resume === "function" && (this.menuMusic as any).isPaused) {
        (this.menuMusic as any).resume();
        return;
      }

      if (!this.menuMusic?.isPlaying) this.menuMusic?.play();
    } catch {
      // ignore
    }
  }
}

function snapVolumeStep(value: number): number {
  let best: number = VOLUME_STEPS[0];
  let bestDiff = Math.abs(value - best);
  for (const step of VOLUME_STEPS) {
    const diff = Math.abs(value - step);
    if (diff < bestDiff) {
      best = step;
      bestDiff = diff;
    }
  }
  return best;
}

function nextVolumeStep(current: number): number {
  const idx = VOLUME_STEPS.indexOf(snapVolumeStep(current) as (typeof VOLUME_STEPS)[number]);
  return VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length]!;
}

function formatVolumeLabel(locale: Locale, prefixKey: "settings.sfx" | "settings.music", value: number): string {
  return `${t(locale, prefixKey)}: ${formatVolume(locale, value)}`;
}

function formatLeaderboardReward(locale: Locale, reward: { bolts: number; cores: number }): string {
  const parts = [];
  if (reward.bolts > 0) parts.push(formatResource(locale, "bolts", reward.bolts));
  if (reward.cores > 0) parts.push(formatResource(locale, "cores", reward.cores));
  return parts.join(" | ");
}

function buildMenuBestText(locale: Locale, save: SaveData | null | undefined, topEntries: number): string {
  const stats = save?.stats ?? { bestWave: 0, bestBolts: 0 };
  const entries = save?.leaderboard?.entries ?? [];
  const lines = [
    t(locale, "menu.best", {
      bestWave: formatNumber(locale, stats.bestWave),
      bestBolts: formatNumber(locale, stats.bestBolts),
    }),
  ];

  if (topEntries <= 0) {
    return lines.join("\n");
  }

  lines.push(t(locale, "menu.leaderboardTitle"));

  if (entries.length <= 0) {
    lines.push(t(locale, "menu.leaderboardEmpty"));
    return lines.join("\n");
  }

  for (const [index, entry] of entries.slice(0, Math.max(1, topEntries)).entries()) {
    const modeLabel = entry.mode === "daily" ? t(locale, "leaderboard.mode.daily") : t(locale, "leaderboard.mode.run");
    const divisionLabel = t(locale, `leaderboard.division.${getLeaderboardDivision(entry.score).id}`);
    lines.push(
      `${index + 1}. ${entry.pilot} [${modeLabel} | ${divisionLabel}] | ${formatNumber(locale, entry.score)} | ${t(locale, "hud.wave")} ${formatNumber(locale, entry.wave)}`
    );
  }

  return lines.join("\n");
}

function formatMissionObjectiveLabel(locale: Locale, type: MissionObjectiveType, target: number): string {
  return t(locale, `menu.mission.${type}`, { target: formatNumber(locale, target) });
}

function getMenuDailySummaryTitle(locale: Locale): string {
  return locale === "ru" ? "ДЕЙЛИК СЕГОДНЯ" : "TODAY'S DAILY";
}

function getMenuWeeklyRaceTitle(locale: Locale): string {
  return locale === "ru" ? "НЕДЕЛЬНАЯ ГОНКА" : "WEEKLY RACE";
}

function getMenuWeeklyRaceEntryLine(locale: Locale): string {
  return locale === "ru" ? "Сделай заезд и войди в weekly" : "Post a run to enter weekly";
}

function formatMenuWeeklyRaceRankLine(locale: Locale, rank: number, division: string, score: string): string {
  return locale === "ru" ? `Weekly #${rank} | ${division} | ${score}` : `Weekly #${rank} | ${division} | ${score}`;
}

function formatMenuWeeklyRaceBestLine(locale: Locale, division: string, score: string): string {
  return locale === "ru" ? `Лучший за неделю | ${division} | ${score}` : `Best this week | ${division} | ${score}`;
}

function formatMenuWeeklyRaceTargetLine(locale: Locale, division: string, remaining: string, score: string): string {
  return locale === "ru" ? `До ${division}: ${remaining} | цель ${score}` : `Next ${division} in ${remaining} | goal ${score}`;
}

function formatMenuWeeklyRaceHotLine(locale: Locale, division: string, remaining: string): string {
  return locale === "ru" ? `\u0415\u0449\u0451 \u0440\u044b\u0432\u043e\u043a \u0434\u043e ${division} | ${remaining}` : `One strong run to ${division} | ${remaining}`;
}

function formatMenuLiveopsHeadline(
  locale: Locale,
  rotationBadge: string | null,
  rotationTitle: string | null,
  comebackEligible: boolean,
  comebackDays: number,
  comebackReward: string,
  tomorrowTitle: string
): string {
  if (comebackEligible) {
    return locale === "ru"
      ? `\u0412\u043e\u0437\u0432\u0440\u0430\u0442 ${comebackDays}\u0434 | ${comebackReward}`
      : `Comeback ${comebackDays}d | ${comebackReward}`;
  }
  if (rotationBadge) {
    return locale === "ru" ? `${rotationBadge} | ${rotationTitle ?? "\u0420\u043e\u0442\u0430\u0446\u0438\u044f"}` : `${rotationBadge} | ${rotationTitle ?? "Rotation"}`;
  }
  return locale === "ru" ? `\u0417\u0430\u0432\u0442\u0440\u0430 | ${tomorrowTitle}` : `Tomorrow | ${tomorrowTitle}`;
}

function formatMenuLiveopsStatusLine(
  locale: Locale,
  streakDay: string,
  streakReady: boolean,
  readyClaims: string,
  dailyDone: string,
  dailyTotal: string,
  weeklyDone: string,
  weeklyTotal: string
): string {
  return locale === "ru"
    ? `\u0421\u0435\u0440\u0438\u044f ${streakDay} ${streakReady ? "\u0413\u041e\u0422\u041e\u0412\u041e" : "\u0417\u0410\u0411\u0420\u0410\u041D\u041E"} | \u0433\u043e\u0442\u043e\u0432\u043e ${readyClaims} | \u0434 ${dailyDone}/${dailyTotal} | \u043d ${weeklyDone}/${weeklyTotal}`
    : `Streak ${streakDay} ${streakReady ? "READY" : "CLAIMED"} | ready ${readyClaims} | d ${dailyDone}/${dailyTotal} | w ${weeklyDone}/${weeklyTotal}`;
}

function formatMenuDailyLoginLine(locale: Locale, day: string, maxDay: string, reward: string): string {
  return locale === "ru" ? `\u041b\u043e\u0433\u0438\u043d ${day}/${maxDay} | ${reward}` : `Login ${day}/${maxDay} | ${reward}`;
}

function formatMenuDailyStatusLine(
  locale: Locale,
  used: string,
  max: string,
  best: string,
  nextStartState: "free" | "rewarded" | "locked"
): string {
  const nextLabel =
    locale === "ru"
      ? nextStartState === "free"
        ? "\u0441\u0442\u0430\u0440\u0442 \u0431\u0435\u0441\u043f\u043b."
        : nextStartState === "rewarded"
          ? "\u0441\u0442\u0430\u0440\u0442 \u0437\u0430 \u0440\u0435\u043a\u043b."
          : "\u0441\u0442\u0430\u0440\u0442 \u0437\u0430\u043a\u0440."
      : nextStartState === "free"
        ? "start free"
        : nextStartState === "rewarded"
          ? "start ad"
          : "start locked";
  return locale === "ru" ? `\u041f\u043e\u043f\u044b\u0442\u043a\u0438 ${used}/${max} | ${best} | ${nextLabel}` : `Attempts ${used}/${max} | ${best} | ${nextLabel}`;
}

function formatMenuRewardsSummary(locale: Locale, readyClaims: number): string {
  const ready = Math.max(0, Math.floor(readyClaims));
  if (locale === "ru") {
    return ready > 0 ? `\u0413\u043e\u0442\u043e\u0432\u043e ${ready}` : "\u041f\u043e\u043a\u0430 \u0442\u0438\u0445\u043e";
  }
  return ready > 0 ? `Ready ${ready}` : "Quiet for now";
}

function formatMenuProgressSummary(locale: Locale, done: number, total: number): string {
  const safeDone = formatNumber(locale, Math.max(0, Math.floor(done)));
  const safeTotal = formatNumber(locale, Math.max(0, Math.floor(total)));
  return locale === "ru" ? `${safeDone}/${safeTotal} \u0432\u044b\u043f.` : `${safeDone}/${safeTotal} complete`;
}

function getMenuLayoutMode(width: number, height: number): MenuLayoutMode {
  if (width >= MENU_LAYOUT_BREAKPOINTS.fullWidth && height >= MENU_LAYOUT_BREAKPOINTS.fullHeight) return "full";
  if (width < MENU_LAYOUT_BREAKPOINTS.minimalWidth || height < MENU_LAYOUT_BREAKPOINTS.minimalHeight) return "minimal";
  return "compact";
}

function getMenuWeeklyRaceTopLine(locale: Locale): string {
  return locale === "ru" ? "Верхняя лига уже взята" : "Top division secured";
}

function formatMenuWeeklyRaceLaunchLine(locale: Locale, division: string, score: string): string {
  return locale === "ru" ? `Первый порог ${division} на ${score}` : `First step ${division} at ${score}`;
}

function _formatMenuWeeklyRaceRewardLine(locale: Locale, reward: string, usingPlatformBoard: boolean): string {
  if (locale === "ru") return usingPlatformBoard ? `Награда недели ${reward}` : `Local weekly | награда ${reward}`;
  return usingPlatformBoard ? `Week payout ${reward}` : `Local weekly | payout ${reward}`;
}

function formatCompactRewardLabel(locale: Locale, reward: { bolts: number; cores: number }): string {
  const parts: string[] = [];
  if (reward.bolts > 0) {
    parts.push(`${formatNumber(locale, reward.bolts)}${locale === "ru" ? "Б" : "B"}`);
  }
  if (reward.cores > 0) {
    parts.push(`${formatNumber(locale, reward.cores)}${locale === "ru" ? "Я" : "C"}`);
  }
  return parts.join(" | ");
}

function getMenuWeeklyRaceNoRewardCompactLabel(locale: Locale): string {
  return locale === "ru" ? "0Б" : "0";
}

function getMenuWeeklyRaceHeldRewardBadgeLabel(locale: Locale, reward: string): string {
  return locale === "ru" ? `СБРОС ${reward}` : `RESET ${reward}`;
}

function getMenuWeeklyRaceRiskBadgeConfig(
  locale: Locale,
  topLocked: boolean,
  rewardDelta: string | null,
  entryReward: string | null
): { label: string; fill: number; stroke: number; text: string; alpha: number; strokeAlpha: number } {
  if (topLocked) {
    return {
      label: locale === "ru" ? "ТОП УДЕРЖАН" : "TOP SAFE",
      fill: 0x13283d,
      stroke: 0x5cc8ff,
      text: "#d9f2ff",
      alpha: 0.2,
      strokeAlpha: 0.62,
    };
  }
  if (rewardDelta) {
    return {
      label: locale === "ru" ? `СГОРИТ +${rewardDelta}` : `BURNS +${rewardDelta}`,
      fill: 0x21170c,
      stroke: 0xffd166,
      text: "#fff0d4",
      alpha: 0.24,
      strokeAlpha: 0.72,
    };
  }
  if (entryReward) {
    return {
      label: locale === "ru" ? `ВХОД ${entryReward}` : `ENTRY ${entryReward}`,
      fill: 0x1b1508,
      stroke: 0xffd166,
      text: "#fff0d4",
      alpha: 0.22,
      strokeAlpha: 0.68,
    };
  }
  return {
    label: locale === "ru" ? "ДЕРЖИ ПЭЙАУТ" : "HOLD PAYOUT",
    fill: 0x13283d,
    stroke: 0x5cc8ff,
    text: "#d9f2ff",
    alpha: 0.18,
    strokeAlpha: 0.56,
  };
}

function _formatMenuWeeklyRaceLeaderRewardLine(
  locale: Locale,
  reward: string,
  leaderName: string,
  leaderScore: string,
  usingPlatformBoard: boolean
): string {
  if (locale === "ru") {
    return usingPlatformBoard ? `Награда ${reward} | лидер ${leaderName} ${leaderScore}` : `Local weekly | ${reward} | лучший ${leaderName} ${leaderScore}`;
  }
  return usingPlatformBoard ? `Payout ${reward} | leader ${leaderName} ${leaderScore}` : `Local weekly | ${reward} | best ${leaderName} ${leaderScore}`;
}

function _getMenuWeeklyRaceNoRewardLabel(locale: Locale): string {
  return locale === "ru" ? "без награды" : "no payout yet";
}

function getMenuWeeklyRaceStateBadgeLabel(
  locale: Locale,
  state: "enter" | "climbing" | "payout" | "near_promo" | "hot_run" | "top"
): string {
  if (locale === "ru") {
    if (state === "hot_run") return "\u0420\u042b\u0412\u041e\u041A";
    if (state === "enter") return "\u0412\u0425\u041e\u0414";
    if (state === "climbing") return "\u0412 \u0413\u041e\u041d\u041A\u0415";
    if (state === "payout") return "\u041D\u0410\u0413\u0420\u0410\u0414\u0410";
    if (state === "near_promo") return "\u0410\u041F \u0420\u042F\u0414\u041E\u041C";
    return "\u0422\u041E\u041F";
  }
  if (state === "hot_run") return "HOT RUN";
  if (state === "enter") return "ENTER";
  if (state === "climbing") return "RACING";
  if (state === "payout") return "PAYOUT";
  if (state === "near_promo") return "NEAR PROMO";
  return "TOP";
}

function _getMenuWeeklyRaceStateLabel(
  locale: Locale,
  state: "enter" | "climbing" | "payout" | "near_promo" | "hot_run" | "top"
): string {
  if (locale === "ru") {
    if (state === "enter") return "\u0412\u0425\u041e\u0414";
    if (state === "climbing") return "\u0412 \u0413\u041e\u041d\u041a\u0415";
    if (state === "payout") return "\u041d\u0410\u0413\u0420\u0410\u0414\u0410";
    if (state === "near_promo") return "\u0410\u041f \u0420\u042f\u0414\u041e\u041c";
    return "\u0422\u041e\u041f";
  }
  if (state === "enter") return "ENTER";
  if (state === "climbing") return "RACING";
  if (state === "payout") return "PAYOUT";
  if (state === "near_promo") return "NEAR PROMO";
  return "TOP";
}

function getMenuWeeklyRaceJumpLabel(locale: Locale, state: "debut" | "up" | "down", value: number | null): string {
  const safeValue = Math.max(0, Math.floor(value ?? 0));
  if (state === "debut") {
    return locale === "ru" ? `\u041d\u041e\u0412\u042b\u0419 #${safeValue}` : `NEW #${safeValue}`;
  }
  return state === "up" ? `+${safeValue}` : `-${safeValue}`;
}

function getMenuWeeklyRaceProgressLabel(locale: Locale, percent: number, division: string): string {
  return locale === "ru" ? `${percent}% \u0434\u043e ${division}` : `${percent}% to ${division}`;
}

function getMenuWeeklyRaceHotProgressLabel(locale: Locale, division: string): string {
  return locale === "ru" ? `\u0420\u042b\u0412\u041e\u041A \u0414\u041e ${division}` : `PUSH TO ${division}`;
}

function getNextWeeklyResetAtMs(nowMs: number): number {
  const now = new Date(nowMs);
  const daysUntilNextMonday = now.getUTCDay() === 0 ? 1 : 8 - now.getUTCDay();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilNextMonday);
}

function getMenuWeeklyResetBadgeLabel(locale: Locale, remainingMs: number): string {
  const safeMs = Math.max(0, remainingMs);
  const days = Math.floor(safeMs / (24 * 60 * 60 * 1000));
  const totalHours = Math.floor(safeMs / (60 * 60 * 1000));
  const hours = Math.floor((safeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.floor((safeMs % (60 * 60 * 1000)) / (60 * 1000)));
  if (days >= 1) {
    return locale === "ru" ? `\u0421\u0411\u0420\u041e\u0421 ${days}\u0414 ${hours}\u0427` : `RESET ${days}D ${hours}H`;
  }
  if (totalHours >= 1) {
    return locale === "ru" ? `\u0421\u0411\u0420\u041e\u0421 ${totalHours}\u0427` : `RESET ${totalHours}H`;
  }
  return locale === "ru" ? `\u0421\u0411\u0420\u041e\u0421 ${minutes}\u041c` : `RESET ${minutes}M`;
}

function getMenuWeeklyRaceProgressTopLabel(locale: Locale): string {
  return locale === "ru" ? "\u0412\u0415\u0420\u0425\u041d\u042f\u042f \u041b\u0418\u0413\u0410" : "TOP DIVISION";
}

function getMenuBoardDivisionReward(
  cfg: StaticGameData["leaderboards"],
  key: "daily" | "weekly" | "all_time",
  division: LeaderboardDivisionId
): { bolts: number; cores: number } {
  const reward = cfg.boards.find((board) => board.key === key)?.rewardByDivision?.[division];
  return reward ? { bolts: Math.max(0, reward.bolts), cores: Math.max(0, reward.cores) } : { bolts: 0, cores: 0 };
}

function fitTextScaleToWidth(text: Phaser.GameObjects.Text, maxWidth: number, minScale = 0.72): void {
  text.setScale(1);
  if (text.width <= 0 || text.width <= maxWidth) return;
  text.setScale(Phaser.Math.Clamp(maxWidth / text.width, minScale, 1));
}

function getLiveopsPanelMetrics(width: number, compact: boolean, height = 1080): { width: number; height: number; stacked: boolean } {
  const panelWidth = compact ? Math.max(332, Math.min(width - 44, 540)) : 468;
  const stacked = compact && panelWidth <= 430;
  const shortDesktop = !compact && height <= 820;
  return {
    width: panelWidth,
    height: stacked ? 640 : compact ? 412 : shortDesktop ? 344 : 396,
    stacked,
  };
}

function formatCareerMilestoneTitles(locale: Locale, ids: readonly LeaderboardCareerMilestoneId[]): string {
  return ids.map((id) => t(locale, `leaderboard.milestone.${id}`)).join(" | ");
}

function formatCareerMilestoneLine(
  locale: Locale,
  milestone: ReturnType<typeof getLeaderboardCareerMilestones>[number],
  progress: ReturnType<typeof getLeaderboardCareerProgress>,
  unlocked: boolean,
  justUnlocked: boolean
): string {
  const title = t(locale, `leaderboard.milestone.${milestone.id}`);
  const reward = formatLeaderboardReward(locale, milestone.reward);
  const prefix = justUnlocked ? `${t(locale, "menu.careerNewBadge")} ` : "";
  if (unlocked) return `${prefix}${title} | ${t(locale, "menu.careerUnlocked")} | ${reward}`;

  if (typeof milestone.score === "number") {
    return `${prefix}${title} | ${t(locale, "results.score")}: ${formatNumber(locale, progress.bestScore)}/${formatNumber(locale, milestone.score)} | ${reward}`;
  }
  if (typeof milestone.wave === "number") {
    return `${prefix}${title} | ${t(locale, "hud.wave")}: ${formatNumber(locale, progress.bestWave)}/${formatNumber(locale, milestone.wave)} | ${reward}`;
  }
  if (typeof milestone.bolts === "number") {
    return `${prefix}${title} | ${t(locale, "hud.bolts")}: ${formatNumber(locale, progress.bestBolts)}/${formatNumber(locale, milestone.bolts)} | ${reward}`;
  }
  if (milestone.division) {
    return `${prefix}${title} | ${t(locale, "results.division")}: ${t(locale, `leaderboard.division.${progress.highestDivision}`)}/${t(locale, `leaderboard.division.${milestone.division}`)} | ${reward}`;
  }
  return `${prefix}${title} | ${reward}`;
}

function sanitizeCareerMilestoneIds(raw: unknown): LeaderboardCareerMilestoneId[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<LeaderboardCareerMilestoneId>();
  for (const item of raw) {
    if (item === "score_25000" || item === "wave_20" || item === "salvage_400" || item === "legend_league") {
      unique.add(item);
    }
  }
  return [...unique];
}

function getPortalBoardsTitle(locale: Locale): string {
  return locale === "ru" ? "ПОРТАЛЬНЫЕ ДОСКИ" : "PORTAL BOARDS";
}

function getPortalBoardLoadingLabel(locale: Locale): string {
  return locale === "ru" ? "Загрузка portal boards..." : "Loading portal boards...";
}

function getPortalBoardUnavailableLabel(locale: Locale): string {
  return locale === "ru" ? "portal boards недоступны" : "portal boards unavailable";
}

function getPortalBoardEmptyLabel(locale: Locale): string {
  return locale === "ru" ? "топ пуст" : "top empty";
}

function getPortalBoardUnrankedLabel(locale: Locale): string {
  return locale === "ru" ? "без места" : "unranked";
}

function getPortalBoardFallbackLabel(locale: Locale): string {
  return locale === "ru" ? "local fallback" : "local fallback";
}

function getPortalBoardTopLabel(locale: Locale): string {
  return locale === "ru" ? "верхняя лига" : "top division";
}

function getPortalBoardTargetLabel(locale: Locale, division: string, score: string): string {
  return locale === "ru" ? `цель ${division} на ${score}` : `target ${division} at ${score}`;
}

function getPortalBoardLeaderLabel(locale: Locale, playerName: string, score: string): string {
  return locale === "ru" ? `лидер ${playerName} ${score}` : `leader ${playerName} ${score}`;
}

function getPortalBoardLabel(locale: Locale, key: "daily" | "weekly" | "all_time"): string {
  if (locale === "ru") {
    if (key === "daily") return "День";
    if (key === "weekly") return "Неделя";
    return "Все время";
  }
  if (key === "daily") return "Daily";
  if (key === "weekly") return "Weekly";
  return "All-Time";
}

function _buildInstalledMetaSummary(
  locale: Locale,
  nodes: Array<{ id: string; name: string }>,
  levels: Record<string, number>
): string {
  const active = nodes
    .map((node) => ({ node, level: Math.max(0, Math.floor(levels[node.id] ?? 0)) }))
    .filter((entry) => entry.level > 0)
    .map((entry) => {
      const badge = getMetaNodeBadgeSpecs(locale, entry.node.id, 1)[0];
      const label = badge?.label ?? getMetaNodeName(locale, entry.node.id, entry.node.name);
      return `${label} ${locale === "ru" ? "ур." : "Lv."}${entry.level}`;
    });

  return active.length > 0
    ? t(locale, "menu.installedList", { items: active.join(" | ") })
    : t(locale, "menu.installedNone");
}

function createMenuBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  fill: number,
  stroke: number,
  textColor: string
): Phaser.GameObjects.Container {
  const text = scene.add
    .text(0, 0, label, {
      fontSize: "10px",
      color: textColor,
      fontStyle: "700",
    })
    .setOrigin(0.5);
  const bg = scene.add.rectangle(0, 0, text.width + 16, 20, fill, 0.96).setStrokeStyle(1, stroke, 0.92);
  return scene.add.container(x, y, [bg, text]);
}
