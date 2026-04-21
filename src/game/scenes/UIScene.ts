import Phaser from "phaser";
import { inputState } from "../input/inputState";
import { GAME_EVENTS } from "../events";
import type { RunState } from "../run/runState";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { SaveData, SaveManager } from "../../platform/save/saveManager";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import { bindPageLifecycle } from "../../platform/pageLifecycle";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import { addPlatformLifecycleListener, signalPlatformGameplayStop } from "../../platform/platformRuntime";
import type { StaticGameData } from "../../data/staticGameData";
import { getCurrentEndlessLevelFinale, getWaveInEndlessLevel } from "../run/endlessLevels";
import { markActivationFlag } from "../liveops/liveops";
import { VISUAL_PALETTE, createLightGradient, createVfxTextures, createVignette } from "../../visual/TextureFactory";
import { languageStroke, nextVolumeStep, qualityStroke, snapVolumeStep } from "./uiSettingsHelpers";
import { getDashHudBadgeSpecs } from "../upgrades/upgradeBadges";
import {
  type LanguageSetting,
  type Locale,
  formatNumber,
  formatQualityLabel,
  formatShortSeconds,
  formatVolume,
  getDailyVariantCopy,
  getLanguageSettingLabel,
  getLevelFinaleCopy,
  getLevelModifierCopy,
  getLevelObjectiveCopy,
  normalizeLanguageSetting,
  resolveLocale,
  t,
} from "../../i18n/localization";

type TutorialStep = 1 | 2 | 3;

export class UIScene extends Phaser.Scene {
  private staticData: StaticGameData | null = null;
  private runState: RunState | null = null;
  private saveManager: SaveManager | null = null;
  private saveData: SaveData | null = null;
  private ads: AdsManager | null = null;
  private analytics: AnalyticsAdapter | null = null;
  private platformAdapter: PlatformAdapter | null = null;
  private locale: Locale = "en";
  private languageSetting: LanguageSetting = "auto";
  private qualityPref: SaveData["settings"]["visualQuality"] = "auto";

  private overlayVignette!: Phaser.GameObjects.Image;
  private overlayLight!: Phaser.GameObjects.Image;

  private hudPanel!: Phaser.GameObjects.Rectangle;
  private hudText!: Phaser.GameObjects.Text;
  private boltsText!: Phaser.GameObjects.Text;
  private dailyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private levelProgressFrame!: Phaser.GameObjects.Rectangle;
  private levelProgressFill!: Phaser.GameObjects.Rectangle;
  private levelProgressMarkers: Phaser.GameObjects.Rectangle[] = [];
  private levelBanner!: Phaser.GameObjects.Container;
  private levelBannerTitle!: Phaser.GameObjects.Text;
  private levelBannerDesc!: Phaser.GameObjects.Text;
  private levelBannerTimer = 0;
  private levelBannerDuration = 3.2;
  private levelBannerBaseY = 96;
  private lastLevelBannerKey = "";
  private activeBannerLevel = 0;
  private activeBannerModifierId = "";

  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointerId: number | null = null;
  private joyRadius = 56;

  private btnFlip!: Phaser.GameObjects.Arc;
  private btnDash!: Phaser.GameObjects.Arc;
  private flipLabel!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;
  private dashBadgePrimary!: Phaser.GameObjects.Text;
  private dashBadgeSecondary!: Phaser.GameObjects.Text;
  private flipGlow!: Phaser.GameObjects.Image;
  private dashGlow!: Phaser.GameObjects.Image;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private pauseLabel!: Phaser.GameObjects.Text;
  private flipPulseT = 0;

  private tutorialActive = false;
  private tutorialStep: TutorialStep = 1;
  private tutorialScrap = 0;
  private tutorialBg!: Phaser.GameObjects.Rectangle;
  private tutorialBox!: Phaser.GameObjects.Container;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialActionButton!: Phaser.GameObjects.Rectangle;
  private tutorialActionLabel!: Phaser.GameObjects.Text;

  private modalActive = false;
  private reviveBusy = false;
  private reviveBox!: Phaser.GameObjects.Container;
  private reviveDim!: Phaser.GameObjects.Rectangle;
  private revivePanel!: Phaser.GameObjects.Rectangle;
  private reviveTitle!: Phaser.GameObjects.Text;
  private reviveHint!: Phaser.GameObjects.Text;
  private reviveAcceptButton!: Phaser.GameObjects.Rectangle;
  private reviveAcceptLabel!: Phaser.GameObjects.Text;
  private reviveDeclineButton!: Phaser.GameObjects.Rectangle;
  private reviveDeclineLabel!: Phaser.GameObjects.Text;
  private settingsVisible = false;
  private settingsDim!: Phaser.GameObjects.Rectangle;
  private settingsBox!: Phaser.GameObjects.Container;
  private settingsPanel!: Phaser.GameObjects.Rectangle;
  private settingsAccent!: Phaser.GameObjects.Rectangle;
  private settingsTitle!: Phaser.GameObjects.Text;
  private settingsHint!: Phaser.GameObjects.Text;
  private settingsQualityButton!: Phaser.GameObjects.Rectangle;
  private settingsQualityLabel!: Phaser.GameObjects.Text;
  private settingsSfxButton!: Phaser.GameObjects.Rectangle;
  private settingsSfxLabel!: Phaser.GameObjects.Text;
  private settingsMusicButton!: Phaser.GameObjects.Rectangle;
  private settingsMusicLabel!: Phaser.GameObjects.Text;
  private settingsLanguageButton!: Phaser.GameObjects.Rectangle;
  private settingsLanguageLabel!: Phaser.GameObjects.Text;
  private settingsResumeButton!: Phaser.GameObjects.Rectangle;
  private settingsResumeLabel!: Phaser.GameObjects.Text;
  private settingsMenuButton!: Phaser.GameObjects.Rectangle;
  private settingsMenuLabel!: Phaser.GameObjects.Text;

  private audioEnabled = false;
  private music: Phaser.Sound.BaseSound | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;
  private lastDashArcSfxAt = -1e9;
  private lastDashSiphonSfxAt = -1e9;
  private suspendReasons = new Set<string>();
  private externalPauseOwnsGamePause = false;

  private readonly onSfxPickup = (p?: any) => {
    if (p?.source === "dash_siphon") return;
    this.playSfx("sfx_pickup");
  };
  private readonly onSfxFlip = () => this.playSfx("sfx_flip");
  private readonly onSfxBank = () => this.playSfx("sfx_bank");
  private readonly onSfxHit = () => this.playSfx("sfx_hit");
  private readonly onSfxUpgrade = () => this.playSfx("sfx_upgrade");
  private readonly onSfxDashArc = () => {
    if (this.time.now - this.lastDashArcSfxAt < 70) return;
    this.lastDashArcSfxAt = this.time.now;
    this.playSfx("sfx_dash_arc");
  };
  private readonly onSfxDashSiphon = () => {
    if (this.time.now - this.lastDashSiphonSfxAt < 45) return;
    this.lastDashSiphonSfxAt = this.time.now;
    this.playSfx("sfx_dash_siphon");
  };

  private readonly onAnalyticsScrap = (p: any) => void this.trackActivationOnce("firstScrapTracked", ANALYTICS_EVENTS.FIRST_SCRAP, p ?? {});
  private readonly onAnalyticsFlip = () => this.track(ANALYTICS_EVENTS.FLIP_USED, {});
  private readonly onAnalyticsBank = (p: any) => {
    this.track(ANALYTICS_EVENTS.RECYCLER_BANK_COMPLETE, { bolts: p?.bolts });
    void this.trackActivationOnce("firstBankTracked", ANALYTICS_EVENTS.FIRST_BANK, { bolts: p?.bolts ?? 0 });
  };
  private readonly onAnalyticsUpgradePick = (p: any) => {
    this.track(ANALYTICS_EVENTS.UPGRADE_PICK, p ?? {});
    void this.trackActivationOnce("firstUpgradeTracked", ANALYTICS_EVENTS.FIRST_UPGRADE, p ?? {});
  };
  private readonly onAnalyticsReviveOffer = () => this.track(ANALYTICS_EVENTS.REVIVE_OFFER, {});
  private readonly onAnalyticsReviveAccept = () => this.track(ANALYTICS_EVENTS.REVIVE_ACCEPT, {});
  private readonly onAnalyticsReviveDecline = () => this.track(ANALYTICS_EVENTS.REVIVE_DECLINE, {});

  constructor() {
    super("ui");
  }

