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
    const ultraCompactLayout = height <= 340;
    const desktopScale = shortLayout ? 1 : getResponsiveUpgradeScale(width, height, 1280, 800, 0.8);
    const insetScale = shortLayout ? 1 : desktopScale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72).setScrollFactor(0).setDepth(1000);

    let headerCursor = ultraCompactLayout
      ? 22
      : compactLayout
        ? 28
        : shortLayout
          ? Math.round(height * 0.13)
          : Math.round(height * 0.16 * insetScale);
    const addHeaderLine = (text: string, style: Phaser.Types.GameObjects.Text.TextStyle, gap: number) => {
      const node = this.add.text(width / 2, headerCursor, text, style).setOrigin(0.5).setDepth(1001);
      headerCursor += node.displayHeight + gap;
      return node;
    };

    addHeaderLine(
      t(this.locale, "upgrade.title", { wave: this.state.waveIndex }),
      {
        fontSize: `${Math.round((ultraCompactLayout ? 17 : compactLayout ? 18 : shortLayout ? 22 : 24) * desktopScale)}px`,
        color: "#d9f2ff",
        fontStyle: "700",
        align: "center",
      },
      Math.round((ultraCompactLayout ? 6 : compactLayout ? 8 : 14) * insetScale)
    );

    const lastCleared = this.state.endless.lastCleared;
    const pendingLevel = this.state.endless.pending;
    if (lastCleared) {
      const reward = formatUpgradeReward(this.locale, lastCleared.rewardBolts, lastCleared.rewardCores);
      const objectiveCopy = getLevelObjectiveCopy(this.locale, lastCleared.objectiveId);
      const finaleCopy = lastCleared.finaleId ? getLevelFinaleCopy(this.locale, lastCleared.finaleId) : null;
      if (ultraCompactLayout) {
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
            fontSize: "11px",
            color: lastCleared.objectiveCompleted ? "#98ffb9" : "#ffb084",
            align: "center",
            wordWrap: { width: Math.min(Math.round(420 * desktopScale), width * 0.82) },
          },
          6
        );
      } else if (compactLayout) {
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
            fontSize: "12px",
            color: lastCleared.objectiveCompleted ? "#98ffb9" : "#ffb084",
            align: "center",
            wordWrap: { width: Math.min(Math.round(420 * desktopScale), width * 0.84) },
          },
          6
        );
      } else {
        addHeaderLine(
          t(this.locale, "upgrade.levelClear", { level: lastCleared.levelIndex, reward }),
          {
            fontSize: `${Math.round((shortLayout ? 14 : 15) * desktopScale)}px`,
            color: "#7fdfff",
            fontStyle: "700",
            align: "center",
          },
          Math.round((shortLayout ? 6 : 4) * insetScale)
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
            fontSize: `${Math.round((shortLayout ? 12 : 13) * desktopScale)}px`,
            color: lastCleared.objectiveCompleted ? "#98ffb9" : "#ffb084",
            align: "center",
            wordWrap: { width: Math.min(Math.round(420 * desktopScale), width * 0.84) },
          },
          Math.round((shortLayout ? 8 : 10) * insetScale)
        );
      }
    }

    if (pendingLevel) {
      const modifierCopy = getLevelModifierCopy(this.locale, pendingLevel.modifierId);
      const objectiveCopy = getLevelObjectiveCopy(this.locale, pendingLevel.objective.id);
      const finaleCopy = pendingLevel.finaleId ? getLevelFinaleCopy(this.locale, pendingLevel.finaleId) : null;
      if (ultraCompactLayout) {
        if (!lastCleared) {
          addHeaderLine(
            t(this.locale, "upgrade.nextLevel", { level: pendingLevel.index, modifier: modifierCopy.title }),
            {
              fontSize: "11px",
              color: "#98b7c7",
              align: "center",
              wordWrap: { width: Math.min(Math.round(420 * desktopScale), width * 0.8) },
            },
            6
          );
        }
      } else {
        addHeaderLine(
          t(this.locale, "upgrade.nextLevel", { level: pendingLevel.index, modifier: modifierCopy.title }),
          {
            fontSize: `${Math.round((compactLayout ? 12 : shortLayout ? 14 : 15) * desktopScale)}px`,
            color: "#98b7c7",
            align: "center",
            wordWrap: { width: Math.min(Math.round(460 * desktopScale), width * 0.84) },
          },
          Math.round((compactLayout ? 4 : 8) * insetScale)
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
              fontSize: `${Math.round((shortLayout ? 12 : 13) * desktopScale)}px`,
              color: "#7fdfff",
              align: "center",
              wordWrap: { width: Math.min(Math.round(420 * desktopScale), width * 0.82) },
            },
            Math.round((shortLayout ? 10 : 12) * insetScale)
          );
        }
      }
    }

    const rerollEnabled = uiStage !== "starter" && Boolean(this.state.config.ads?.rewarded?.reroll?.enabled);
    const rerollHeight = Math.round((ultraCompactLayout ? 30 : compactLayout ? 34 : shortLayout ? 44 : 48) * desktopScale);
    const rerollWidth = Math.round((ultraCompactLayout ? 188 : compactLayout ? 208 : shortLayout ? 232 : 244) * desktopScale);
    const rerollY = rerollEnabled
      ? headerCursor + Math.round((ultraCompactLayout ? 10 : compactLayout ? 12 : shortLayout ? 20 : 22) * insetScale)
      : headerCursor;
    const reroll = this.add
      .rectangle(width / 2, rerollY, rerollWidth, rerollHeight, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(1001);
    const rerollLabel = this.add
      .text(reroll.x, reroll.y, t(this.locale, "upgrade.reroll"), {
        fontSize: `${Math.round((ultraCompactLayout ? 12 : compactLayout ? 13 : shortLayout ? 15 : 16) * desktopScale)}px`,
        color: "#d9f2ff",
        fontStyle: "700",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    reroll.setVisible(rerollEnabled);
    rerollLabel.setVisible(rerollEnabled);
    if (rerollEnabled) {
      rerollLabel.setWordWrapWidth(rerollWidth - Math.round(24 * insetScale), true);
    }

    reroll.on("pointerdown", () => void this.handleReroll());
    this.offerTopY =
      (rerollEnabled ? reroll.y + reroll.height / 2 : headerCursor) +
      Math.round((ultraCompactLayout ? 8 : compactLayout ? 6 : shortLayout ? 12 : 16) * insetScale);

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
    const ultraCompactLayout = height <= 340;
    const desktopScale = shortLayout ? 1 : getResponsiveUpgradeScale(width, height, 1280, 800, 0.8);
    const insetScale = shortLayout ? 1 : desktopScale;
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

    const w = Math.min(Math.round((ultraCompactLayout ? 330 : compactLayout ? 336 : shortLayout ? 352 : 364) * desktopScale), width * 0.88);
    const gap = Math.round((ultraCompactLayout ? 4 : compactLayout ? 4 : shortLayout ? 10 : 16) * insetScale);
    const availableHeight = Math.max(
      Math.round((ultraCompactLayout ? 84 : compactLayout ? 96 : 120) * insetScale),
      height - Math.round((ultraCompactLayout ? 10 : compactLayout ? 10 : 16) * insetScale) - this.offerTopY
    );
    const h = Math.min(
      Math.round((ultraCompactLayout ? 72 : compactLayout ? 102 : shortLayout ? 128 : 156) * desktopScale),
      Math.max(
        Math.round((ultraCompactLayout ? 48 : compactLayout ? 56 : 96) * desktopScale),
        (availableHeight - (offer.length - 1) * gap) / offer.length
      )
    );
    const stackHeight = offer.length * h + (offer.length - 1) * gap;
    const entryStartY = this.offerTopY + h / 2 + Math.max(0, (availableHeight - stackHeight) / 2);

    offer.forEach((o, idx) => {
      const x = width / 2;
      const y = entryStartY + idx * (h + gap);
      const rarityColor = RARITY_COLORS[o.upgrade.rarity] ?? 0x6e7a86;
      const copy = getUpgradeCopy(this.locale, o.upgrade);
      const compactCard = ultraCompactLayout || h <= 88;
      const titleFontSize = Math.round((ultraCompactLayout ? 13 : compactCard ? 15 : h <= 110 ? 16 : 18) * desktopScale);
      const descFontSize = Math.round((ultraCompactLayout ? 10 : compactCard ? 12 : h <= 110 ? 13 : 14) * desktopScale);
      const badgeFontSize = Math.round((ultraCompactLayout ? 9 : compactCard ? 10 : 11) * desktopScale);
      const titleWrapWidth = ultraCompactLayout ? w - Math.round(112 * insetScale) : compactCard ? w - Math.round(116 * insetScale) : w - Math.round(132 * insetScale);
      const descText = ultraCompactLayout
        ? shortenText(copy.desc, Math.round(42 * desktopScale))
        : compactCard
          ? shortenText(copy.desc, Math.round(54 * desktopScale))
          : shortenText(copy.desc, Math.round((h <= 110 ? 108 : 220) * desktopScale));
      const badgeLimit = ultraCompactLayout ? 1 : compactCard ? 1 : h <= 110 ? 2 : Number.POSITIVE_INFINITY;

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
        .text(-w / 2 + Math.round(18 * insetScale), -h / 2 + Math.round(14 * insetScale), copy.title, {
          fontSize: `${titleFontSize}px`,
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: titleWrapWidth },
        })
        .setOrigin(0, 0);

      let badgeCursorX = -w / 2 + Math.round(18 * insetScale);
      const badgeNodes = getUpgradeBadgeSpecs(this.locale, o.upgrade).slice(0, badgeLimit).map((badge) => {
        const label = this.add
          .text(0, 0, badge.label, {
            fontSize: `${badgeFontSize}px`,
            color: badge.textColor,
            fontStyle: "700",
          })
          .setOrigin(0.5);
        const badgeWidth = label.width + Math.round(16 * insetScale);
        const bgRect = this.add
          .rectangle(0, 0, badgeWidth, Math.round(22 * desktopScale), badge.fill, 0.96)
          .setStrokeStyle(1, badge.stroke, 0.92);
        const node = this.add.container(
          badgeCursorX + badgeWidth / 2,
          -h / 2 + Math.round((ultraCompactLayout ? 34 : compactCard ? 40 : 52) * insetScale),
          [bgRect, label]
        );
        badgeCursorX += badgeWidth + Math.round(8 * insetScale);
        return node;
      });

      const desc = this.add
        .text(-w / 2 + Math.round(18 * insetScale), -h / 2 + Math.round((ultraCompactLayout ? 42 : compactCard ? 50 : 72) * insetScale), descText, {
          fontSize: `${descFontSize}px`,
          color: "#98b7c7",
          wordWrap: { width: w - Math.round(36 * insetScale) },
        })
        .setOrigin(0, 0);

      const chip = this.add
        .text(w / 2 - Math.round(18 * insetScale), -h / 2 + Math.round(14 * insetScale), getRarityLabel(this.locale, o.upgrade.rarity), {
          fontSize: `${Math.round((ultraCompactLayout ? 10 : compactCard ? 11 : 12) * desktopScale)}px`,
          color: "#0b0f14",
          backgroundColor: `#${rarityColor.toString(16).padStart(6, "0")}`,
          padding: ultraCompactLayout
            ? {
                left: Math.round(7 * insetScale),
                right: Math.round(7 * insetScale),
                top: Math.round(3 * insetScale),
                bottom: Math.round(3 * insetScale),
              }
            : {
                left: Math.round(8 * insetScale),
                right: Math.round(8 * insetScale),
                top: Math.round(4 * insetScale),
                bottom: Math.round(4 * insetScale),
              },
        })
        .setOrigin(1, 0);

      const card = this.add
        .container(x, y + Math.min(Math.round(18 * insetScale), h * 0.18), [glow, bg, frame, title, ...badgeNodes, desc, chip])
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

function getResponsiveUpgradeScale(
  width: number,
  height: number,
  baseWidth: number,
  baseHeight: number,
  factor: number,
  maxScale = Number.POSITIVE_INFINITY
): number {
  const ratio = Math.min(width / baseWidth, height / baseHeight);
  if (!Number.isFinite(ratio) || ratio <= 1) return 1;
  const scale = 1 + (ratio - 1) * factor;
  return Number.isFinite(maxScale) ? Phaser.Math.Clamp(scale, 1, maxScale) : Math.max(1, scale);
}
