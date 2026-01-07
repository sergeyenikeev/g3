import Phaser from "phaser";
import { inputState } from "../input/inputState";
import { GAME_EVENTS } from "../events";
import type { RunState } from "../run/runState";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import type { SaveData, SaveManager } from "../../platform/save/saveManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";

type TutorialStep = 1 | 2 | 3;

export class UIScene extends Phaser.Scene {
  private runState: RunState | null = null;
  private saveManager: SaveManager | null = null;
  private saveData: SaveData | null = null;
  private adapter: PlatformAdapter | null = null;

  private hudText!: Phaser.GameObjects.Text;

  private joyBase!: Phaser.GameObjects.Arc;
  private joyKnob!: Phaser.GameObjects.Arc;
  private joyPointerId: number | null = null;
  private joyRadius = 56;

  private btnFlip!: Phaser.GameObjects.Arc;
  private btnDash!: Phaser.GameObjects.Arc;
  private flipLabel!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;

  private tutorialActive = false;
  private tutorialStep: TutorialStep = 1;
  private tutorialScrap = 0;
  private tutorialBox!: Phaser.GameObjects.Container;
  private tutorialText!: Phaser.GameObjects.Text;

  private modalActive = false;
  private reviveBusy = false;
  private reviveBox!: Phaser.GameObjects.Container;
  private reviveDim!: Phaser.GameObjects.Rectangle;
  private revivePanel!: Phaser.GameObjects.Rectangle;
  private reviveTitle!: Phaser.GameObjects.Text;
  private reviveHint!: Phaser.GameObjects.Text;

  private audioEnabled = false;
  private music: Phaser.Sound.BaseSound | null = null;
  private sfxVolume = 0.8;
  private musicVolume = 0.6;

  private readonly onSfxPickup = () => this.playSfx("sfx_pickup");
  private readonly onSfxFlip = () => this.playSfx("sfx_flip");
  private readonly onSfxBank = () => this.playSfx("sfx_bank");
  private readonly onSfxHit = () => this.playSfx("sfx_hit");
  private readonly onSfxUpgrade = () => this.playSfx("sfx_upgrade");

  constructor() {
    super("ui");
  }

  create(): void {
    this.runState = (this.registry.get("runState") as RunState | undefined) ?? null;
    this.saveManager = (this.registry.get("saveManager") as SaveManager | undefined) ?? null;
    this.saveData = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    this.adapter = (this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null;

    this.sfxVolume = this.saveData?.settings?.sfxVolume ?? 0.8;
    this.musicVolume = this.saveData?.settings?.musicVolume ?? 0.6;

    this.input.once("pointerdown", () => this.enableAudio());
    this.input.keyboard?.once("keydown", () => this.enableAudio());

    this.hudText = this.add
      .text(16, 12, "", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setDepth(1000)
      .setScrollFactor(0);

    this.createControls();
    this.createTutorial();
    this.createReviveOverlay();
    this.bindTutorialEvents();
    this.bindAudioEvents();
    this.bindReviveEvents();

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
    });

    this.scale.on("resize", () => this.layout());
    this.layout();
  }

