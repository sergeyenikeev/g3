import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart, type DailyAttemptsInfo } from "../daily/dailyAttempts";
import { getMetaNodeCost, getMetaNodeLevel, getMetaWalletAmount, purchaseMetaNode } from "../meta/metaProgression";
import {
  filterLeaderboardEntries,
  getLeaderboardCareerMilestones,
  getLeaderboardCareerProgress,
  getLeaderboardDivision,
  getLeaderboardNextDivision,
  getNextLeaderboardCareerMilestone,
  type LeaderboardFilter,
} from "../run/leaderboard";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import { bindPageLifecycle } from "../../platform/pageLifecycle";
import type { PlatformAdapter } from "../../platform/platformAdapter";
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
  private leaderboardFooterText!: Phaser.GameObjects.Text;
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
    const stats = save?.stats ?? { bestWave: 0, bestBolts: 0 };
    const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
    const boosterEnabled = Boolean(boosterCfg?.enabled);

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
        [
          t(this.locale, "menu.best", {
            bestWave: formatNumber(this.locale, stats.bestWave),
            bestBolts: formatNumber(this.locale, stats.bestBolts),
          }),
          t(this.locale, "menu.leaderboardTitle"),
          ...((save?.leaderboard?.entries?.length ?? 0) > 0
            ? (save?.leaderboard?.entries ?? []).slice(0, 3).map((entry, index) => {
                const modeLabel = entry.mode === "daily" ? t(this.locale, "leaderboard.mode.daily") : t(this.locale, "leaderboard.mode.run");
                const divisionLabel = t(this.locale, `leaderboard.division.${getLeaderboardDivision(entry.score).id}`);
                return `${index + 1}. ${entry.pilot} [${modeLabel} | ${divisionLabel}] | ${formatNumber(this.locale, entry.score)} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, entry.wave)}`;
              })
            : [t(this.locale, "menu.leaderboardEmpty")]),
        ]
          .join("\n"),
        {
          fontSize: "16px",
          color: "#98b7c7",
          align: "center",
          wordWrap: { width: 560 },
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
      this.stopMenuMusic();
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
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

    const dailyInfo = this.add
      .text(0, 0, "", { fontSize: "14px", color: "#c9dbe6", align: "center", wordWrap: { width: 520 } })
      .setOrigin(0.5)
      .setLineSpacing(5);

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
      const boostedPlan = planDailyStart(info, { boosted: true, boosterEnabled });

      labelDaily.setText(
        regularPlan.canStart
          ? regularPlan.kind === "free"
            ? t(this.locale, "menu.dailyFree")
            : t(this.locale, "menu.dailyRewarded")
          : t(this.locale, "menu.dailyLocked")
      );
      applyDailyButtonState(btnDaily, labelDaily, regularPlan.canStart, regularPlan.kind === "rewarded" ? 0x57c27d : 0x3aa4d4);

      if (!boosterEnabled) return;

      labelDailyBoost.setText(
        boostedPlan.canStart
          ? boostedPlan.kind === "boosted_rewarded"
            ? t(this.locale, "menu.dailyBoostExtra")
            : t(this.locale, "menu.dailyBoost")
          : t(this.locale, "menu.dailyBoostLocked")
      );
      applyDailyButtonState(btnDailyBoost, labelDailyBoost, boostedPlan.canStart, 0x57c27d);
    };

    btnDaily.on("pointerdown", () => void this.startDaily(false));
    btnDailyBoost.on("pointerdown", () => void this.startDaily(true));
    this.createWorkshopUi();
    this.createLeaderboardUi();

    const layoutMenu = (s: { width: number; height: number }) => {
      const compact = s.width < 1100;
      const leftX = compact ? s.width / 2 : Math.round(s.width * 0.31);
      const titleY = compact ? Math.round(s.height * 0.13) : Math.round(s.height * 0.2);

      title.setPosition(leftX, titleY);
      taglineText.setPosition(leftX, titleY + 58);
      bestText.setPosition(leftX, titleY + 110);
      this.walletText?.setPosition(16, 16);
      btnWorkshop.setPosition(16, 46);
      labelWorkshop.setPosition(btnWorkshop.x + btnWorkshop.width / 2, btnWorkshop.y + btnWorkshop.height / 2);
      btnLeaderboard.setPosition(16, 88);
      labelLeaderboard.setPosition(btnLeaderboard.x + btnLeaderboard.width / 2, btnLeaderboard.y + btnLeaderboard.height / 2);
      btnPilot.setPosition(16, 130);
      labelPilot.setPosition(btnPilot.x + btnPilot.width / 2, btnPilot.y + btnPilot.height / 2);

      btnQuality.setPosition(s.width - 16, 16);
      labelQuality.setPosition(btnQuality.x - btnQuality.width / 2, btnQuality.y + btnQuality.height / 2);
      btnSfx.setPosition(s.width - 16, 56);
      labelSfx.setPosition(btnSfx.x - btnSfx.width / 2, btnSfx.y + btnSfx.height / 2);
      btnMusic.setPosition(s.width - 16, 96);
      labelMusic.setPosition(btnMusic.x - btnMusic.width / 2, btnMusic.y + btnMusic.height / 2);
      btnLanguage.setPosition(s.width - 16, 136);
      labelLanguage.setPosition(btnLanguage.x - btnLanguage.width / 2, btnLanguage.y + btnLanguage.height / 2);

      this.layoutMenuBackdrop(s.width, s.height, compact, leftX);

      const ctaStartY = compact ? Math.round(s.height * 0.42) : Math.round(s.height * 0.43);
      const rowGap = compact ? 72 : 68;
      btnPlay.setPosition(leftX, ctaStartY);
      labelPlay.setPosition(btnPlay.x, btnPlay.y);
      btnPlayBoost.setPosition(leftX, ctaStartY + rowGap);
      labelPlayBoost.setPosition(btnPlayBoost.x, btnPlayBoost.y);
      btnTraining.setPosition(leftX, ctaStartY + rowGap * 2);
      labelTraining.setPosition(btnTraining.x, btnTraining.y);
      btnDaily.setPosition(leftX, ctaStartY + rowGap * 3 + 6);
      labelDaily.setPosition(btnDaily.x, btnDaily.y);
      btnDailyBoost.setPosition(leftX, ctaStartY + rowGap * 4 + 4);
      labelDailyBoost.setPosition(btnDailyBoost.x, btnDailyBoost.y);
      dailyInfo.setPosition(leftX, compact ? s.height - 114 : s.height - 112);
      dailyInfo.setWordWrapWidth(compact ? Math.max(280, Math.min(580, s.width - 54)) : 360, true);
      controlsText.setPosition(leftX, compact ? s.height - 44 : s.height - 42);
      if (this.toastText) this.toastText.setPosition(s.width / 2, s.height * 0.93);
      this.layoutWorkshop();
      this.layoutLeaderboard();
    };

    const onResize = (s: Phaser.Structs.Size) => layoutMenu(s);
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
      releasePageLifecycle();
      releasePlatformLifecycle();
      this.suspendReasons.clear();
    });

    layoutMenu(this.scale);
    this.refreshWalletSummary();
    this.time.delayedCall(0, () => {
      void signalPlatformGameReady(this.platformAdapter, this.registry);
    });
    void this.ensureDailyNormalizedAndRefresh(dailyInfo).then((info) => refreshDailyButtons(info));
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
      this.heroBaseY + 126 + Math.cos(this.menuTime * 1.1) * 6
    );
    this.heroTruck.setRotation(-0.08 + Math.sin(this.menuTime * 0.9) * 0.04);

    this.heroEscortA.setPosition(
      this.heroBaseX - 82 + Math.cos(this.menuTime * 1.8) * 8,
      this.heroBaseY + 38 + Math.sin(this.menuTime * 1.2) * 12
    );
    this.heroEscortB.setPosition(
      this.heroBaseX + 94 + Math.cos(this.menuTime * 1.35 + 1.1) * 10,
      this.heroBaseY - 16 + Math.sin(this.menuTime * 1.55 + 0.7) * 10
    );
    this.heroThreatA.setPosition(
      this.heroBaseX - 122 + Math.sin(this.menuTime * 1.5) * 12,
      this.heroBaseY - 102 + Math.cos(this.menuTime * 1.8) * 10
    );
    this.heroThreatA.setRotation(0.25 + Math.sin(this.menuTime * 1.25) * 0.1);
    this.heroThreatB.setPosition(
      this.heroBaseX + 132 + Math.cos(this.menuTime * 1.1) * 12,
      this.heroBaseY + 84 + Math.sin(this.menuTime * 1.6) * 10
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
    this.dailyPanel = this.add.rectangle(0, 0, 420, 148, 0x0b141d, 0.82).setDepth(-12).setStrokeStyle(2, 0x5cc8ff, 0.32);
    this.heroPanel = this.add.rectangle(0, 0, 470, 470, 0x08111a, 0.72).setDepth(-12).setStrokeStyle(2, 0xffd166, 0.36);

    this.heroRecycler = this.add.image(0, 0, "recycler").setDepth(-10).setScale(1.28);
    this.heroTruck = this.add.image(0, 0, "player").setDepth(-9).setScale(4.4);
    this.heroEscortA = this.add.image(0, 0, "scrap_heavy").setDepth(-9).setScale(1.7).setAlpha(0.92);
    this.heroEscortB = this.add.image(0, 0, "scrap_rare").setDepth(-9).setScale(1.7).setAlpha(0.92);
    this.heroThreatA = this.add.image(0, 0, "enemy_chaser").setDepth(-9).setScale(2.2).setAlpha(0.95);
    this.heroThreatB = this.add.image(0, 0, "enemy_cutter").setDepth(-9).setScale(2.1).setAlpha(0.95);

    this.heroCaptionText = this.add
      .text(0, 0, t(this.locale, "menu.tagline"), {
        fontSize: "18px",
        color: "#f3f7fb",
        fontStyle: "700",
        align: "center",
      })
      .setDepth(-8)
      .setOrigin(0.5);
    this.heroHintText = this.add
      .text(0, 0, t(this.locale, "menu.heroLead"), {
        fontSize: "14px",
        color: "#9eb6c4",
        align: "center",
        wordWrap: { width: 340 },
      })
      .setDepth(-8)
      .setOrigin(0.5);
  }

  private layoutMenuBackdrop(width: number, height: number, compact: boolean, leftX: number): void {
    this.bgFar.setSize(width, height).setDisplaySize(width, height);
    this.bgTile.setSize(width, height).setDisplaySize(width, height);
    this.menuGlowLeft.setPosition(Math.round(width * 0.2), Math.round(height * 0.2));
    this.menuGlowRight.setPosition(Math.round(width * 0.83), Math.round(height * 0.66));

    this.menuPanel.setPosition(leftX, compact ? Math.round(height * 0.48) : Math.round(height * 0.55));
    this.menuPanel.setSize(compact ? Math.min(width - 44, 480) : 432, compact ? 410 : 432);

    this.dailyPanel.setPosition(leftX, compact ? height - 106 : height - 104);
    this.dailyPanel.setSize(compact ? Math.min(width - 44, 520) : 432, compact ? 140 : 148);

    this.heroBaseX = compact ? Math.round(width / 2) : Math.round(width * 0.74);
    this.heroBaseY = compact ? Math.round(height * 0.8) : Math.round(height * 0.48);

    this.heroPanel.setVisible(!compact);
    this.heroRecycler.setVisible(!compact);
    this.heroTruck.setVisible(!compact);
    this.heroEscortA.setVisible(!compact);
    this.heroEscortB.setVisible(!compact);
    this.heroThreatA.setVisible(!compact);
    this.heroThreatB.setVisible(!compact);
    this.heroCaptionText.setVisible(!compact);
    this.heroHintText.setVisible(!compact);

    if (!compact) {
      this.heroPanel.setPosition(this.heroBaseX, this.heroBaseY + 18);
      this.heroCaptionText.setPosition(this.heroBaseX, this.heroBaseY - 184);
      this.heroHintText.setPosition(this.heroBaseX, this.heroBaseY + 200);
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

    const panel = this.add.rectangle(0, 0, 620, 760, 0x0f1720, 0.98).setStrokeStyle(2, 0xffd166, 0.82);
    const accent = this.add.rectangle(0, -314, 520, 2, 0x5cc8ff, 0.84);
    const title = this.add
      .text(0, -338, t(this.locale, "menu.workshop"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setShadow(0, 0, "#5cc8ff", 18, true, true)
      .setOrigin(0.5);
    this.workshopWalletText = this.add
      .text(-270, -304, "", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700", wordWrap: { width: 540 } })
      .setOrigin(0, 0);
    this.workshopHintText = this.add
      .text(-270, -270, t(this.locale, "menu.installedBuild"), {
        fontSize: "12px",
        color: "#98b7c7",
        fontStyle: "700",
        wordWrap: { width: 540 },
      })
      .setOrigin(0, 0);

    const btnClose = this.add
      .rectangle(260, -338, 72, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelClose = this.add
      .text(260, -338, t(this.locale, "menu.close"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnClose.on("pointerdown", () => this.hideWorkshop());

    this.workshopFooterText = this.add
      .text(-270, 332, t(this.locale, "menu.workshopFooter"), {
        fontSize: "12px",
        color: "#98b7c7",
        wordWrap: { width: 540 },
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

    const panel = this.add.rectangle(0, 0, 700, 780, 0x0f1720, 0.98).setStrokeStyle(2, 0x5cc8ff, 0.82);
    const accent = this.add.rectangle(0, -336, 592, 2, 0xffd166, 0.9);
    const title = this.add
      .text(0, -360, t(this.locale, "menu.leaderboardTitle"), {
        fontSize: "28px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setShadow(0, 0, "#5cc8ff", 18, true, true)
      .setOrigin(0.5);
    this.leaderboardHintText = this.add
      .text(0, -318, "", {
        fontSize: "13px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5);

    const btnClose = this.add
      .rectangle(292, -360, 72, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelClose = this.add
      .text(292, -360, t(this.locale, "menu.close"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnClose.on("pointerdown", () => this.hideLeaderboard());

    this.leaderboardFilterButtons = [];
    const filters: LeaderboardFilter[] = ["all", "run", "daily"];
    filters.forEach((filter, index) => {
      const x = -184 + index * 184;
      const button = this.add
        .rectangle(x, -270, 148, 38, 0x121a24, 0.96)
        .setStrokeStyle(2, 0x5f6b76, 0.58)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, -270, t(this.locale, `leaderboard.filter.${filter}`), {
          fontSize: "14px",
          color: "#d9f2ff",
          fontStyle: "700",
        })
        .setOrigin(0.5);
      button.on("pointerdown", () => {
        this.leaderboardFilter = filter;
        this.refreshLeaderboardSummary();
      });
      this.leaderboardFilterButtons.push({ filter, button, label });
    });

    this.leaderboardRows = [];
    for (let i = 0; i < 10; i++) {
      const y = -208 + i * 54;
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

    this.leaderboardFooterText = this.add
      .text(0, 332, "", {
        fontSize: "13px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [
      panel,
      accent,
      title,
      this.leaderboardHintText,
      btnClose,
      labelClose,
      this.leaderboardFooterText,
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
    const scale = Math.min(1, (width - 32) / 620, (height - 32) / 760);
    this.workshopBox.setScale(scale).setPosition(width / 2, height / 2);
  }

  private layoutLeaderboard(): void {
    if (!this.leaderboardDim || !this.leaderboardBox) return;
    const { width, height } = this.scale;
    this.leaderboardDim.setSize(width, height);
    const scale = Math.min(1, (width - 32) / 700, (height - 32) / 780);
    this.leaderboardBox.setScale(scale).setPosition(width / 2, height / 2);
  }

  private showWorkshop(): void {
    this.hideLeaderboard();
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
    this.refreshLeaderboardSummary();
    this.leaderboardDim.setVisible(true);
    this.leaderboardBox.setVisible(true);
    this.layoutLeaderboard();
  }

  private hideLeaderboard(): void {
    this.leaderboardDim.setVisible(false);
    this.leaderboardBox.setVisible(false);
  }

  private refreshLeaderboardSummary(): void {
    const save = this.saveManager.get();
    this.saveData = save;
    this.refreshWalletSummary();

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
  }

  private normalizeLeaderboardFilter(entries: readonly SaveData["leaderboard"]["entries"][number][], filter: LeaderboardFilter): LeaderboardFilter {
    if (filter === "all") return "all";
    const hasRequestedMode = entries.some((entry) => entry.mode === filter);
    if (hasRequestedMode) return filter;
    if (filter === "daily") return entries.some((entry) => entry.mode === "run") ? "run" : "all";
    return entries.some((entry) => entry.mode === "daily") ? "daily" : "all";
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
    let chipCursorX = -270;
    for (const entry of activeMetaEntries) {
      const badge = getMetaNodeBadgeSpecs(this.locale, entry.node.id, 1)[0];
      if (!badge) continue;
      const chip = createMenuBadge(this, 0, -244, `${badge.label} ${entry.level}`, badge.fill, badge.stroke, badge.textColor);
      const chipBg = chip.list[0] as Phaser.GameObjects.Rectangle | undefined;
      const chipWidth = chipBg?.width ?? 0;
      chip.setPosition(chipCursorX + chipWidth / 2, -244);
      chipCursorX += chipWidth + 8;
      this.workshopBuildChips.push(chip);
      this.workshopBox.add(chip);
    }

    for (const card of this.workshopCards) card.destroy();
    this.workshopCards = [];

    this.staticData.metaTree.nodes.forEach((node, idx) => {
      const level = getMetaNodeLevel(save, node.id);
      const cost = getMetaNodeCost(this.staticData.metaTree, node.id, level);
      const currencyAmount = cost ? getMetaWalletAmount(save, cost.currency) : 0;
      const costAmount = cost?.amount ?? Number.POSITIVE_INFINITY;
      const affordable = Boolean(cost) && currencyAmount >= costAmount;
      const maxed = level >= node.maxLevel || !cost;
      const badge = getMetaNodeBadgeSpecs(this.locale, node.id, 1)[0];
      const y = -170 + idx * 102;
      const accentColor = maxed ? 0x57c27d : badge?.stroke ?? (cost?.currency === "cores" ? 0xffd166 : idx % 2 === 0 ? 0x5cc8ff : 0x3aa4d4);

      const bg = this.add.rectangle(0, 0, 548, 90, 0x121a24, 0.97).setStrokeStyle(2, accentColor, maxed ? 0.72 : 0.58);
      const accent = this.add.rectangle(-268, 0, 8, 90, accentColor, 0.92);
      const title = this.add
        .text(-256, -28, getMetaNodeName(this.locale, node.id, node.name), {
          fontSize: "17px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: 272 },
        })
        .setOrigin(0, 0);
      const badgeNode = badge
        ? createMenuBadge(this, 56, -18, badge.label, badge.fill, badge.stroke, badge.textColor)
        : null;
      const desc = this.add
        .text(-256, -2, getMetaNodeDescription(this.locale, node.id), {
          fontSize: "13px",
          color: "#98b7c7",
          wordWrap: { width: 330 },
        })
        .setOrigin(0, 0);
      const levelText = this.add
        .text(-256, 24, t(this.locale, "menu.level", { level, maxLevel: node.maxLevel }), {
          fontSize: "12px",
          color: maxed ? "#57c27d" : "#7fdfff",
          fontStyle: "700",
        })
        .setOrigin(0, 0);
      const progressBg = this.add.rectangle(-110, 31, 148, 6, 0x0b141d, 0.95).setOrigin(0, 0.5);
      const progressFill = this.add
        .rectangle(-110, 31, 148 * Phaser.Math.Clamp(node.maxLevel <= 0 ? 1 : level / node.maxLevel, 0, 1), 6, accentColor, 0.98)
        .setOrigin(0, 0.5);

      const btn = this.add
        .rectangle(180, 0, 130, 42, affordable ? 0x1b2635 : 0x0d131b, 0.98)
        .setStrokeStyle(2, maxed ? 0x57c27d : affordable ? 0xffd166 : 0x5f6b76, 0.86);
      const priceLabel = cost ? formatResource(this.locale, cost.currency, cost.amount) : t(this.locale, "menu.maxed");
      const btnLabel = this.add
        .text(
          180,
          -8,
          maxed ? t(this.locale, "menu.installedButton") : affordable ? t(this.locale, "menu.buy") : t(this.locale, "menu.locked"),
          { fontSize: "13px", color: "#d9f2ff", fontStyle: "700" }
        )
        .setOrigin(0.5);
      const costLabel = this.add
        .text(180, 12, priceLabel, { fontSize: "11px", color: maxed ? "#57c27d" : affordable ? "#ffd166" : "#98b7c7", fontStyle: "700" })
        .setOrigin(0.5);

      if (!maxed && affordable) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => void this.buyMetaNode(node.id));
      }

      const card = this.add
        .container(0, y, [bg, accent, title, ...(badgeNode ? [badgeNode] : []), desc, levelText, progressBg, progressFill, btn, btnLabel, costLabel])
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
    const normalized = normalizeDailySave(save, dateUtc);
    if (normalized !== save) {
      await this.saveManager.save(normalized);
      this.registry.set("saveData", this.saveManager.get());
    }
    this.saveData = this.saveManager.get();

    const sel = pickDailyVariant(this.staticData.daily, dateUtc);
    const variant = this.staticData.daily.dailyVariants.find((v) => v.id === sel.variantId);
    const copy = getDailyVariantCopy(this.locale, sel.variantId, variant?.ui?.title ?? sel.variantId, variant?.ui?.desc ?? "");

    const info = getDailyAttemptsInfo(this.staticData.daily, this.saveData, dateUtc);
    const best =
      this.saveData.daily.lastDateUtc === dateUtc
        ? t(this.locale, "menu.bestToday", {
            wave: formatNumber(this.locale, this.saveData.daily.bestWave),
            bolts: formatNumber(this.locale, this.saveData.daily.bestBolts),
          })
        : t(this.locale, "menu.bestNone");
    const nextStartLine =
      info.canStartFree
        ? t(this.locale, "menu.nextDailyFree")
        : info.canStartRewarded
          ? t(this.locale, "menu.nextDailyRewarded")
          : t(this.locale, "menu.nextDailyUnavailable");
    const boostedLine = !this.staticData.balances.ads?.rewarded?.startBooster?.enabled
      ? t(this.locale, "menu.boostDailyDisabled")
      : info.canStartFree
        ? t(this.locale, "menu.boostDailyFree")
        : info.canStartRewarded
          ? t(this.locale, "menu.boostDailyRewarded")
          : t(this.locale, "menu.boostDailyUnavailable");
    dailyInfoText.setText(
      [
        `${t(this.locale, "menu.seedLine", { seed: dateUtc })} | ${copy.title}`,
        copy.desc,
        t(this.locale, "menu.attemptsLine", {
          used: formatNumber(this.locale, info.attemptsUsed),
          max: formatNumber(this.locale, info.maxAttempts),
          best,
        }),
        nextStartLine,
        boostedLine,
      ]
        .filter(Boolean)
        .join("\n")
    );
    return info;
  }

  private async startRunBoosted(): Promise<void> {
    const cfg = this.staticData.balances.ads?.rewarded?.startBooster;
    if (!cfg?.enabled) return;

    const res = await this.ads.showRewarded(AD_PLACEMENTS.START_BOOSTER);
    if (res.ok && res.rewarded) {
      this.registry.set("pendingStartBooster", true);
      this.stopMenuMusic();
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
      return;
    }

    this.toast(t(this.locale, "menu.rewardedBoosterDenied"));
  }

  private async startDaily(boosted: boolean): Promise<void> {
    const dateUtc = this.getCurrentDateUtc();
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

    if (boosterGranted) this.registry.set("pendingStartBooster", true);
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

function formatCareerMilestoneTitles(locale: Locale, ids: readonly LeaderboardCareerMilestoneId[]): string {
  return ids.map((id) => t(locale, `leaderboard.milestone.${id}`)).join(" | ");
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

function buildInstalledMetaSummary(
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
