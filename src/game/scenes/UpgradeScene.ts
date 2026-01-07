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

const RARITY_COLORS: Record<string, number> = {
  common: 0x7a8a93,
  uncommon: 0x57c27d,
  rare: 0x5cc8ff,
  epic: 0xbb7cff,
};

export class UpgradeScene extends Phaser.Scene {
  private ads!: AdsManager;
  private analytics: AnalyticsAdapter | null = null;
  private state!: RunState;
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super("upgrade");
  }

  create(): void {
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.analytics = (this.registry.get("analytics") as AnalyticsAdapter | undefined) ?? null;
    this.state = this.registry.get("runState") as RunState;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setScrollFactor(0).setDepth(1000);

    this.add
      .text(width / 2, height * 0.16, `UPGRADE PICK - WAVE ${this.state.waveIndex}`, {
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
      .text(reroll.x, reroll.y, "REROLL (Rewarded)", {
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
      const rarityColor = RARITY_COLORS[o.upgrade.rarity] ?? 0x7a8a93;

      const bg = this.add
        .rectangle(0, 0, w, h, 0x0f1720, 0.96)
        .setStrokeStyle(2, rarityColor, 0.9)
        .setInteractive({ useHandCursor: true });

      const title = this.add
        .text(-w / 2 + 18, -h / 2 + 14, o.upgrade.ui?.title ?? o.upgrade.name, {
          fontSize: "18px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: w - 36 },
        })
        .setOrigin(0, 0);

      const desc = this.add
        .text(-w / 2 + 18, -h / 2 + 44, o.upgrade.ui?.desc ?? "", {
          fontSize: "14px",
          color: "#98b7c7",
          wordWrap: { width: w - 36 },
        })
        .setOrigin(0, 0);

      const chip = this.add
        .text(w / 2 - 18, -h / 2 + 14, o.upgrade.rarity.toUpperCase(), {
          fontSize: "12px",
          color: "#0b0f14",
          backgroundColor: `#${rarityColor.toString(16).padStart(6, "0")}`,
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setOrigin(1, 0);

      const card = this.add.container(x, y, [bg, title, desc, chip]).setDepth(1002);
      bg.on("pointerdown", () => this.pickUpgrade(o.upgrade.id));

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
