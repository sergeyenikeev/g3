import Phaser from "phaser";
import { inputState } from "../input/inputState";
import { GAME_EVENTS } from "../events";
import type { RunState } from "../run/runState";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { SaveData, SaveManager } from "../../platform/save/saveManager";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { StaticGameData } from "../../data/staticGameData";
import { VISUAL_PALETTE, createLightGradient, createVfxTextures, createVignette } from "../../visual/TextureFactory";
import { languageStroke, nextVolumeStep, qualityStroke, snapVolumeStep } from "./uiSettingsHelpers";
import {
  type LanguageSetting,
  type Locale,
  formatNumber,
  formatQualityLabel,
  formatVolume,
  getDailyVariantCopy,
  getLanguageSettingLabel,
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
  private locale: Locale = "en";
  private languageSetting: LanguageSetting = "auto";
  private qualityPref: SaveData["settings"]["visualQuality"] = "auto";

  private overlayVignette!: Phaser.GameObjects.Image;
  private overlayLight!: Phaser.GameObjects.Image;

  private hudText!: Phaser.GameObjects.Text;
  private boltsText!: Phaser.GameObjects.Text;
  private dailyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointerId: number | null = null;
  private joyRadius = 56;

  private btnFlip!: Phaser.GameObjects.Arc;
  private btnDash!: Phaser.GameObjects.Arc;
  private flipLabel!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;
  private flipGlow!: Phaser.GameObjects.Image;
  private dashGlow!: Phaser.GameObjects.Image;
  private pauseButton!: Phaser.GameObjects.Rectangle;
  private pauseLabel!: Phaser.GameObjects.Text;
  private flipPulseT = 0;

  private tutorialActive = false;
  private tutorialStep: TutorialStep = 1;
  private tutorialScrap = 0;
  private tutorialBox!: Phaser.GameObjects.Container;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialActionLabel!: Phaser.GameObjects.Text;

  private modalActive = false;
  private reviveBusy = false;
  private reviveBox!: Phaser.GameObjects.Container;
  private reviveDim!: Phaser.GameObjects.Rectangle;
  private revivePanel!: Phaser.GameObjects.Rectangle;
  private reviveTitle!: Phaser.GameObjects.Text;
  private reviveHint!: Phaser.GameObjects.Text;
  private reviveAcceptLabel!: Phaser.GameObjects.Text;
  private reviveDeclineLabel!: Phaser.GameObjects.Text;
  private settingsVisible = false;
  private settingsDim!: Phaser.GameObjects.Rectangle;
  private settingsBox!: Phaser.GameObjects.Container;
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

  private readonly onSfxPickup = () => this.playSfx("sfx_pickup");
  private readonly onSfxFlip = () => this.playSfx("sfx_flip");
  private readonly onSfxBank = () => this.playSfx("sfx_bank");
  private readonly onSfxHit = () => this.playSfx("sfx_hit");
  private readonly onSfxUpgrade = () => this.playSfx("sfx_upgrade");

  private readonly onAnalyticsFlip = () => this.track(ANALYTICS_EVENTS.FLIP_USED, {});
  private readonly onAnalyticsBank = (p: any) => this.track(ANALYTICS_EVENTS.RECYCLER_BANK_COMPLETE, { bolts: p?.bolts });
  private readonly onAnalyticsUpgradePick = (p: any) => this.track(ANALYTICS_EVENTS.UPGRADE_PICK, p ?? {});

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
    this.languageSetting = normalizeLanguageSetting(this.saveData?.settings?.language ?? "auto");
    this.locale = ((this.registry.get("locale") as Locale | undefined) ?? resolveLocale(this.languageSetting));
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

    const hudStyle = { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" };
    this.hudText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.boltsText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.dailyText = this.add.text(16, 12, "", hudStyle).setDepth(1000).setScrollFactor(0);
    this.waveText = this.add.text(16, 36, "", { fontSize: "14px", color: "#98b7c7", fontStyle: "700" }).setDepth(1000).setScrollFactor(0);
    this.statusText = this.add
      .text(16, 56, "", { fontSize: "13px", color: "#7fdfff", fontStyle: "700", wordWrap: { width: 520 } })
      .setDepth(1000)
      .setScrollFactor(0);

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onTutorialScrap, this);
      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onTutorialFlip, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onTutorialBank, this);

      this.game.events.off(GAME_EVENTS.SCRAP_COLLECTED, this.onSfxPickup, this);
      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onSfxFlip, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onSfxBank, this);
      this.game.events.off(GAME_EVENTS.PLAYER_HIT, this.onSfxHit, this);
      this.game.events.off(GAME_EVENTS.UPGRADE_PICKED, this.onSfxUpgrade, this);

      this.game.events.off(GAME_EVENTS.REVIVE_OFFER, this.onReviveOffer, this);

      this.game.events.off(GAME_EVENTS.FLIP_USED, this.onAnalyticsFlip, this);
      this.game.events.off(GAME_EVENTS.BANK_COMPLETE, this.onAnalyticsBank, this);
      this.game.events.off(GAME_EVENTS.UPGRADE_PICKED, this.onAnalyticsUpgradePick, this);
      this.input.keyboard?.off("keydown-ESC", this.onEscapePressed, this);
    });

    this.scale.on("resize", () => this.layout());
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
    const bolts = this.runState.bolts;
    const daily =
      this.runState.mode === "daily"
        ? `| ${t(this.locale, "hud.daily")}: ${this.getDailyLabel()}`
        : this.runState.mode === "tutorial"
          ? `| ${t(this.locale, "hud.training")}`
          : "";

    this.hudText.setText(`${t(this.locale, "hud.hp")} ${formatNumber(this.locale, hp)}/${formatNumber(this.locale, hpMax)} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, wave)}`);
    this.boltsText.setText(`${t(this.locale, "hud.bolts")} ${formatNumber(this.locale, bolts)}`);
    this.dailyText.setText(daily);
    this.dailyText.setVisible(Boolean(daily));
    const waveLabel = ((this.registry.get("uiStatusPrimary") as string | undefined) ?? "").trim();
    const statusLabel = ((this.registry.get("uiStatusSecondary") as string | undefined) ?? "").trim();
    this.waveText.setText(waveLabel);
    this.waveText.setVisible(Boolean(waveLabel));
    this.statusText.setText(statusLabel);
    this.statusText.setVisible(Boolean(statusLabel));
    this.layoutHud();

    const dashEnabled = Boolean(this.runState.config.dash.enabledByDefault) || Boolean((this.runState.perks as any).dash_module);
    this.btnDash.setVisible(dashEnabled);
    this.dashLabel.setVisible(dashEnabled);
    this.dashGlow.setVisible(dashEnabled);

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
      .text(0, 0, t(this.locale, "hud.dash"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);

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
      .text(0, 0, t(this.locale, "pause.open"), { fontSize: "13px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);
  }

  private layout(): void {
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

    this.pauseButton.setPosition(width - margin - 58, margin + 18);
    this.pauseLabel.setPosition(this.pauseButton.x, this.pauseButton.y);

    this.tutorialBox.setPosition(width / 2, margin + 62);
    this.reviveBox.setPosition(width / 2, height / 2);
    this.reviveDim.setSize(width, height);
    this.settingsBox.setPosition(width / 2, height / 2);
    this.settingsDim.setSize(width, height);

    this.layoutHud();
  }

  private layoutHud(): void {
    const x = 16;
    const y = 12;
    const gap = 8;

    this.hudText.setPosition(x, y);
    this.boltsText.setPosition(x + this.hudText.width + gap, y);
    if (this.dailyText.visible) {
      this.dailyText.setPosition(this.boltsText.x + this.boltsText.width + gap, y);
    }
    this.waveText.setPosition(x, y + 22);
    this.statusText.setPosition(x, y + 42);
    this.statusText.setWordWrapWidth(Math.max(260, this.scale.width - 32), true);

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
    this.tutorialText = this.add
      .text(-240, -18, "", { fontSize: "14px", color: "#d9f2ff", wordWrap: { width: 430 } })
      .setOrigin(0, 0);
    const btn = this.add
      .rectangle(220, 0, 70, 34, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.8)
      .setInteractive({ useHandCursor: true });
    this.tutorialActionLabel = this.add
      .text(220, 0, tutorialMode ? t(this.locale, "tutorial.exit") : t(this.locale, "tutorial.skip"), {
        fontSize: "12px",
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
  }

  private bindTutorialEvents(): void {
    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onTutorialScrap, this);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onTutorialFlip, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onTutorialBank, this);
  }

  private bindAudioEvents(): void {
    this.game.events.on(GAME_EVENTS.SCRAP_COLLECTED, this.onSfxPickup, this);
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onSfxFlip, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onSfxBank, this);
    this.game.events.on(GAME_EVENTS.PLAYER_HIT, this.onSfxHit, this);
    this.game.events.on(GAME_EVENTS.UPGRADE_PICKED, this.onSfxUpgrade, this);
  }

  private bindReviveEvents(): void {
    this.game.events.on(GAME_EVENTS.REVIVE_OFFER, this.onReviveOffer, this);
  }

  private bindAnalyticsEvents(): void {
    this.game.events.on(GAME_EVENTS.FLIP_USED, this.onAnalyticsFlip, this);
    this.game.events.on(GAME_EVENTS.BANK_COMPLETE, this.onAnalyticsBank, this);
    this.game.events.on(GAME_EVENTS.UPGRADE_PICKED, this.onAnalyticsUpgradePick, this);
  }

  private track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.analytics?.track(eventName, payload);
    } catch {
      // ignore
    }
  }

  private createReviveOverlay(): void {
    this.reviveDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72).setDepth(1400).setScrollFactor(0);
    this.revivePanel = this.add.rectangle(0, 0, 420, 190, 0x0f1720, 0.96).setStrokeStyle(2, 0x5cc8ff, 0.9);
    this.reviveTitle = this.add
      .text(0, -70, t(this.locale, "revive.title"), { fontSize: "26px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.reviveHint = this.add
      .text(0, -32, t(this.locale, "revive.hint"), { fontSize: "14px", color: "#98b7c7", align: "center" })
      .setOrigin(0.5);

    const btnYes = this.add
      .rectangle(0, 42, 260, 54, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    this.reviveAcceptLabel = this.add
      .text(0, 42, t(this.locale, "revive.accept"), { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const btnNo = this.add
      .rectangle(0, 104, 260, 46, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    this.reviveDeclineLabel = this.add
      .text(0, 104, t(this.locale, "revive.decline"), { fontSize: "14px", color: "#d9f2ff", fontStyle: "700" })
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
    this.settingsTitle = this.add
      .text(0, -178, t(this.locale, "pause.title"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.settingsHint = this.add
      .text(0, -132, t(this.locale, "pause.hint"), {
        fontSize: "13px",
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
      .text(-92, 172, t(this.locale, "pause.resume"), { fontSize: "14px", color: "#d9f2ff", fontStyle: "700" })
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
      .text(92, 172, t(this.locale, "pause.menu"), { fontSize: "14px", color: "#d9f2ff", fontStyle: "700" })
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

    try {
      const menuMusic = (this.sound as any).get?.("music_menu") as Phaser.Sound.BaseSound | undefined;
      if (menuMusic?.isPlaying) menuMusic.stop();
      const existing = (this.sound as any).get?.("music_main") as Phaser.Sound.BaseSound | undefined;
      this.music = existing ?? this.sound.add("music_main", { loop: true, volume: this.musicVolume });
      (this.music as any).setVolume?.(this.musicVolume);
      if (typeof (this.music as any).volume === "number") (this.music as any).volume = this.musicVolume;
      if (!this.music.isPlaying) this.music.play();
    } catch {
      // ignore
    }
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
    this.scene.resume("game");
  }

  private returnToMenu(): void {
    this.settingsVisible = false;
    this.modalActive = false;
    this.settingsBox.setVisible(false);
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
    this.locale = resolveLocale(this.languageSetting);
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
    this.tutorialActionLabel.setText(this.isTrainingMode() ? t(this.locale, "tutorial.exit") : t(this.locale, "tutorial.skip"));
    this.reviveTitle.setText(t(this.locale, "revive.title"));
    this.reviveHint.setText(t(this.locale, "revive.hint"));
    this.reviveAcceptLabel.setText(t(this.locale, "revive.accept"));
    this.reviveDeclineLabel.setText(t(this.locale, "revive.decline"));
    this.refreshTutorialText();
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

function formatCooldown(locale: Locale, seconds: number): string {
  return `${Math.ceil(Math.max(0, seconds))}${locale === "ru" ? "с" : "s"}`;
}
