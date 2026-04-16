import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { AdsManager } from "../../platform/ads/adsManager";
import type { RunState } from "../run/runState";
import { applyEffects } from "../effects/applyEffects";
import { GAME_EVENTS } from "../events";
import { getUiProgressSnapshot } from "../meta/uiProgression";
import { getUpgradeBadgeSpecs } from "../upgrades/upgradeBadges";
import { makeUpgradeOffer } from "../upgrades/upgradeSelection";
import { updatePityAfterPick } from "../upgrades/rarity";
import { createRarityFrames, createVfxTextures } from "../../visual/TextureFactory";
import type { SaveData } from "../../platform/save/saveManager";
import {
  type Locale,
  formatNumber,
  getLevelFinaleCopy,
  getLevelModifierCopy,
  getLevelObjectiveCopy,
  getRarityLabel,
  getUpgradeCopy,
  resolveLocale,
  t,
} from "../../i18n/localization";
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
  private offerTopY = 0;

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
    const uiStage = save ? getUiProgressSnapshot(save).stage : "starter";
    createVfxTextures(this);
    createRarityFrames(this);

    const { width, height } = this.scale;
    const shortLayout = height <= 560;
    const compactLayout = height <= 420;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setScrollFactor(0).setDepth(1000);

    let headerCursor = compactLayout ? 34 : shortLayout ? Math.round(height * 0.13) : Math.round(height * 0.16);
    const addHeaderLine = (text: string, style: Phaser.Types.GameObjects.Text.TextStyle, gap: number) => {
      const node = this.add.text(width / 2, headerCursor, text, style).setOrigin(0.5).setDepth(1001);
      headerCursor += node.displayHeight + gap;
      return node;
    };

    addHeaderLine(
      t(this.locale, "upgrade.title", { wave: this.state.waveIndex }),
      {
        fontSize: compactLayout ? "20px" : shortLayout ? "22px" : "24px",
        color: "#d9f2ff",
        fontStyle: "700",
        align: "center",
      },
      compactLayout ? 10 : 14
    );

    const lastCleared = this.state.endless.lastCleared;
    const pendingLevel = this.state.endless.pending;
    if (lastCleared) {
      const reward = formatUpgradeReward(this.locale, lastCleared.rewardBolts, lastCleared.rewardCores);
      const objectiveCopy = getLevelObjectiveCopy(this.locale, lastCleared.objectiveId);
      const finaleCopy = lastCleared.finaleId ? getLevelFinaleCopy(this.locale, lastCleared.finaleId) : null;
      if (compactLayout) {
        addHeaderLine(
          [
            t(this.locale, "upgrade.levelClear", { level: lastCleared.levelIndex, reward }),
            lastCleared.objectiveCompleted
              ? t(this.locale, "upgrade.objectiveDone", {
                  reward: formatUpgradeReward(this.locale, lastCleared.objectiveRewardBolts, lastCleared.objectiveRewardCores),
                })
              : t(this.locale, "upgrade.objectiveMissed"),
          ]
            .filter(Boolean)
            .join(" | "),
          {
            fontSize: "10px",
            color: lastCleared.objectiveCompleted ? "#98ffb9" : "#ffb084",
            align: "center",
            wordWrap: { width: Math.min(420, width * 0.84) },
          },
          8
        );
      } else {
        addHeaderLine(
          t(this.locale, "upgrade.levelClear", { level: lastCleared.levelIndex, reward }),
          {
            fontSize: shortLayout ? "13px" : "15px",
            color: "#7fdfff",
            fontStyle: "700",
            align: "center",
          },
          shortLayout ? 6 : 4
        );
        addHeaderLine(
          [
            t(this.locale, "upgrade.objective", { objective: objectiveCopy.title }),
            lastCleared.objectiveCompleted
              ? t(this.locale, "upgrade.objectiveDone", {
                  reward: formatUpgradeReward(this.locale, lastCleared.objectiveRewardBolts, lastCleared.objectiveRewardCores),
                })
              : t(this.locale, "upgrade.objectiveMissed"),
            finaleCopy ? t(this.locale, "upgrade.finale", { finale: finaleCopy.title }) : "",
          ]
            .filter(Boolean)
            .join(" | "),
          {
            fontSize: shortLayout ? "10px" : "12px",
            color: lastCleared.objectiveCompleted ? "#98ffb9" : "#ffb084",
            align: "center",
            wordWrap: { width: Math.min(420, width * 0.84) },
          },
          shortLayout ? 8 : 10
        );
      }
    }

    if (pendingLevel) {
      const modifierCopy = getLevelModifierCopy(this.locale, pendingLevel.modifierId);
      const objectiveCopy = getLevelObjectiveCopy(this.locale, pendingLevel.objective.id);
      const finaleCopy = pendingLevel.finaleId ? getLevelFinaleCopy(this.locale, pendingLevel.finaleId) : null;
      addHeaderLine(
        t(this.locale, "upgrade.nextLevel", { level: pendingLevel.index, modifier: modifierCopy.title }),
        {
          fontSize: compactLayout ? "11px" : shortLayout ? "12px" : "14px",
          color: "#98b7c7",
          align: "center",
          wordWrap: { width: Math.min(460, width * 0.84) },
        },
        compactLayout ? 6 : 8
      );
      if (!compactLayout) {
        addHeaderLine(
          [
            t(this.locale, "upgrade.objective", { objective: `${objectiveCopy.title} ${formatNumber(this.locale, pendingLevel.objective.target)}` }),
            finaleCopy ? t(this.locale, "upgrade.finale", { finale: finaleCopy.title }) : "",
          ]
            .filter(Boolean)
            .join(" | "),
          {
            fontSize: shortLayout ? "10px" : "12px",
            color: "#7fdfff",
            align: "center",
            wordWrap: { width: Math.min(420, width * 0.82) },
          },
          shortLayout ? 10 : 12
        );
      }
    }

    const rerollEnabled = uiStage !== "starter" && Boolean(this.state.config.ads?.rewarded?.reroll?.enabled);
    const rerollHeight = compactLayout ? 36 : shortLayout ? 40 : 44;
    const rerollWidth = compactLayout ? 196 : shortLayout ? 208 : 220;
    const rerollY = rerollEnabled ? headerCursor + (compactLayout ? 18 : shortLayout ? 20 : 22) : headerCursor;
    const reroll = this.add
      .rectangle(width / 2, rerollY, rerollWidth, rerollHeight, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);
    const rerollLabel = this.add
      .text(reroll.x, reroll.y, t(this.locale, "upgrade.reroll"), {
        fontSize: compactLayout ? "13px" : shortLayout ? "14px" : "16px",
        color: "#d9f2ff",
        fontStyle: "700",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    reroll.setVisible(rerollEnabled);
    rerollLabel.setVisible(rerollEnabled);
    if (rerollEnabled) {
      rerollLabel.setWordWrapWidth(rerollWidth - 24, true);
    }

    reroll.on("pointerdown", () => void this.handleReroll());
    this.offerTopY = (rerollEnabled ? reroll.y + reroll.height / 2 : headerCursor) + (compactLayout ? 10 : shortLayout ? 12 : 16);

    this.renderOffer();
    this.game.events.emit(GAME_EVENTS.UPGRADE_OFFER_SHOWN, { waveIndex: this.state.waveIndex });

    const onResize = () => {
      this.scene.restart();
    };
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
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
    const shortLayout = height <= 560;
    const compactLayout = height <= 420;
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

    const w = Math.min(compactLayout ? 332 : shortLayout ? 348 : 360, width * 0.88);
    const gap = compactLayout ? 8 : shortLayout ? 12 : 18;
    const availableHeight = Math.max(offer.length * 72 + (offer.length - 1) * gap, height - 16 - this.offerTopY);
    const h = Math.min(shortLayout ? 124 : 154, Math.max(compactLayout ? 72 : 96, (availableHeight - (offer.length - 1) * gap) / offer.length));
    const entryStartY = this.offerTopY + h / 2;

    offer.forEach((o, idx) => {
      const x = width / 2;
      const y = entryStartY + idx * (h + gap);
      const rarityColor = RARITY_COLORS[o.upgrade.rarity] ?? 0x6e7a86;
      const copy = getUpgradeCopy(this.locale, o.upgrade);
      const compactCard = h <= 84;
      const titleFontSize = compactCard ? 14 : h <= 110 ? 16 : 18;
      const descFontSize = compactCard ? 10 : h <= 110 ? 11 : 14;
      const badgeFontSize = compactCard ? 8 : 10;
      const titleWrapWidth = compactCard ? w - 110 : w - 132;
      const descText = compactCard ? shortenText(copy.desc, 72) : shortenText(copy.desc, h <= 110 ? 120 : 220);
      const badgeLimit = compactCard ? 2 : h <= 110 ? 3 : Number.POSITIVE_INFINITY;

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

      const title = this.add
        .text(-w / 2 + 18, -h / 2 + 14, copy.title, {
          fontSize: `${titleFontSize}px`,
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: titleWrapWidth },
        })
        .setOrigin(0, 0);

      let badgeCursorX = -w / 2 + 18;
      const badgeNodes = getUpgradeBadgeSpecs(this.locale, o.upgrade).slice(0, badgeLimit).map((badge) => {
        const label = this.add
          .text(0, 0, badge.label, {
            fontSize: `${badgeFontSize}px`,
            color: badge.textColor,
            fontStyle: "700",
          })
          .setOrigin(0.5);
        const badgeWidth = label.width + 16;
        const bgRect = this.add
          .rectangle(0, 0, badgeWidth, 22, badge.fill, 0.96)
          .setStrokeStyle(1, badge.stroke, 0.92);
        const node = this.add.container(badgeCursorX + badgeWidth / 2, -h / 2 + (compactCard ? 40 : 52), [bgRect, label]);
        badgeCursorX += badgeWidth + 8;
        return node;
      });

      const desc = this.add
        .text(-w / 2 + 18, -h / 2 + (compactCard ? 50 : 72), descText, {
          fontSize: `${descFontSize}px`,
          color: "#98b7c7",
          wordWrap: { width: w - 36 },
        })
        .setOrigin(0, 0);

      const chip = this.add
        .text(w / 2 - 18, -h / 2 + 14, getRarityLabel(this.locale, o.upgrade.rarity), {
          fontSize: compactCard ? "10px" : "12px",
          color: "#0b0f14",
          backgroundColor: `#${rarityColor.toString(16).padStart(6, "0")}`,
          padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
        .setOrigin(1, 0);

      const card = this.add
        .container(x, y + Math.min(18, h * 0.18), [glow, bg, frame, title, ...badgeNodes, desc, chip])
        .setDepth(1002)
        .setAlpha(0)
        .setScale(0.98);
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
    this.state.metrics.upgradesPicked += 1;

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

function formatUpgradeReward(locale: Locale, bolts: number, cores: number): string {
  const parts = [`+${formatNumber(locale, bolts)} ${t(locale, "hud.bolts")}`];
  if (cores > 0) parts.push(`+${formatNumber(locale, cores)} ${t(locale, "results.cores")}`);
  return parts.join(" | ");
}

function shortenText(value: string, maxLength: number): string {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, Math.max(0, maxLength - 3));
  const safe = clipped.includes(" ") ? clipped.slice(0, clipped.lastIndexOf(" ")) : clipped;
  return `${safe.trim()}...`;
}
