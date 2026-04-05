import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart, type DailyAttemptsInfo } from "../daily/dailyAttempts";
import { getMetaNodeCost, getMetaNodeLevel, getMetaWalletAmount, purchaseMetaNode } from "../meta/metaProgression";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import { bindPageLifecycle } from "../../platform/pageLifecycle";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import { getPlatformNowMs, signalPlatformGameReady, addPlatformLifecycleListener } from "../../platform/platformRuntime";
import type { SaveData } from "../../platform/save/saveManager";
import type { SaveManager } from "../../platform/save/saveManager";
import { createEntityTextures } from "../../visual/EntityTextureFactory";
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
  private workshopCards: Phaser.GameObjects.Container[] = [];
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
        t(this.locale, "menu.best", {
          bestWave: formatNumber(this.locale, stats.bestWave),
          bestBolts: formatNumber(this.locale, stats.bestBolts),
        }),
        {
        fontSize: "16px",
        color: "#98b7c7",
        align: "center",
        }
      )
      .setOrigin(0.5);

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
    applyQualityLabel(qualityPref);
    applyVolumeLabel(btnSfx, labelSfx, "settings.sfx", sfxVolume);
    applyVolumeLabel(btnMusic, labelMusic, "settings.music", musicVolume);
    applyLanguageLabel(this.languageSetting);

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
      .text(-270, -270, t(this.locale, "menu.workshopHint"), {
        fontSize: "13px",
        color: "#98b7c7",
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

  private layoutWorkshop(): void {
    if (!this.workshopDim || !this.workshopBox) return;
    const { width, height } = this.scale;
    this.workshopDim.setSize(width, height);
    this.workshopBox.setPosition(width / 2, height / 2);
  }

  private showWorkshop(): void {
    this.refreshWorkshopSummary();
    this.workshopDim.setVisible(true);
    this.workshopBox.setVisible(true);
    this.layoutWorkshop();
  }

  private hideWorkshop(): void {
    this.workshopDim.setVisible(false);
    this.workshopBox.setVisible(false);
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
    this.workshopHintText.setText(buildInstalledMetaSummary(this.locale, this.staticData.metaTree.nodes, save.meta.nodeLevels));

    for (const card of this.workshopCards) card.destroy();
    this.workshopCards = [];

    this.staticData.metaTree.nodes.forEach((node, idx) => {
      const level = getMetaNodeLevel(save, node.id);
      const cost = getMetaNodeCost(this.staticData.metaTree, node.id, level);
      const currencyAmount = cost ? getMetaWalletAmount(save, cost.currency) : 0;
      const costAmount = cost?.amount ?? Number.POSITIVE_INFINITY;
      const affordable = Boolean(cost) && currencyAmount >= costAmount;
      const maxed = level >= node.maxLevel || !cost;
      const y = -170 + idx * 102;
      const accentColor = maxed ? 0x57c27d : cost?.currency === "cores" ? 0xffd166 : idx % 2 === 0 ? 0x5cc8ff : 0x3aa4d4;

      const bg = this.add.rectangle(0, 0, 548, 90, 0x121a24, 0.97).setStrokeStyle(2, accentColor, maxed ? 0.72 : 0.58);
      const accent = this.add.rectangle(-268, 0, 8, 90, accentColor, 0.92);
      const title = this.add
        .text(-256, -28, getMetaNodeName(this.locale, node.id, node.name), {
          fontSize: "17px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: 330 },
        })
        .setOrigin(0, 0);
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

      const card = this.add.container(0, y, [bg, accent, title, desc, levelText, progressBg, progressFill, btn, btnLabel, costLabel]).setDepth(1402);
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

function buildInstalledMetaSummary(
  locale: Locale,
  nodes: Array<{ id: string; name: string }>,
  levels: Record<string, number>
): string {
  const active = nodes
    .map((node) => ({ node, level: Math.max(0, Math.floor(levels[node.id] ?? 0)) }))
    .filter((entry) => entry.level > 0)
    .map((entry) => `${getMetaNodeName(locale, entry.node.id, entry.node.name)} ${locale === "ru" ? "ур." : "Lv."}${entry.level}`);

  return active.length > 0
    ? t(locale, "menu.installedList", { items: active.join(" | ") })
    : t(locale, "menu.installedNone");
}