  update(): void {
    const s = (this.registry.get("runState") as RunState | undefined) ?? null;
    this.runState = s;

    if (!this.runState) return;
    const hpMax = this.runState.config.player.hpMax;
    const hp = Math.max(0, this.runState.hp);
    const wave = this.runState.waveIndex;
    const bolts = this.runState.bolts;
    const daily = this.runState.mode === "daily" ? ` | Daily: ${this.runState.daily?.variantId ?? "?"}` : "";

    this.hudText.setText(`HP ${Math.ceil(hp)}/${Math.ceil(hpMax)} | Wave ${wave} | Bolts ${bolts}${daily}`);

    const dashEnabled = Boolean(this.runState.config.dash.enabledByDefault) || Boolean((this.runState.perks as any).dash_module);
    this.btnDash.setVisible(dashEnabled);
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
      .setStrokeStyle(2, 0x5cc8ff, 0.95)
      .setDepth(1000)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    this.btnFlip.setInteractive(new Phaser.Geom.Circle(0, 0, 44), Phaser.Geom.Circle.Contains);
    this.btnFlip.on("pointerdown", () => {
      if (this.modalActive) return;
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      inputState.flipPressed = true;
    });
    this.flipLabel = this.add
      .text(0, 0, "FLIP", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);

    this.btnDash = this.add
      .circle(0, 0, 34, 0x121a24, 0.85)
      .setStrokeStyle(2, 0x3aa4d4, 0.85)
      .setDepth(1000)
      .setScrollFactor(0) as Phaser.GameObjects.Arc;
    this.btnDash.setInteractive(new Phaser.Geom.Circle(0, 0, 34), Phaser.Geom.Circle.Contains);
    this.btnDash.on("pointerdown", () => {
      if (this.modalActive) return;
      this.enableAudio();
      this.playSfx("sfx_ui_click");
      inputState.dashPressed = true;
    });
    this.dashLabel = this.add
      .text(0, 0, "DASH", { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(1001)
      .setScrollFactor(0);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const margin = 16;

    const joyX = margin + this.joyRadius + 8;
    const joyY = height - margin - this.joyRadius - 8;
    this.joyBase.setPosition(joyX, joyY);
    this.joyKnob.setPosition(joyX, joyY);

    const flipX = width - margin - 56;
    const flipY = height - margin - 60;
    this.btnFlip.setPosition(flipX, flipY);
    this.flipLabel.setPosition(flipX, flipY);

    const dashX = width - margin - 56;
    const dashY = flipY - 78;
    this.btnDash.setPosition(dashX, dashY);
    this.dashLabel.setPosition(dashX, dashY);

    this.tutorialBox.setPosition(width / 2, margin + 62);
    this.reviveBox.setPosition(width / 2, height / 2);
    this.reviveDim.setSize(width, height);
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
    this.joyPointerId = null;
    inputState.moveX = 0;
    inputState.moveY = 0;
    this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
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
    this.tutorialActive = !(s?.tutorial?.completed || s?.tutorial?.skipped);

    const bg = this.add.rectangle(0, 0, 520, 64, 0x0f1720, 0.92).setStrokeStyle(2, 0x3aa4d4, 0.8);
    this.tutorialText = this.add
      .text(-240, -18, "", { fontSize: "14px", color: "#d9f2ff", wordWrap: { width: 430 } })
      .setOrigin(0, 0);
    const btn = this.add
      .rectangle(220, 0, 70, 34, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.8)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(220, 0, "SKIP", { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" }).setOrigin(0.5);

    btn.on("pointerdown", () => void this.skipTutorial());

    this.tutorialBox = this.add.container(0, 0, [bg, this.tutorialText, btn, btnTxt]).setDepth(1200).setScrollFactor(0);
    this.tutorialBox.setVisible(this.tutorialActive);
    this.refreshTutorialText();
  }

  private refreshTutorialText(): void {
    if (!this.tutorialActive) return;
    if (this.tutorialStep === 1) this.tutorialText.setText(`Step 1/3: Move and collect 3 scrap (${this.tutorialScrap}/3).`);
    if (this.tutorialStep === 2) this.tutorialText.setText("Step 2/3: Use FLIP to repel enemies / deflect shots.");
    if (this.tutorialStep === 3) this.tutorialText.setText("Step 3/3: Bank your tail in the Recycler Zone.");
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

  private createReviveOverlay(): void {
    this.reviveDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.72).setDepth(1400).setScrollFactor(0);
    this.revivePanel = this.add.rectangle(0, 0, 420, 190, 0x0f1720, 0.96).setStrokeStyle(2, 0x5cc8ff, 0.9);
    this.reviveTitle = this.add
      .text(0, -70, "REVIVE?", { fontSize: "26px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.reviveHint = this.add
      .text(0, -32, "Watch a rewarded ad to continue this run.", { fontSize: "14px", color: "#98b7c7", align: "center" })
      .setOrigin(0.5);

    const btnYes = this.add
      .rectangle(0, 42, 260, 54, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    const txtYes = this.add.text(0, 42, "REVIVE (Rewarded)", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" }).setOrigin(0.5);

    const btnNo = this.add
      .rectangle(0, 104, 260, 46, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const txtNo = this.add.text(0, 104, "NO THANKS", { fontSize: "14px", color: "#d9f2ff", fontStyle: "700" }).setOrigin(0.5);

    btnYes.on("pointerdown", () => void this.handleRevive(true));
    btnNo.on("pointerdown", () => this.handleRevive(false));

    this.reviveBox = this.add
      .container(0, 0, [this.reviveDim, this.revivePanel, this.reviveTitle, this.reviveHint, btnYes, txtYes, btnNo, txtNo])
      .setDepth(1400)
      .setScrollFactor(0);
    this.reviveBox.setVisible(false);
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
    const adapter = this.adapter;
    const res = adapter ? await adapter.showRewarded(AD_PLACEMENTS.REVIVE) : { ok: true, rewarded: false };
    this.reviveBusy = false;
    this.hideReviveOverlay();

    if (res.ok && (res as any).rewarded === true) this.game.events.emit(GAME_EVENTS.REVIVE_ACCEPTED, {});
    else this.game.events.emit(GAME_EVENTS.REVIVE_DECLINED, {});
  }

  private hideReviveOverlay(): void {
    this.modalActive = false;
    this.reviveBox.setVisible(false);
    this.joyPointerId = null;
    inputState.moveX = 0;
    inputState.moveY = 0;
    this.joyKnob.setPosition(this.joyBase.x, this.joyBase.y);
  }

  private onTutorialScrap(): void {
    if (!this.tutorialActive || this.tutorialStep !== 1) return;
    this.tutorialScrap += 1;
    if (this.tutorialScrap >= 3) {
      this.tutorialStep = 2;
    }
    this.refreshTutorialText();
  }

  private onTutorialFlip(): void {
    if (!this.tutorialActive || this.tutorialStep !== 2) return;
    this.tutorialStep = 3;
    this.refreshTutorialText();
  }

  private onTutorialBank(): void {
    if (!this.tutorialActive || this.tutorialStep !== 3) return;
    void this.completeTutorial();
  }

  private async completeTutorial(): Promise<void> {
    this.tutorialActive = false;
    this.tutorialBox.setVisible(false);
    if (!this.saveManager) return;
    const s = this.saveManager.get();
    await this.saveManager.save({ ...s, tutorial: { ...s.tutorial, completed: true } });
    this.registry.set("saveData", this.saveManager.get());
  }

  private async skipTutorial(): Promise<void> {
    this.tutorialActive = false;
    this.tutorialBox.setVisible(false);
    if (!this.saveManager) return;
    const s = this.saveManager.get();
    await this.saveManager.save({ ...s, tutorial: { ...s.tutorial, skipped: true } });
    this.registry.set("saveData", this.saveManager.get());
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
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
