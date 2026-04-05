import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { AdsManager } from "../../platform/ads/adsManager";
import type { RunState } from "../run/runState";
import { applyEffects } from "../effects/applyEffects";
import { GAME_EVENTS } from "../events";
import { makeUpgradeOffer } from "../upgrades/upgradeSelection";
import { updatePityAfterPick } from "../upgrades/rarity";
import { createRarityFrames, createVfxTextures } from "../../visual/TextureFactory";
import type { SaveData } from "../../platform/save/saveManager";
import { type Locale, getRarityLabel, getUpgradeCopy, resolveLocale, t } from "../../i18n/localization";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import { signalPlatformGameplayStop } from "../../platform/platformRuntime";

const RARITY_COLORS: Record<string, number> = {
  common: 0x6e7a86,
  uncommon: 0x3dff9b,
  rare: 0x2d7bff,
  epic: 0xff3ad7,
};

export class UpgradeScene extends Phaser.Scene {
  private ads!: AdsManager;
  private analytics: AnalyticsAdapter | null = null;
  private state!: RunState;
  private cards: Phaser.GameObjects.Container[] = [];
  private locale: Locale = "en";

  constructor() {
    super("upgrade");
  }

  create(): void {
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.analytics = (this.registry.get("analytics") as AnalyticsAdapter | undefined) ?? null;
    this.state = this.registry.get("runState") as RunState;
    void signalPlatformGameplayStop((this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null);
    const save = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    this.locale = ((this.registry.get("locale") as Locale | undefined) ?? resolveLocale(save?.settings?.language ?? "auto"));
    createVfxTextures(this);
    createRarityFrames(this);

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setScrollFactor(0).setDepth(1000);

    this.add
      .text(width / 2, height * 0.16, t(this.locale, "upgrade.title", { wave: this.state.waveIndex }), {
        fontSize: "24px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    const reroll = this.add
      .rectangle(width / 2, height * 0.26, 220, 44, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);
    const rerollLabel = this.add
      .text(reroll.x, reroll.y, t(this.locale, "upgrade.reroll"), {
        fontSize: "16px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    const rerollEnabled = Boolean(this.state.config.ads?.rewarded?.reroll?.enabled);
    reroll.setVisible(rerollEnabled);
    rerollLabel.setVisible(rerollEnabled);

    reroll.on("pointerdown", () => void this.handleReroll());

    this.renderOffer();
    this.game.events.emit(GAME_EVENTS.UPGRADE_OFFER_SHOWN, { waveIndex: this.state.waveIndex });

    this.scale.on("resize", () => {
      this.scene.restart();
    });
  }

  private async handleReroll(): Promise<void> {
    const res = await this.ads.showRewarded(AD_PLACEMENTS.REROLL);
    this.game.events.emit(GAME_EVENTS.UPGRADE_REROLL, { ok: res.ok, rewarded: res.ok && res.rewarded === true });
    if (res.ok && res.rewarded) {
      this.renderOffer();
    }
  }

  private renderOffer(): void {
    for (const c of this.cards) c.destroy();
    this.cards = [];

    const { width, height } = this.scale;
    const pickedCounts: Record<string, number> = {};
    for (const [id, info] of Object.entries(this.state.pickedUpgrades)) pickedCounts[id] = info.stacks;

    const offer = makeUpgradeOffer(
      { upgradeRarityRoll: this.state.config.upgradeRarityRoll },
      this.state.config.runUpgrades,
      {
        waveIndex: this.state.waveIndex,
        rarityState: { noRareOrEpicPicks: this.state.pityNoRareOrEpicPicks },
        pickedCounts,
        offerSize: this.state.config.tuning.upgrades.offerSize,
      },
      this.state.rng
    );

    this.track(ANALYTICS_EVENTS.UPGRADE_OFFER, {
      wave: this.state.waveIndex,
      offer: offer.map((o) => ({ id: o.upgrade.id, rarity: o.upgrade.rarity })),
    });

    const w = Math.min(360, width * 0.86);
    const h = 140;
    const gap = 18;
    const totalH = offer.length * h + (offer.length - 1) * gap;
    const y0 = height * 0.35;

    offer.forEach((o, idx) => {
      const x = width / 2;
      const y = y0 + idx * (h + gap) + totalH * 0.02;
      const rarityColor = RARITY_COLORS[o.upgrade.rarity] ?? 0x6e7a86;

      const glow = this.add
        .image(0, 0, "vfx_glow_blob")
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(rarityColor)
        .setAlpha(0.18)
        .setScale((w / 128) * 1.2, (h / 128) * 0.9);

      const bg = this.add
        .rectangle(0, 0, w, h, 0x0f1720, 0.96)
        .setStrokeStyle(2, rarityColor, 0.9)
        .setInteractive({ useHandCursor: true });

      const frameKey = `rarity_frame_${o.upgrade.rarity}`;
      const isNeon = o.upgrade.rarity !== "common";
      const frame = this.add
        .image(0, 0, this.textures.exists(frameKey) ? frameKey : "rarity_frame_common")
        .setDisplaySize(w, h)
        .setAlpha(isNeon ? 0.98 : 0.9);
      if (isNeon) frame.setBlendMode(Phaser.BlendModes.ADD);
      const copy = getUpgradeCopy(this.locale, o.upgrade);

      const title = this.add
        .text(-w / 2 + 18, -h / 2 + 14, copy.title, {
          fontSize: "18px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: w - 36 },
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-w / 2 + 18, -h / 2 + 44, copy.desc, {
          fontSize: "14px",
          color: "#98b7c7",
          wordWrap: { width: w - 36 },
        })
        .setOrigin(0, 0);

      const chip = this.add
        .text(w / 2 - 18, -h / 2 + 14, getRarityLabel(this.locale, o.upgrade.rarity), {
          fontSize: "12px",
          color: "#0b0f14",
          backgroundColor: `#${rarityColor.toString(16).padStart(6, "0")}`,
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setOrigin(1, 0);

      const card = this.add.container(x, y + 18, [glow, bg, frame, title, desc, chip]).setDepth(1002).setAlpha(0).setScale(0.98);
      this.tweens.add({ targets: card, y, alpha: 1, scale: 1, duration: 240, delay: idx * 70, ease: "Cubic.Out" });

      bg.on("pointerover", () => {
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1.03, duration: 90, ease: "Quad.Out" });
        glow.setAlpha(0.24);
      });

      bg.on("pointerout", () => {
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 1, duration: 120, ease: "Quad.Out" });
        glow.setAlpha(0.18);
      });

      bg.on("pointerdown", () => {
        bg.disableInteractive();
        this.tweens.killTweensOf(card);
        this.tweens.add({ targets: card, scale: 0.98, duration: 70, ease: "Quad.Out" });
        this.time.delayedCall(70, () => this.pickUpgrade(o.upgrade.id));
      });

      this.cards.push(card);
    });
  }

  private pickUpgrade(upgradeId: string): void {
    const def = this.state.config.runUpgrades.find((u) => u.id === upgradeId);
    if (!def) return;

    const prev = this.state.pickedUpgrades[def.id];
    const nextStacks = (prev?.stacks ?? 0) + 1;
    if (nextStacks > def.maxStacks) return;

    this.state.pickedUpgrades[def.id] = { stacks: nextStacks, rarity: def.rarity };

    applyEffects({
      config: this.state.config,
      perks: this.state.perks,
      heal: (amount) => {
        this.state.hp = Math.min(this.state.config.player.hpMax, this.state.hp + amount);
      },
    }, def.effects);

    const pity = { noRareOrEpicPicks: this.state.pityNoRareOrEpicPicks };
    updatePityAfterPick(pity, def.rarity);
    this.state.pityNoRareOrEpicPicks = pity.noRareOrEpicPicks;

    this.game.events.emit(GAME_EVENTS.UPGRADE_PICKED, { upgradeId: def.id, rarity: def.rarity });

    this.scene.stop("upgrade");
    this.scene.resume("game");
  }

  private track(eventName: string, payload?: Record<string, unknown>): void {
    try {
      this.analytics?.track(eventName, payload);
    } catch {
      // ignore
    }
  }
}