  create(): void {
    this.staticData = (this.registry.get("staticGameData") as StaticGameData | undefined) ?? null;
    this.runState = (this.registry.get("runState") as RunState | undefined) ?? null;
    this.saveManager = (this.registry.get("saveManager") as SaveManager | undefined) ?? null;
    this.saveData = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    this.ads = (this.registry.get("adsManager") as AdsManager | undefined) ?? null;
    this.analytics = (this.registry.get("analytics") as AnalyticsAdapter | undefined) ?? null;
    this.platformAdapter = (this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null;
    this.languageSetting = normalizeLanguageSetting(this.saveData?.settings?.language ?? "auto");
    this.locale = ((this.registry.get("locale") as Locale | undefined) ?? this.resolveLocaleSetting(this.languageSetting));
    this.qualityPref = this.saveData?.settings?.visualQuality ?? "auto";

    this.sfxVolume = snapVolumeStep(this.saveData?.settings?.sfxVolume ?? 0.8);
    this.musicVolume = snapVolumeStep(this.saveData?.settings?.musicVolume ?? 0.6);
    this.registry.set("languageSetting", this.languageSetting);
    this.registry.set("locale", this.locale);

    this.input.once("pointerdown", () => this.enableAudio());
    this.input.keyboard?.once("keydown", () => this.enableAudio());

    createVignette(this);
    createLightGradient(this);
    createVfxTextures(this);
    this.overlayLight = this.add
      .image(0, 0, "lightGradient")
      .setScrollFactor(0)
      .setDepth(20)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.14);
    this.overlayVignette = this.add.image(0, 0, "vignette").setScrollFactor(0).setDepth(21).setAlpha(0.55);

    this.hudPanel = this.add
      .rectangle(16, 12, 340, 122, 0x08111a, 0.72)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x2a556d, 0.58)
      .setDepth(999)
      .setScrollFactor(0);
    const hudStyle = { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" };
    this.hudText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.boltsText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.dailyText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.waveText = this.add.text(16, 36, "", { fontSize: "15px", color: "#98b7c7", fontStyle: "700" }).setDepth(1000).setScrollFactor(0);
    this.statusText = this.add
      .text(16, 56, "", { fontSize: "14px", color: "#7fdfff", fontStyle: "700", wordWrap: { width: 520 } })
      .setDepth(1000)
      .setScrollFactor(0);
    this.createLevelProgressUi();
    this.createLevelBannerUi();

    this.createControls();
    this.createTutorial();
    this.createReviveOverlay();
    this.createSettingsOverlay();
    this.refreshLocalizedUi();
    this.bindTutorialEvents();
    this.bindAudioEvents();
    this.bindReviveEvents();
    this.bindAnalyticsEvents();
    this.input.keyboard?.on("keydown-ESC", this.onEscapePressed, this);
    if (!(this.sound as any)?.locked) this.enableAudio();
    const releasePageLifecycle = bindPageLifecycle({
      hide: () => this.setExternalPause("page", true),
      show: () => this.setExternalPause("page", false),
    });
    const releasePlatformLifecycle = addPlatformLifecycleListener(this.platformAdapter, {
      pause: () => this.setExternalPause("platform", true),
      resume: () => this.setExternalPause("platform", false),
    });
    const onAdBreakStart = () => this.setExternalPause("ad", true);
    const onAdBreakEnd = () => this.setExternalPause("ad", false);
    const onResize = () => this.layout();
    this.game.events.on(GAME_EVENTS.AD_BREAK_START, onAdBreakStart, this);
    this.game.events.on(GAME_EVENTS.AD_BREAK_END, onAdBreakEnd, this);
    this.scale.on("resize", onResize);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onTutorialScrap, this);
      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onTutorialFlip, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onTutorialBank, this);

      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onSfxPickup, this);
      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onSfxFlip, this);
      this.game.events.off(GAME_EVENTS.DASH_ARC, this.onSfxDashArc, this);
      this.game.events.off(GAME_EVENTS.DASH_SIPHON, this.onSfxDashSiphon, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onSfxBank, this);
      this.game.events.off(GAME_EVENTS.PLAYER_HIT, this.onSfxHit, this);
      this.game.events.off(GAME_EVENTS.UPGRADE_PICKED, this.onSfxUpgrade, this);

      this.game.events.off(GAME_EVENTS.REVIVE_OFFER, this.onReviveOffer, this);

      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onAnalyticsFlip, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onAnalyticsBank, this);
      this.game.events.off(GAME_EVENTS.UPGRADE_PICKED, this.onAnalyticsUpgradePick, this);
      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onAnalyticsScrap, this);
      this.game.events.off(GAME_EVENTS.REVIVE_OFFER, this.onAnalyticsReviveOffer, this);
      this.game.events.off(GAME_EVENTS.REVIVE_ACCEPTED, this.onAnalyticsReviveAccept, this);
      this.game.events.off(GAME_EVENTS.REVIVE_DECLINED, this.onAnalyticsReviveDecline, this);
      this.game.events.off(GAME_EVENTS.AD_BREAK_START, onAdBreakStart, this);
      this.game.events.off(GAME_EVENTS.AD_BREAK_END, onAdBreakEnd, this);
      this.input.keyboard?.off("keydown-ESC", this.onEscapePressed, this);
      this.scale.off("resize", onResize);
      releasePageLifecycle();
      releasePlatformLifecycle();
      this.suspendReasons.clear();
    });

    this.layout();
  }

  update(_time: number, dtMs: number): void {
    const dt = dtMs / 1000;
    const s = (this.registry.get("runState") as RunState | undefined) ?? null;
    this.runState = s;

    if (!this.runState) return;
    const hpMax = this.runState.config.player.hpMax;
    const hp = Math.max(0, this.runState.hp);
    const wave = this.runState.waveIndex;
    const level = this.runState.endless.current.index;
    const waveInLevel = getWaveInEndlessLevel(wave, this.runState.endless.wavesPerLevel);
    const bolts = this.runState.bolts;
    const daily =
      this.runState.mode === "daily"
        ? `| ${t(this.locale, "hud.daily")}: ${this.getDailyLabel()}`
        : this.runState.mode === "tutorial"
          ? `| ${t(this.locale, "hud.training")}`
          : "";

    this.hudText.setText(
      `${t(this.locale, "hud.hp")} ${formatNumber(this.locale, hp)}/${formatNumber(this.locale, hpMax)} | ${t(this.locale, "hud.level")} ${formatNumber(this.locale, level)} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, wave)} (${formatNumber(this.locale, waveInLevel)}/${formatNumber(this.locale, this.runState.endless.wavesPerLevel)})`
    );
    this.boltsText.setText(`${t(this.locale, "hud.bolts")} ${formatNumber(this.locale, bolts)}`);
    this.dailyText.setText(daily);
    this.dailyText.setVisible(Boolean(daily));
    const waveLabel = ((this.registry.get("uiStatusPrimary") as string | undefined) ?? "").trim();
    const statusLabel = ((this.registry.get("uiStatusSecondary") as string | undefined) ?? "").trim();
    const overlayActive = this.isBlockingOverlayActive();
    const compactOverlayLayout = this.isCompactOverlayLayout();
    const focusBannerVisible = this.levelBanner.visible && this.levelBannerTimer > 0;
    this.waveText.setText(waveLabel);
    this.waveText.setVisible(Boolean(waveLabel) && !overlayActive && !(compactOverlayLayout && focusBannerVisible));
    this.statusText.setText(statusLabel);
    this.statusText.setVisible(Boolean(statusLabel) && !overlayActive);
    this.layoutHud();
    this.updateLevelProgressUi(waveInLevel, this.runState.endless.wavesPerLevel);
    this.maybeShowLevelBanner();
    this.updateLevelBanner(dt);

    const dashEnabled = Boolean(this.runState.config.dash.enabledByDefault) || Boolean((this.runState.perks as any).dash_module);
    this.btnDash.setVisible(dashEnabled);
    this.dashLabel.setVisible(dashEnabled);
    this.dashGlow.setVisible(dashEnabled);
    this.refreshDashHudBadges(dashEnabled);
    this.syncGameplayOverlayVisibility(dashEnabled);

    let flipCd = (this.registry.get("flipCooldown") as number | undefined) ?? 0;
    let dashCd = (this.registry.get("dashCooldown") as number | undefined) ?? 0;
    if (!Number.isFinite(flipCd)) flipCd = 0;
    if (!Number.isFinite(dashCd)) dashCd = 0;

    const flipReady = flipCd <= 0.001;
    this.flipPulseT = flipReady ? this.flipPulseT + Math.max(0, dt) : 0;

    if (flipReady) {
      const pulse = 1 + Math.sin(this.flipPulseT * Math.PI * 2 * 1.25) * 0.045;
      this.btnFlip.setScale(pulse);
      this.flipGlow.setAlpha(0.22 + Math.sin(this.flipPulseT * Math.PI * 2 * 1.25) * 0.06);
      this.btnFlip.setStrokeStyle(2, VISUAL_PALETTE.neonCyan, 0.95);
      this.flipLabel.setText(t(this.locale, "hud.flip"));
    } else {
      this.btnFlip.setScale(1);
      this.flipGlow.setAlpha(0.08);
      this.btnFlip.setStrokeStyle(2, VISUAL_PALETTE.metalGray, 0.75);
      this.flipLabel.setText(`${t(this.locale, "hud.flip")} ${formatCooldown(this.locale, flipCd)}`);
    }

    if (dashEnabled) {
      const dashReady = dashCd <= 0.001;
      this.btnDash.setStrokeStyle(2, dashReady ? VISUAL_PALETTE.successGreen : VISUAL_PALETTE.metalGray, dashReady ? 0.95 : 0.7);
      this.dashGlow.setAlpha(dashReady ? 0.16 : 0.06);
      this.dashLabel.setText(dashReady ? t(this.locale, "hud.dash") : `${t(this.locale, "hud.dash")} ${formatCooldown(this.locale, dashCd)}`);
    }
  }

  private createControls(): void {
    const base = this.add
      .circle(0, 0, this.joyRadius, 0x1b2635, 0.55)
      .setStrokeStyle(2, 0x3aa4d4, 0.9)
      .setDepth(1000)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    const knob = this.add
      .circle(0, 0, 22, 0x5cc8ff, 0.75)
      .setDepth(1001)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    this.joyBase = base;
    this.joyKnob = knob;

    base.setInteractive(new Phaser.Geom.Circle(0, 0, this.joyRadius), Phaser.Geom.Circle.Contains);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.onPointerUp(p));

    this.btnFlip = this.add
      .circle(0, 0, 44, 0x1b2635, 0.9)
      .setStrokeStyle(2, VISUAL_PALETTE.neonCyan, 0.95)
      .setDepth(1000)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    this.flipGlow = this.add
      .image(0, 0, "vfx_glow_blob")
      .setDepth(999)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(VISUAL_PALETTE.neonCyan)
      .setAlpha(0.14)
      .setScale(0.8);
    this.btnFlip.setInteractive(new Phaser.Geom.Circle(0, 0, 44), Phaser.Geom.Circle.Contains);
    this.btnFlip.on("pointerdown", () => {
      if (this.modalActive) return;
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      inputState.flipPressed = true;
    });
    this.flipLabel = this.add
      .text(0, 0, t(this.locale, "hud.flip"), { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);

    this.btnDash = this.add
      .circle(0, 0, 34, 0x121a24, 0.85)
      .setStrokeStyle(2, VISUAL_PALETTE.metalGray, 0.85)
      .setDepth(1000)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    this.dashGlow = this.add
      .image(0, 0, "vfx_glow_blob")
      .setDepth(999)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(VISUAL_PALETTE.successGreen)
      .setAlpha(0.09)
      .setScale(0.62);
    this.btnDash.setInteractive(new Phaser.Geom.Circle(0, 0, 34), Phaser.Geom.Circle.Contains);
    this.btnDash.on("pointerdown", () => {
      if (this.modalActive) return;
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      inputState.dashPressed = true;
    });
    this.dashLabel = this.add
      .text(0, 0, t(this.locale, "hud.dash"), { fontSize: "14px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);
    this.dashBadgePrimary = this.add
      .text(0, 0, "", { fontSize: "13px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1002)
      .setScrollFactor(0)
      .setPadding(6, 2, 6, 2)
      .setVisible(false);
    this.dashBadgeSecondary = this.add
      .text(0, 0, "", { fontSize: "13px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1002)
      .setScrollFactor(0)
      .setPadding(6, 2, 6, 2)
      .setVisible(false);

    this.pauseButton = this.add
      .rectangle(0, 0, 116, 34, 0x121a24, 0.92)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setDepth(1000)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.pauseButton.on("pointerdown", () => {
      if (this.reviveBox.visible) return;
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      if (this.settingsVisible) this.closeSettings();
      else this.openSettings();
    });
    this.pauseLabel = this.add
      .text(0, 0, t(this.locale, "pause.open"), { fontSize: "15px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);
  }

  private createLevelProgressUi(): void {
    this.levelProgressFrame = this.add
      .rectangle(16, 76, 240, 14, 0x081019, 0.76)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x2a556d, 0.9)
      .setDepth(1000)
      .setScrollFactor(0);
    this.levelProgressFill = this.add
      .rectangle(20, 83, 0, 6, VISUAL_PALETTE.neonCyan, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(1001)
      .setScrollFactor(0);

    this.levelProgressMarkers = [];
    const wavesPerLevel = Math.max(1, this.runState?.endless.wavesPerLevel ?? 4);
    for (let i = 1; i < wavesPerLevel; i++) {
      const marker = this.add
        .rectangle(0, 0, 2, 10, 0xd9f2ff, 0.24)
        .setDepth(1002)
        .setScrollFactor(0);
      this.levelProgressMarkers.push(marker);
    }
  }

  private createLevelBannerUi(): void {
    const bg = this.add.rectangle(0, 0, 560, 118, 0x0f1720, 0.94).setStrokeStyle(2, VISUAL_PALETTE.warningAmber, 0.82);
    const accent = this.add.rectangle(0, -36, 500, 2, VISUAL_PALETTE.neonCyan, 0.85);
    this.levelBannerTitle = this.add
      .text(0, -22, "", { fontSize: "20px", color: "#d9f2ff", fontStyle: "700", align: "center" })
      .setOrigin(0.5);
    this.levelBannerDesc = this.add
      .text(0, 16, "", {
        fontSize: "13px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5);

    this.levelBanner = this.add.container(0, 0, [bg, accent, this.levelBannerTitle, this.levelBannerDesc]).setDepth(1250).setScrollFactor(0);
    this.levelBanner.setVisible(false).setAlpha(0);
  }

  private updateLevelProgressUi(waveInLevel: number, wavesPerLevel: number): void {
    const visible = !this.isTrainingMode();
    this.levelProgressFrame.setVisible(visible);
    this.levelProgressFill.setVisible(visible);
    for (const marker of this.levelProgressMarkers) marker.setVisible(visible);
    if (!visible) return;

    const safeTotal = Math.max(1, wavesPerLevel);
    const safeWave = clamp(waveInLevel, 1, safeTotal);
    const progress = safeWave / safeTotal;
    const fillWidth = Math.max(0, (this.levelProgressFrame.width - 8) * progress);
    const isFinal = safeWave >= safeTotal;
    const fillColor = isFinal ? VISUAL_PALETTE.warningAmber : VISUAL_PALETTE.neonCyan;

    this.levelProgressFill.setSize(fillWidth, 6);
    this.levelProgressFill.setFillStyle(fillColor, isFinal ? 0.98 : 0.92);
    this.levelProgressFrame.setStrokeStyle(2, isFinal ? VISUAL_PALETTE.warningAmber : 0x2a556d, isFinal ? 0.95 : 0.9);

    for (let i = 0; i < this.levelProgressMarkers.length; i++) {
      const marker = this.levelProgressMarkers[i]!;
      marker.setFillStyle(0xd9f2ff, i < safeWave - 1 ? 0.72 : 0.22);
    }
  }

  private maybeShowLevelBanner(): void {
    if (!this.runState || this.isTrainingMode() || this.isBlockingOverlayActive()) {
      this.levelBanner.setVisible(false).setAlpha(0);
      this.levelBannerTimer = 0;
      return;
    }

    const signature = `${this.runState.mode}:${this.runState.endless.current.index}:${this.runState.endless.current.modifierId}`;
    if (signature === this.lastLevelBannerKey) return;
    this.lastLevelBannerKey = signature;
    this.showLevelBanner(this.runState.endless.current.index, this.runState.endless.current.modifierId);
  }

  private showLevelBanner(level: number, modifierId: string): void {
    this.activeBannerLevel = level;
    this.activeBannerModifierId = modifierId;
    this.refreshLevelBannerCopy();
    this.levelBannerDuration = this.isCompactOverlayLayout() ? 2.5 : 3.2;
    this.levelBannerTimer = this.levelBannerDuration;
    this.levelBanner.setVisible(true).setAlpha(0);
  }

  private updateLevelBanner(dt: number): void {
    if (this.isBlockingOverlayActive()) {
      this.levelBanner.setVisible(false).setAlpha(0);
      return;
    }
    if (this.levelBannerTimer <= 0) {
      this.levelBanner.setVisible(false).setAlpha(0);
      return;
    }

    this.levelBannerTimer = Math.max(0, this.levelBannerTimer - Math.max(0, dt));
    const elapsed = this.levelBannerDuration - this.levelBannerTimer;
    const fadeIn = clamp(elapsed / 0.22, 0, 1);
    const fadeOut = clamp(this.levelBannerTimer / 0.4, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    this.levelBanner.setVisible(true).setAlpha(alpha);
    this.levelBanner.setY(this.levelBannerBaseY - (1 - alpha) * 10);
  }

  private refreshLevelBannerCopy(): void {
    if (this.activeBannerLevel <= 0 || !this.activeBannerModifierId || !this.runState) return;
    const compactOverlayLayout = this.isCompactOverlayLayout();
    const copy = getLevelModifierCopy(this.locale, this.activeBannerModifierId);
    const objective = this.runState.endless.current.objective;
    const objectiveCopy = getLevelObjectiveCopy(this.locale, objective.id);
    const finale = getCurrentEndlessLevelFinale(this.runState.endless);
    const finaleCopy = finale ? getLevelFinaleCopy(this.locale, finale.id) : null;
    const finaleLine = finaleCopy
      ? `${t(this.locale, finale?.kind === "sectorEvent" ? "wave.event" : "wave.finale")}: ${finaleCopy.title}`
      : "";
    this.levelBannerTitle.setText(`${t(this.locale, "hud.level")} ${formatNumber(this.locale, this.activeBannerLevel)} | ${copy.title}`);
    this.levelBannerDesc.setText(
      compactOverlayLayout
        ? [copy.desc, finaleLine].filter(Boolean).join(" | ")
        : [
            copy.desc,
            t(this.locale, "objective.progress", {
              title: objectiveCopy.title,
              progress: formatNumber(this.locale, Math.floor(objective.progress)),
              target: formatNumber(this.locale, objective.target),
            }),
            finaleLine,
          ]
            .filter(Boolean)
            .join("\n")
    );
  }

  private isCompactOverlayLayout(): boolean {
    return this.scale.width <= 720 || this.scale.height <= 430;
  }

  private isBlockingOverlayActive(): boolean {
    return this.scene.isActive("upgrade") || this.settingsVisible || this.reviveBox.visible;
  }

  private syncGameplayOverlayVisibility(dashEnabled: boolean): void {
    const overlayActive = this.isBlockingOverlayActive();
    const controlsVisible = !overlayActive;
    const hudVisible = !overlayActive;
    const progressVisible = hudVisible && !this.isTrainingMode();
    const focusBannerVisible = this.levelBanner.visible && this.levelBannerTimer > 0;
    const dashBadges = [this.dashBadgePrimary, this.dashBadgeSecondary];

    this.hudPanel.setVisible(hudVisible);
    this.hudText.setVisible(hudVisible);
    this.boltsText.setVisible(hudVisible);
    this.dailyText.setVisible(hudVisible && this.dailyText.text.length > 0);
    this.waveText.setVisible(hudVisible && this.waveText.text.length > 0 && !(this.isCompactOverlayLayout() && focusBannerVisible));
    this.statusText.setVisible(hudVisible && this.statusText.text.length > 0);
    this.levelProgressFrame.setVisible(progressVisible);
    this.levelProgressFill.setVisible(progressVisible);
    for (const marker of this.levelProgressMarkers) marker.setVisible(progressVisible);
    this.tutorialBox.setVisible(this.tutorialActive && !overlayActive);

    this.joyBase.setVisible(controlsVisible);
    this.joyKnob.setVisible(controlsVisible);
    this.btnFlip.setVisible(controlsVisible);
    this.flipLabel.setVisible(controlsVisible);
    this.flipGlow.setVisible(controlsVisible);
    this.btnDash.setVisible(controlsVisible && dashEnabled);
    this.dashLabel.setVisible(controlsVisible && dashEnabled);
    this.dashGlow.setVisible(controlsVisible && dashEnabled);
    this.pauseButton.setVisible(!overlayActive);
    this.pauseLabel.setVisible(!overlayActive);
    for (const badge of dashBadges) {
      badge.setVisible(controlsVisible && dashEnabled && badge.text.length > 0);
    }
  }

  private layout(): void {
    if (
      !this.overlayLight?.scene ||
      !this.overlayVignette?.scene ||
      !this.joyBase?.scene ||
      !this.joyKnob?.scene ||
      !this.btnFlip?.scene ||
      !this.flipLabel?.scene ||
      !this.pauseButton?.scene ||
      !this.tutorialBox?.scene ||
      !this.reviveBox?.scene ||
      !this.settingsBox?.scene ||
      !this.hudPanel?.scene ||
      !this.levelProgressFrame?.scene
    ) {
      return;
    }

    const { width, height } = this.scale;
    const margin = 16;

    this.overlayLight.setPosition(width / 2, height / 2).setDisplaySize(width, height);
    this.overlayVignette.setPosition(width / 2, height / 2).setDisplaySize(width, height);

    const joyX = margin + this.joyRadius + 8;
    const joyY = height - margin - this.joyRadius - 8;
    this.joyBase.setPosition(joyX, joyY);
    this.joyKnob.setPosition(joyX, joyY);

    const flipX = width - margin - 56;
    const flipY = height - margin - 60;
    this.btnFlip.setPosition(flipX, flipY);
    this.flipLabel.setPosition(flipX, flipY);
    this.flipGlow.setPosition(flipX, flipY);

    const dashX = width - margin - 56;
    const dashY = flipY - 78;
    this.btnDash.setPosition(dashX, dashY);
    this.dashLabel.setPosition(dashX, dashY);
    this.dashGlow.setPosition(dashX, dashY);
    this.layoutDashHudBadges();

    this.pauseButton.setPosition(width - margin - 58, margin + 18);
    this.pauseLabel.setPosition(this.pauseButton.x, this.pauseButton.y);

    this.layoutHud();
    this.layoutTutorialOverlay();

    const compactOverlayLayout = this.isCompactOverlayLayout();
    const tutorialHeight = this.tutorialBg.height;
    const tutorialCenterY = compactOverlayLayout
      ? this.hudPanel.y + this.hudPanel.height + tutorialHeight / 2 + 14
      : margin + 62;

    this.tutorialBox.setPosition(width / 2, tutorialCenterY);
    this.levelBannerBaseY = compactOverlayLayout
      ? this.tutorialBox.visible
        ? tutorialCenterY + tutorialHeight / 2 + 18
        : Math.min(height - 74, this.hudPanel.y + this.hudPanel.height + 82)
      : this.tutorialBox.visible
        ? tutorialCenterY + tutorialHeight / 2 + 18
        : margin + 84;
    const levelBannerBg = this.levelBanner.list[0] as Phaser.GameObjects.Rectangle | undefined;
    const levelBannerAccent = this.levelBanner.list[1] as Phaser.GameObjects.Rectangle | undefined;
    const bannerWidth = compactOverlayLayout ? Math.max(280, Math.min(width - 72, 500)) : 560;
    const bannerHeight = compactOverlayLayout ? 82 : 118;
    levelBannerBg?.setSize(bannerWidth, bannerHeight);
    levelBannerAccent?.setPosition(0, -bannerHeight / 2 + (compactOverlayLayout ? 20 : 23)).setSize(bannerWidth - 60, 2);
    this.levelBannerTitle
      .setStyle({
        fontSize: compactOverlayLayout ? "17px" : "20px",
        align: "center",
        wordWrap: { width: bannerWidth - 52 },
      })
      .setPosition(0, compactOverlayLayout ? -12 : -22);
    this.levelBannerDesc
      .setStyle({
        fontSize: compactOverlayLayout ? "11px" : "13px",
        align: "center",
        wordWrap: { width: bannerWidth - 56 },
      })
      .setPosition(0, compactOverlayLayout ? 12 : 16);
    fitTextScaleToWidth(this.levelBannerTitle, bannerWidth - 52, 0.82);
    fitTextScaleToWidth(this.levelBannerDesc, bannerWidth - 56, 0.84);
    this.levelBanner.setPosition(width / 2, this.levelBannerBaseY);

    this.reviveBox.setPosition(width / 2, height / 2);
    this.reviveDim.setSize(width, height);
    this.layoutReviveOverlay();
    this.settingsBox.setPosition(width / 2, height / 2);
    this.settingsDim.setSize(width, height);
    this.layoutSettingsOverlay();
    const dashEnabled = Boolean(this.runState?.config.dash.enabledByDefault) || Boolean((this.runState?.perks as any)?.dash_module);
    this.syncGameplayOverlayVisibility(dashEnabled);
  }

  private layoutTutorialOverlay(): void {
    if (!this.tutorialBg?.scene || !this.tutorialText?.scene || !this.tutorialActionButton?.scene) return;

    const compactLayout = this.scale.width <= 720 || this.scale.height <= 430;
    const boxWidth = Math.max(320, Math.min(520, this.scale.width - (compactLayout ? 24 : 84)));
    const buttonWidth = compactLayout ? 96 : 80;
    const buttonHeight = compactLayout ? 36 : 34;
    const textWidth = Math.max(190, boxWidth - buttonWidth - 44);

    this.tutorialText.setStyle({
      fontSize: compactLayout ? "14px" : "15px",
      wordWrap: { width: textWidth },
    });
    this.tutorialActionLabel.setStyle({ fontSize: compactLayout ? "13px" : "14px" });

    const boxHeight = Math.max(compactLayout ? 78 : 64, this.tutorialText.height + 24);
    this.tutorialBg.setSize(boxWidth, boxHeight);
    this.tutorialText.setPosition(-boxWidth / 2 + 14, -boxHeight / 2 + 10);
    this.tutorialActionButton.setSize(buttonWidth, buttonHeight).setPosition(boxWidth / 2 - buttonWidth / 2 - 12, 0);
    this.tutorialActionLabel.setPosition(this.tutorialActionButton.x, this.tutorialActionButton.y);
    fitTextScaleToWidth(this.tutorialActionLabel, buttonWidth - 16, 0.9);
  }

  private layoutReviveOverlay(): void {
    if (
      !this.revivePanel?.scene ||
      !this.reviveTitle?.scene ||
      !this.reviveHint?.scene ||
      !this.reviveAcceptButton?.scene ||
      !this.reviveAcceptLabel?.scene ||
      !this.reviveDeclineButton?.scene ||
      !this.reviveDeclineLabel?.scene
    ) {
      return;
    }

    const { width, height } = this.scale;
    const compactLayout = width <= 760 || height <= 460;
    const shortLayout = width <= 540 || height <= 380;
    const panelWidth = Math.max(300, Math.min(420, width - (shortLayout ? 20 : 32)));
    const panelHeight = Math.max(212, Math.min(shortLayout ? 228 : compactLayout ? 244 : 260, height - (shortLayout ? 20 : 32)));
    const titleY = -panelHeight / 2 + (shortLayout ? 34 : compactLayout ? 38 : 42);
    const hintY = titleY + (shortLayout ? 34 : 40);
    const primaryY = hintY + (shortLayout ? 56 : compactLayout ? 62 : 70);
    const secondaryY = primaryY + (shortLayout ? 52 : 60);
    const buttonWidth = Math.max(220, Math.min(panelWidth - 40, shortLayout ? 252 : 280));

    this.revivePanel.setSize(panelWidth, panelHeight);
    this.reviveTitle
      .setStyle({ fontSize: shortLayout ? "24px" : compactLayout ? "26px" : "28px" })
      .setPosition(0, titleY)
      .setWordWrapWidth(panelWidth - 36, true);
    this.reviveHint
      .setStyle({
        fontSize: shortLayout ? "14px" : compactLayout ? "15px" : "16px",
        align: "center",
        wordWrap: { width: panelWidth - 44 },
      })
      .setPosition(0, hintY);
    this.reviveAcceptButton.setSize(buttonWidth, shortLayout ? 46 : compactLayout ? 50 : 54).setPosition(0, primaryY);
    this.reviveAcceptLabel
      .setStyle({ fontSize: shortLayout ? "16px" : compactLayout ? "17px" : "18px" })
      .setPosition(this.reviveAcceptButton.x, this.reviveAcceptButton.y)
      .setWordWrapWidth(buttonWidth - 24, true);
    fitTextScaleToWidth(this.reviveAcceptLabel, buttonWidth - 24, 0.88);
    this.reviveDeclineButton.setSize(buttonWidth, shortLayout ? 40 : compactLayout ? 42 : 46).setPosition(0, secondaryY);
    this.reviveDeclineLabel
      .setStyle({ fontSize: shortLayout ? "15px" : compactLayout ? "15px" : "16px" })
      .setPosition(this.reviveDeclineButton.x, this.reviveDeclineButton.y)
      .setWordWrapWidth(buttonWidth - 24, true);
    fitTextScaleToWidth(this.reviveDeclineLabel, buttonWidth - 24, 0.88);
  }

  private layoutSettingsOverlay(): void {
    if (!this.settingsPanel?.scene || !this.settingsAccent?.scene || !this.settingsTitle?.scene || !this.settingsHint?.scene) return;

    const { width, height } = this.scale;
    const compactLayout = width <= 720 || height <= 520;
    const shortLayout = width <= 680 || height <= 400;
    const desktopScale = compactLayout ? 1 : getResponsiveOverlayScale(width, height, 1280, 800, 0.45, 1.45);
    const showHint = !compactLayout;
    const panelWidth = Math.max(320, Math.min(Math.round(468 * desktopScale), width - (shortLayout ? 20 : 32)));
    const panelHeight = Math.max(324, Math.min(Math.round((shortLayout ? 372 : 420) * desktopScale), height - (shortLayout ? 16 : 24)));
    const titleY = -panelHeight / 2 + (shortLayout ? 28 : compactLayout ? 34 : 42);
    const accentY = titleY + (shortLayout ? 24 : 28);
    const hintY = accentY + (shortLayout ? 16 : 20);
    const fieldWidth = Math.max(240, panelWidth - Math.round((shortLayout ? 46 : 108) * desktopScale));
    const fieldHeight = Math.round((shortLayout ? 40 : 46) * desktopScale);
    const rowGap = Math.round((shortLayout ? 12 : 14) * desktopScale);

    this.settingsPanel.setSize(panelWidth, panelHeight);
    this.settingsAccent.setSize(Math.min(panelWidth - Math.round(44 * desktopScale), Math.round(380 * desktopScale)), 2).setPosition(0, accentY);
    this.settingsTitle
      .setStyle({ fontSize: `${Math.round((shortLayout ? 24 : compactLayout ? 26 : 28) * desktopScale)}px` })
      .setPosition(0, titleY)
      .setWordWrapWidth(panelWidth - 36, true);
    this.settingsHint
      .setStyle({
        fontSize: `${Math.round((shortLayout ? 13 : compactLayout ? 14 : 15) * desktopScale)}px`,
        wordWrap: { width: panelWidth - 48 },
        align: "center",
      })
      .setPosition(0, hintY)
      .setVisible(showHint);

    let cursorY = showHint
      ? hintY + this.settingsHint.height / 2 + Math.round((shortLayout ? 22 : 28) * desktopScale)
      : accentY + Math.round((shortLayout ? 28 : 34) * desktopScale);
    const controls = [
      { button: this.settingsQualityButton, label: this.settingsQualityLabel },
      { button: this.settingsSfxButton, label: this.settingsSfxLabel },
      { button: this.settingsMusicButton, label: this.settingsMusicLabel },
      { button: this.settingsLanguageButton, label: this.settingsLanguageLabel },
    ];

    for (const control of controls) {
      control.button.setSize(fieldWidth, fieldHeight).setPosition(0, cursorY);
      control.label.setStyle({ fontSize: `${Math.round((shortLayout ? 16 : compactLayout ? 17 : 16) * desktopScale)}px` }).setPosition(0, cursorY);
      fitTextScaleToWidth(control.label, fieldWidth - 22, 0.86);
      cursorY += fieldHeight + rowGap;
    }

    const actionGap = Math.round(12 * desktopScale);
    const actionWidth = Math.max(Math.round(120 * desktopScale), Math.min(Math.round(172 * desktopScale), Math.floor((fieldWidth - actionGap) / 2)));
    const actionHeight = Math.round((shortLayout ? 42 : 46) * desktopScale);
    const actionY = panelHeight / 2 - actionHeight / 2 - Math.round((shortLayout ? 12 : 18) * desktopScale);

    this.settingsResumeButton.setSize(actionWidth, actionHeight).setPosition(-(actionWidth / 2 + actionGap / 2), actionY);
    this.settingsResumeLabel
      .setStyle({ fontSize: `${Math.round((shortLayout ? 16 : compactLayout ? 17 : 16) * desktopScale)}px` })
      .setPosition(this.settingsResumeButton.x, this.settingsResumeButton.y);
    fitTextScaleToWidth(this.settingsResumeLabel, actionWidth - 20, 0.88);

    this.settingsMenuButton.setSize(actionWidth, actionHeight).setPosition(actionWidth / 2 + actionGap / 2, actionY);
    this.settingsMenuLabel
      .setStyle({ fontSize: `${Math.round((shortLayout ? 16 : compactLayout ? 17 : 16) * desktopScale)}px` })
      .setPosition(this.settingsMenuButton.x, this.settingsMenuButton.y);
    fitTextScaleToWidth(this.settingsMenuLabel, actionWidth - 20, 0.88);
  }

  private layoutHud(): void {
    const x = 16;
    const y = 12;
    const panelPaddingX = 12;
    const panelPaddingY = 10;
    const rowGap = 6;
    const compactHud = this.isCompactOverlayLayout();
    const panelWidth = Math.max(
      300,
      Math.min(
        Math.round(Math.min(Math.max(compactHud ? 328 : 332, this.scale.width * (compactHud ? 0.42 : 0.34)), compactHud ? 396 : 408)),
        this.scale.width - 24
      )
    );
    const contentLeft = x + panelPaddingX;
    const contentTop = y + panelPaddingY;
    const contentWidth = panelWidth - panelPaddingX * 2;

    this.hudText.setStyle({ fontSize: compactHud ? "15px" : "16px" });
    this.boltsText.setStyle({ fontSize: compactHud ? "15px" : "16px" });
    this.waveText.setStyle({ fontSize: compactHud ? "14px" : "15px", wordWrap: { width: contentWidth } });
    this.dailyText.setStyle({ fontSize: compactHud ? "14px" : "15px", wordWrap: { width: contentWidth } });
    this.statusText.setStyle({ fontSize: compactHud ? "13px" : "14px", wordWrap: { width: contentWidth } });

    let nextY = contentTop;
    this.hudText.setPosition(contentLeft, nextY);
    this.boltsText.setPosition(contentLeft + this.hudText.width + 10, nextY);
    if (compactHud || this.boltsText.x + this.boltsText.width > x + panelWidth - panelPaddingX) {
      this.boltsText.setPosition(contentLeft, nextY + this.hudText.height + rowGap);
      nextY += this.hudText.height + this.boltsText.height + rowGap;
    } else {
      nextY += Math.max(this.hudText.height, this.boltsText.height) + rowGap;
    }

    this.waveText.setPosition(contentLeft, nextY);
    nextY += this.waveText.height + rowGap;

    if (this.dailyText.visible) {
      this.dailyText.setPosition(contentLeft, nextY);
      nextY += this.dailyText.height + rowGap;
    }

    this.statusText.setPosition(contentLeft, nextY);
    this.statusText.setWordWrapWidth(contentWidth, true);
    nextY += (this.statusText.visible ? Math.max(18, this.statusText.height) + rowGap : 0);

    const progressWidth = Math.max(200, contentWidth);
    this.levelProgressFrame.setSize(progressWidth, 14).setPosition(contentLeft, nextY);
    this.levelProgressFill.setPosition(contentLeft + 4, nextY + this.levelProgressFrame.height / 2);
    const usableWidth = Math.max(32, this.levelProgressFrame.width - 8);
    const segments = Math.max(1, this.levelProgressMarkers.length + 1);
    for (let i = 0; i < this.levelProgressMarkers.length; i++) {
      const marker = this.levelProgressMarkers[i]!;
      const ratio = (i + 1) / segments;
      marker.setPosition(contentLeft + 4 + usableWidth * ratio, nextY + this.levelProgressFrame.height / 2);
    }
    const panelHeight = nextY + this.levelProgressFrame.height + panelPaddingY - y;
    this.hudPanel.setPosition(x, y).setSize(panelWidth, panelHeight);

    const bounds = this.boltsText.getBounds();
    const bx = bounds.centerX;
    const by = bounds.centerY;
    if (Number.isFinite(bx) && Number.isFinite(by)) {
      this.registry.set("uiBoltsPos", { x: bx, y: by });
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.modalActive) return;
    this.enableAudio();
    if (this.joyPointerId !== null) return;
    if (p.x > this.scale.width * 0.55) return;
    const dx = p.x - this.joyBase.x;
    const dy = p.y - this.joyBase.y;
    if (dx * dx + dy * dy > (this.joyRadius * 1.35) ** 2) return;
    this.joyPointerId = p.id;
    this.updateJoystick(p.x, p.y);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.modalActive) return;
    if (this.joyPointerId !== p.id) return;
    this.updateJoystick(p.x, p.y);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.modalActive) return;
    if (this.joyPointerId !== p.id) return;
    this.releaseControls();
  }

  private updateJoystick(x: number, y: number): void {
    const dx = x - this.joyBase.x;
    const dy = y - this.joyBase.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const max = this.joyRadius;
    const k = len > max && len > 0.001 ? max / len : 1;
    const nx = (dx * k) / max;
    const ny = (dy * k) / max;
    inputState.moveX = clamp(nx, -1, 1);
    inputState.moveY = clamp(ny, -1, 1);
    this.joyKnob.setPosition(this.joyBase.x + dx * k, this.joyBase.y + dy * k);
  }

  private createTutorial(): void {
    const s = this.saveData;
    const tutorialMode = this.isTrainingMode();
    this.tutorialActive = tutorialMode || !(s?.tutorial?.completed || s?.tutorial?.skipped);

    const bg = this.add.rectangle(0, 0, 520, 64, 0x0f1720, 0.92).setStrokeStyle(2, 0x3aa4d4, 0.8);
    this.tutorialBg = bg;
    this.tutorialText = this.add
      .text(-240, -18, "", { fontSize: "15px", color: "#d9f2ff", wordWrap: { width: 430 } })
      .setOrigin(0, 0);
    const btn = this.add
      .rectangle(220, 0, 70, 34, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.8)
      .setInteractive({ useHandCursor: true });
    this.tutorialActionButton = btn;
    this.tutorialActionLabel = this.add
      .text(220, 0, tutorialMode ? t(this.locale, "tutorial.exit") : t(this.locale, "tutorial.skip"), {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    btn.on("pointerdown", () => void (tutorialMode ? this.exitTrainingMode() : this.skipTutorial()));

    this.tutorialBox = this.add.container(0, 0, [bg, this.tutorialText, btn, this.tutorialActionLabel]).setDepth(1200).setScrollFactor(0);
    this.tutorialBox.setVisible(this.tutorialActive);
    this.refreshTutorialText();

    if (this.tutorialActive) {
      this.track(ANALYTICS_EVENTS.TUTORIAL_START, { step: this.tutorialStep, mode: this.runState?.mode ?? "run" });
      if (tutorialMode) this.game.events.emit(GAME_EVENTS.TUTORIAL_STEP_CHANGED, { step: this.tutorialStep });
    }
  }

  private refreshTutorialText(): void {
    if (!this.tutorialActive) return;
    const label = this.isTrainingMode() ? t(this.locale, "tutorial.trainingLabel") : t(this.locale, "tutorial.stepLabel");
    if (this.tutorialStep === 1) {
      this.tutorialText.setText(`${label} 1/3: ${t(this.locale, "tutorial.step1", { count: this.tutorialScrap })}`);
    }
    if (this.tutorialStep === 2) this.tutorialText.setText(`${label} 2/3: ${t(this.locale, "tutorial.step2")}`);
    if (this.tutorialStep === 3) this.tutorialText.setText(`${label} 3/3: ${t(this.locale, "tutorial.step3")}`);
    if (this.tutorialBg?.scene) this.layoutTutorialOverlay();
  }

  private bindTutorialEvents(): void {
    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onTutorialScrap, this);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onTutorialFlip, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onTutorialBank, this);
  }

  private bindAudioEvents(): void {
    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onSfxPickup, this);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onSfxFlip, this);
    this.game.events.on(GAME_EVENTS.DASH_ARC, this.onSfxDashArc, this);
    this.game.events.on(GAME_EVENTS.DASH_SIPHON, this.onSfxDashSiphon, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onSfxBank, this);
    this.game.events.on(GAME_EVENTS.PLAYER_HIT, this.onSfxHit, this);
    this.game.events.on(GAME_EVENTS.UPGRADE_PICKED, this.onSfxUpgrade, this);
  }

  private bindReviveEvents(): void {
    this.game.events.on(GAME_EVENTS.REVIVE_OFFER, this.onReviveOffer, this);
  }

  private bindAnalyticsEvents(): void {
    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onAnalyticsScrap, this);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onAnalyticsFlip, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onAnalyticsBank, this);
    this.game.events.on(GAME_EVENTS.UPGRADE_PICKED, this.onAnalyticsUpgradePick, this);
    this.game.events.on(GAME_EVENTS.REVIVE_OFFER, this.onAnalyticsReviveOffer, this);
    this.game.events.on(GAME_EVENTS.REVIVE_ACCEPTED, this.onAnalyticsReviveAccept, this);
    this.game.events.on(GAME_EVENTS.REVIVE_DECLINED, this.onAnalyticsReviveDecline, this);
  }

  private track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.analytics?.track(eventName, payload);
    } catch {
      // ignore
    }
  }

  private async trackActivationOnce(
    flag: keyof SaveData["liveops"]["activation"],
    eventName: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const saveManager = this.saveManager;
    if (!saveManager) return;
    const result = markActivationFlag(saveManager.get(), flag);
    if (!result.changed) return;
    this.track(eventName, payload);
    await saveManager.save(result.save);
    this.registry.set("saveData", saveManager.get());
    this.saveData = saveManager.get();
  }

  private createReviveOverlay(): void {
    this.reviveDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72).setDepth(1400).setScrollFactor(0);
    this.revivePanel = this.add.rectangle(0, 0, 420, 190, 0x0f1720, 0.96).setStrokeStyle(2, 0x5cc8ff, 0.9);
    this.reviveTitle = this.add
      .text(0, -70, t(this.locale, "revive.title"), { fontSize: "26px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.reviveHint = this.add
      .text(0, -32, t(this.locale, "revive.hint"), { fontSize: "15px", color: "#98b7c7", align: "center" })
      .setOrigin(0.5);

    const btnYes = this.add
      .rectangle(0, 42, 260, 54, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    this.reviveAcceptButton = btnYes;
    this.reviveAcceptLabel = this.add
      .text(0, 42, t(this.locale, "revive.accept"), { fontSize: "18px", color: "#d9f2ff", fontStyle: "700", align: "center" })
      .setOrigin(0.5);

    const btnNo = this.add
      .rectangle(0, 104, 260, 46, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    this.reviveDeclineButton = btnNo;
    this.reviveDeclineLabel = this.add
      .text(0, 104, t(this.locale, "revive.decline"), { fontSize: "16px", color: "#d9f2ff", fontStyle: "700", align: "center" })
      .setOrigin(0.5);

    btnYes.on("pointerdown", () => void this.handleRevive(true));
    btnNo.on("pointerdown", () => this.handleRevive(false));

    this.reviveBox = this.add
      .container(0, 0, [this.reviveDim, this.revivePanel, this.reviveTitle, this.reviveHint, btnYes, this.reviveAcceptLabel, btnNo, this.reviveDeclineLabel])
      .setDepth(1400)
      .setScrollFactor(0);
    this.reviveBox.setVisible(false);
  }

  private createSettingsOverlay(): void {
    this.settingsDim = this.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.76)
      .setDepth(1450)
      .setScrollFactor(0)
      .setInteractive();
    this.settingsDim.on("pointerdown", () => this.closeSettings());

    const panel = this.add.rectangle(0, 0, 468, 410, 0x0f1720, 0.97).setStrokeStyle(2, 0xffd166, 0.82);
    const accent = this.add.rectangle(0, -150, 380, 2, 0x5cc8ff, 0.85);
    this.settingsPanel = panel;
    this.settingsAccent = accent;
    this.settingsTitle = this.add
      .text(0, -178, t(this.locale, "pause.title"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.settingsHint = this.add
      .text(0, -132, t(this.locale, "pause.hint"), {
        fontSize: "14px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5);

    const createSettingsButton = (y: number, accentColor: number, onPress: () => void) => {
      const button = this.add
        .rectangle(0, y, 360, 46, 0x121a24, 0.96)
        .setStrokeStyle(2, accentColor, 0.78)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(0, y, "", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
        .setOrigin(0.5);
      button.on("pointerdown", () => {
        this.enableAudio();
        this.playSfx("sfx_ui_click");
        onPress();
      });
      return { button, label };
    };

    const qualityButton = createSettingsButton(-72, 0x3aa4d4, () => void this.cycleQualitySetting());
    this.settingsQualityButton = qualityButton.button;
    this.settingsQualityLabel = qualityButton.label;

    const sfxButton = createSettingsButton(-14, 0x3aa4d4, () => void this.cycleAudioSetting("sfxVolume"));
    this.settingsSfxButton = sfxButton.button;
    this.settingsSfxLabel = sfxButton.label;

    const musicButton = createSettingsButton(44, 0x57c27d, () => void this.cycleAudioSetting("musicVolume"));
    this.settingsMusicButton = musicButton.button;
    this.settingsMusicLabel = musicButton.label;

    const languageButton = createSettingsButton(102, 0xffd166, () => void this.cycleLanguageSetting());
    this.settingsLanguageButton = languageButton.button;
    this.settingsLanguageLabel = languageButton.label;

    this.settingsResumeButton = this.add
      .rectangle(-92, 172, 172, 44, 0x1b2635, 0.96)
      .setStrokeStyle(2, 0x57c27d, 0.82)
      .setInteractive({ useHandCursor: true });
    this.settingsResumeButton.on("pointerdown", () => {
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      this.closeSettings();
    });
    this.settingsResumeLabel = this.add
      .text(-92, 172, t(this.locale, "pause.resume"), { fontSize: "15px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    this.settingsMenuButton = this.add
      .rectangle(92, 172, 172, 44, 0x121a24, 0.96)
      .setStrokeStyle(2, 0x5f6b76, 0.82)
      .setInteractive({ useHandCursor: true });
    this.settingsMenuButton.on("pointerdown", () => {
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      this.returnToMenu();
    });
    this.settingsMenuLabel = this.add
      .text(92, 172, t(this.locale, "pause.menu"), { fontSize: "15px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    this.settingsBox = this.add
      .container(0, 0, [
        this.settingsDim,
        panel,
        accent,
        this.settingsTitle,
        this.settingsHint,
        this.settingsQualityButton,
        this.settingsQualityLabel,
        this.settingsSfxButton,
        this.settingsSfxLabel,
        this.settingsMusicButton,
        this.settingsMusicLabel,
        this.settingsLanguageButton,
        this.settingsLanguageLabel,
        this.settingsResumeButton,
        this.settingsResumeLabel,
        this.settingsMenuButton,
        this.settingsMenuLabel,
      ])
      .setDepth(1451)
      .setScrollFactor(0);
    this.settingsBox.setVisible(false);
  }

  private onReviveOffer(): void {
    void signalPlatformGameplayStop(this.platformAdapter);
    this.modalActive = true;
    this.reviveBusy = false;
    this.reviveBox.setVisible(true);
    this.layout();
  }

  private async handleRevive(wantRevive: boolean): Promise<void> {
    if (!this.modalActive) return;
    if (this.reviveBusy) return;

    this.enableAudio();
    this.playSfx("sfx_ui_click");

    if (!wantRevive) {
      this.hideReviveOverlay();
      this.game.events.emit(GAME_EVENTS.REVIVE_DECLINED, {});
      return;
    }

    this.reviveBusy = true;
    const ads = this.ads;
    const res = ads ? await ads.showRewarded(AD_PLACEMENTS.REVIVE) : { ok: true, rewarded: false };
    this.reviveBusy = false;
    this.hideReviveOverlay();

    if (res.ok && (res as any).rewarded === true) this.game.events.emit(GAME_EVENTS.REVIVE_ACCEPTED, {});
    else this.game.events.emit(GAME_EVENTS.REVIVE_DECLINED, {});
  }

  private hideReviveOverlay(): void {
    this.modalActive = false;
    this.reviveBox.setVisible(false);
    this.releaseControls();
  }

  private onTutorialScrap(): void {
    if (!this.tutorialActive || this.tutorialStep !== 1) return;
    this.tutorialScrap += 1;
    if (this.tutorialScrap >= 3) {
      this.tutorialStep = 2;
      this.track(ANALYTICS_EVENTS.TUTORIAL_STEP, { step: 1, mode: this.runState?.mode ?? "run" });
      if (this.isTrainingMode()) this.game.events.emit(GAME_EVENTS.TUTORIAL_STEP_CHANGED, { step: this.tutorialStep });
    }
    this.refreshTutorialText();
  }

  private onTutorialFlip(): void {
    if (!this.tutorialActive || this.tutorialStep !== 2) return;
    this.tutorialStep = 3;
    this.track(ANALYTICS_EVENTS.TUTORIAL_STEP, { step: 2, mode: this.runState?.mode ?? "run" });
    if (this.isTrainingMode()) this.game.events.emit(GAME_EVENTS.TUTORIAL_STEP_CHANGED, { step: this.tutorialStep });
    this.refreshTutorialText();
  }

  private onTutorialBank(): void {
    if (!this.tutorialActive || this.tutorialStep !== 3) return;
    this.track(ANALYTICS_EVENTS.TUTORIAL_STEP, { step: 3, mode: this.runState?.mode ?? "run" });
    void this.completeTutorial();
  }

  private async completeTutorial(): Promise<void> {
    this.tutorialActive = false;
    this.tutorialBox.setVisible(false);
    const tutorialMode = this.isTrainingMode();
    this.track(ANALYTICS_EVENTS.TUTORIAL_COMPLETE, { mode: this.runState?.mode ?? "run" });
    if (this.saveManager) {
      const s = this.saveManager.get();
      await this.saveManager.save({ ...s, tutorial: { ...s.tutorial, completed: true } });
      this.registry.set("saveData", this.saveManager.get());
    }
    if (tutorialMode) {
      this.time.delayedCall(180, () => this.game.events.emit(GAME_EVENTS.TUTORIAL_FINISHED, {}));
    }
  }

  private async skipTutorial(): Promise<void> {
    this.tutorialActive = false;
    this.tutorialBox.setVisible(false);
    this.track(ANALYTICS_EVENTS.TUTORIAL_SKIP, { mode: this.runState?.mode ?? "run" });
    if (!this.saveManager) return;
    const s = this.saveManager.get();
    await this.saveManager.save({ ...s, tutorial: { ...s.tutorial, skipped: true } });
    this.registry.set("saveData", this.saveManager.get());
  }

  private async exitTrainingMode(): Promise<void> {
    this.tutorialActive = false;
    this.tutorialBox.setVisible(false);
    this.track(ANALYTICS_EVENTS.TUTORIAL_SKIP, { mode: "tutorial", action: "exit" });
    this.game.events.emit(GAME_EVENTS.TUTORIAL_EXITED, {});
  }

  private isTrainingMode(): boolean {
    return this.runState?.mode === "tutorial";
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

    this.resumeMusicIfAllowed();
  }

  private playSfx(key: string): void {
    if (!this.audioEnabled) return;
    try {
      this.sound.play(key, { volume: this.sfxVolume });
    } catch {
      // ignore
    }
  }

  private getDailyLabel(): string {
    if (!this.runState?.daily?.variantId) return "?";
    const variant = this.staticData?.daily.dailyVariants.find((entry) => entry.id === this.runState?.daily?.variantId);
    return getDailyVariantCopy(this.locale, this.runState.daily.variantId, variant?.ui?.title ?? this.runState.daily.variantId).title;
  }

  private onEscapePressed(): void {
    if (this.reviveBox.visible) return;
    if (this.scene.isActive("upgrade")) return;
    if (this.settingsVisible) {
      this.closeSettings();
      return;
    }
    if (!this.modalActive) this.openSettings();
  }

  private openSettings(): void {
    if (this.settingsVisible || this.modalActive || this.scene.isActive("upgrade")) return;
    this.settingsVisible = true;
    this.modalActive = true;
    this.releaseControls();
    void signalPlatformGameplayStop(this.platformAdapter);
    this.scene.pause("game");
    this.pauseButton.setVisible(false);
    this.pauseLabel.setVisible(false);
    this.settingsBox.setVisible(true);
    this.refreshLocalizedUi();
    this.layout();
  }

  private closeSettings(): void {
    if (!this.settingsVisible) return;
    this.settingsVisible = false;
    this.modalActive = false;
    this.settingsBox.setVisible(false);
    this.pauseButton.setVisible(true);
    this.pauseLabel.setVisible(true);
    if (this.suspendReasons.size === 0) this.scene.resume("game");
  }

  private returnToMenu(): void {
    this.settingsVisible = false;
    this.modalActive = false;
    this.settingsBox.setVisible(false);
    void signalPlatformGameplayStop(this.platformAdapter);
    this.scene.stop("upgrade");
    this.scene.stop("game");
    this.scene.start("menu");
  }

  private async cycleQualitySetting(): Promise<void> {
    const order: SaveData["settings"]["visualQuality"][] = ["auto", "low", "medium", "high"];
    const idx = order.indexOf(this.qualityPref);
    this.qualityPref = order[(idx + 1) % order.length] ?? "auto";
    await this.saveSettings({ visualQuality: this.qualityPref });
    this.game.events.emit(GAME_EVENTS.SETTINGS_CHANGED, { visualQuality: this.qualityPref });
    this.refreshLocalizedUi();
  }

  private async cycleAudioSetting(key: "sfxVolume" | "musicVolume"): Promise<void> {
    const next = nextVolumeStep(key === "sfxVolume" ? this.sfxVolume : this.musicVolume);
    if (key === "sfxVolume") {
      this.sfxVolume = next;
    } else {
      this.musicVolume = next;
      (this.music as any)?.setVolume?.(next);
      if (this.music && typeof (this.music as any).volume === "number") (this.music as any).volume = next;
    }

    await this.saveSettings({ [key]: next });
    this.refreshLocalizedUi();
  }

  private async cycleLanguageSetting(): Promise<void> {
    const order: LanguageSetting[] = ["auto", "ru", "en"];
    const idx = order.indexOf(this.languageSetting);
    this.languageSetting = order[(idx + 1) % order.length] ?? "auto";
    this.locale = this.resolveLocaleSetting(this.languageSetting);
    this.registry.set("languageSetting", this.languageSetting);
    this.registry.set("locale", this.locale);
    await this.saveSettings({ language: this.languageSetting });
    this.game.events.emit(GAME_EVENTS.SETTINGS_CHANGED, { locale: this.locale });
    this.refreshLocalizedUi();
    this.layoutHud();
  }

  private async saveSettings(patch: Partial<SaveData["settings"]>): Promise<void> {
    if (!this.saveManager) return;
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, ...patch } };
    await this.saveManager.save(next);
    this.saveData = this.saveManager.get();
    this.registry.set("saveData", this.saveData);
  }

  private refreshLocalizedUi(): void {
    this.pauseLabel.setText(t(this.locale, "pause.open"));
    this.settingsTitle.setText(t(this.locale, "pause.title"));
    this.settingsHint.setText(t(this.locale, "pause.hint"));
    this.settingsQualityLabel.setText(`${t(this.locale, "settings.gfx")}: ${formatQualityLabel(this.locale, this.qualityPref)}`);
    this.settingsSfxLabel.setText(`${t(this.locale, "settings.sfx")}: ${formatVolume(this.locale, this.sfxVolume)}`);
    this.settingsMusicLabel.setText(`${t(this.locale, "settings.music")}: ${formatVolume(this.locale, this.musicVolume)}`);
    this.settingsLanguageLabel.setText(`${t(this.locale, "settings.language")}: ${getLanguageSettingLabel(this.locale, this.languageSetting)}`);
    this.settingsResumeLabel.setText(t(this.locale, "pause.resume"));
    this.settingsMenuLabel.setText(t(this.locale, "pause.menu"));

    this.settingsQualityButton.setStrokeStyle(2, qualityStroke(this.qualityPref), 0.82);
    this.settingsSfxButton.setStrokeStyle(2, this.sfxVolume <= 0 ? 0x5f6b76 : 0x3aa4d4, this.sfxVolume <= 0 ? 0.58 : 0.82);
    this.settingsMusicButton.setStrokeStyle(2, this.musicVolume <= 0 ? 0x5f6b76 : 0x57c27d, this.musicVolume <= 0 ? 0.58 : 0.82);
    this.settingsLanguageButton.setStrokeStyle(2, languageStroke(this.languageSetting), 0.82);

    this.flipLabel.setText(t(this.locale, "hud.flip"));
    this.dashLabel.setText(t(this.locale, "hud.dash"));
    this.refreshDashHudBadges(this.btnDash.visible);
    this.tutorialActionLabel.setText(this.isTrainingMode() ? t(this.locale, "tutorial.exit") : t(this.locale, "tutorial.skip"));
    this.reviveTitle.setText(t(this.locale, "revive.title"));
    this.reviveHint.setText(t(this.locale, "revive.hint"));
    this.reviveAcceptLabel.setText(t(this.locale, "revive.accept"));
    this.reviveDeclineLabel.setText(t(this.locale, "revive.decline"));
    this.refreshLevelBannerCopy();
    this.refreshTutorialText();
    if (this.settingsPanel?.scene) this.layoutSettingsOverlay();
  }

  private setExternalPause(reason: string, paused: boolean): void {
    if (paused) this.suspendReasons.add(reason);
    else this.suspendReasons.delete(reason);

    if (this.suspendReasons.size > 0) {
      this.pauseForExternalSuspend();
      this.pauseMusic();
      return;
    }

    if (
      this.externalPauseOwnsGamePause &&
      !this.settingsVisible &&
      !this.reviveBox.visible &&
      !this.scene.isActive("upgrade")
    ) {
      this.externalPauseOwnsGamePause = false;
      this.scene.resume("game");
    }

    this.resumeMusicIfAllowed();
  }

  private pauseForExternalSuspend(): void {
    if (this.externalPauseOwnsGamePause) return;
    if (this.settingsVisible || this.reviveBox.visible || this.scene.isActive("upgrade")) return;
    if (!this.scene.isActive("game") || this.scene.isPaused("game")) return;

    this.externalPauseOwnsGamePause = true;
    void signalPlatformGameplayStop(this.platformAdapter);
    this.scene.pause("game");
  }

  private pauseMusic(): void {
    try {
      const track = this.getMainMusicTrack(false);
      if (!track) return;

      if (typeof (track as any).pause === "function" && track.isPlaying) {
        (track as any).pause();
        return;
      }

      if (track.isPlaying) track.stop();
    } catch {
      // ignore
    }
  }

  private resumeMusicIfAllowed(): void {
    if (!this.audioEnabled) return;
    if (this.suspendReasons.size > 0) return;

    try {
      const menuMusic = (this.sound as any).get?.("music_menu") as Phaser.Sound.BaseSound | undefined;
      if (menuMusic?.isPlaying) menuMusic.stop();

      const track = this.getMainMusicTrack(true);
      if (!track) return;

      (track as any)?.setVolume?.(this.musicVolume);
      if (typeof (track as any).volume === "number") (track as any).volume = this.musicVolume;

      if (typeof (track as any).resume === "function" && (track as any).isPaused) {
        (track as any).resume();
        return;
      }

      if (!track.isPlaying) track.play();
    } catch {
      // ignore
    }
  }

  private getMainMusicTrack(create: boolean): Phaser.Sound.BaseSound | null {
    const existing = ((this.music ?? (this.sound as any).get?.("music_main")) as Phaser.Sound.BaseSound | undefined) ?? null;
    if (existing) {
      this.music = existing;
      return existing;
    }

    if (!create) return null;

    this.music = this.sound.add("music_main", { loop: true, volume: this.musicVolume });
    return this.music;
  }

  private resolveLocaleSetting(setting: LanguageSetting): Locale {
    const platformLanguageHint = (this.registry.get("platformLanguageHint") as string | undefined) ?? null;
    return resolveLocale(setting, platformLanguageHint ? [platformLanguageHint] : null);
  }

  private refreshDashHudBadges(dashEnabled: boolean): void {
    const targets = [this.dashBadgePrimary, this.dashBadgeSecondary];
    const badges = dashEnabled ? getDashHudBadgeSpecs(this.locale, this.runState?.perks as any) : [];
    targets.forEach((target, idx) => {
      const badge = badges[idx];
      if (!badge) {
        target.setText("");
        target.setVisible(false);
        return;
      }
      target.setText(badge.label);
      target.setColor(badge.textColor);
      target.setBackgroundColor(toCssHex(badge.fill));
      target.setVisible(true);
    });
    this.layoutDashHudBadges();
  }

  private layoutDashHudBadges(): void {
    const badges = [this.dashBadgePrimary, this.dashBadgeSecondary].filter((badge) => badge.visible);
    if (badges.length === 0) return;

    const gap = 6;
    const totalWidth = badges.reduce((sum, badge) => sum + badge.width, 0) + gap * (badges.length - 1);
    let cursor = this.btnDash.x - totalWidth / 2;
    const y = this.btnDash.y - 44;
    for (const badge of badges) {
      badge.setPosition(cursor + badge.width / 2, y);
      cursor += badge.width + gap;
    }
  }

  private releaseControls(): void {
    this.joyPointerId = null;
    inputState.moveX = 0;
    inputState.moveY = 0;
    this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toCssHex(color: number): string {
  return `#${Math.max(0, Math.min(0xffffff, color >>> 0)).toString(16).padStart(6, "0")}`;
}

function fitTextScaleToWidth(text: Phaser.GameObjects.Text, maxWidth: number, minScale = 0.72): void {
  text.setScale(1);
  if (text.width <= 0 || text.width <= maxWidth) return;
  text.setScale(Phaser.Math.Clamp(maxWidth / text.width, minScale, 1));
}

function getResponsiveOverlayScale(
  width: number,
  height: number,
  baseWidth: number,
  baseHeight: number,
  factor: number,
  maxScale = 1.45
): number {
  const ratio = Math.min(width / baseWidth, height / baseHeight);
  if (!Number.isFinite(ratio) || ratio <= 1) return 1;
  return Phaser.Math.Clamp(1 + (ratio - 1) * factor, 1, maxScale);
}

function formatCooldown(locale: Locale, seconds: number): string {
  return formatShortSeconds(locale, seconds);
}
