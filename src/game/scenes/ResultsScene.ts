import Phaser from "phaser";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { AdsManager } from "../../platform/ads/adsManager";
import type {
  LeaderboardCareerMilestoneId,
  LeaderboardDivisionId,
  SaveData,
  SaveManager,
} from "../../platform/save/saveManager";
import type { RunState } from "../run/runState";
import { normalizeDailySave } from "../daily/dailyAttempts";
import { grantMetaWallet } from "../meta/metaProgression";
import {
  buildLeaderboardEntry,
  computeRunScore,
  createLeaderboardEntryId,
  filterLeaderboardEntries,
  getLeaderboardCareerMilestoneUnlocks,
  getLeaderboardCareerProgress,
  getLeaderboardBestScore,
  getLeaderboardDivision,
  getLeaderboardHigherDivision,
  getLeaderboardNextDivision,
  getNextLeaderboardCareerMilestone,
  getLeaderboardPromotionRewards,
  getLeaderboardRank,
  type LeaderboardFilter,
  upsertLeaderboardEntries,
} from "../run/leaderboard";
import { type Locale, formatNumber, formatResource, resolveLocale, t } from "../../i18n/localization";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import { signalPlatformGameplayStop } from "../../platform/platformRuntime";

export class ResultsScene extends Phaser.Scene {
  private ads!: AdsManager;
  private saveManager!: SaveManager;
  private state!: RunState;
  private platformAdapter: PlatformAdapter | null = null;
  private statsText!: Phaser.GameObjects.Text;
  private exitBusy = false;
  private x2Used = false;
  private x2Btn: Phaser.GameObjects.Rectangle | null = null;
  private x2Label: Phaser.GameObjects.Text | null = null;
  private recordRunPromise: Promise<void> | null = null;
  private grantedRewards = { bolts: 0, cores: 0 };
  private locale: Locale = "en";
  private latestLeaderboardRank: number | null = null;
  private latestLeaderboardFilter: LeaderboardFilter = "run";
  private latestLeaderboardIsRecord = false;
  private latestLeaderboardPreviousBest: number | null = null;
  private latestPromotionDivision: LeaderboardDivisionId | null = null;
  private latestPromotionReward = { bolts: 0, cores: 0 };
  private latestCareerMilestones: LeaderboardCareerMilestoneId[] = [];
  private latestCareerMilestoneReward = { bolts: 0, cores: 0 };

  constructor() {
    super("results");
  }

  create(): void {
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.state = this.registry.get("runState") as RunState;
    this.platformAdapter = (this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null;
    void signalPlatformGameplayStop(this.platformAdapter);
    const save = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    this.locale = ((this.registry.get("locale") as Locale | undefined) ?? resolveLocale(save?.settings?.language ?? "auto"));
    this.exitBusy = false;
    this.x2Used = false;
    this.recordRunPromise = null;
    this.grantedRewards = { bolts: 0, cores: 0 };
    this.x2Btn = null;
    this.x2Label = null;
    this.latestLeaderboardRank = null;
    this.latestLeaderboardFilter = this.state.mode === "daily" ? "daily" : "run";
    this.latestLeaderboardIsRecord = false;
    this.latestLeaderboardPreviousBest = null;
    this.latestPromotionDivision = null;
    this.latestPromotionReward = { bolts: 0, cores: 0 };
    this.latestCareerMilestones = [];
    this.latestCareerMilestoneReward = { bolts: 0, cores: 0 };
    this.input.enabled = true;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(2000);

    this.add
      .text(width / 2, height * 0.22, t(this.locale, "results.title"), { fontSize: "44px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.statsText = this.add
      .text(width / 2, height * 0.36, "", {
        fontSize: "18px",
        color: "#98b7c7",
        align: "center",
        wordWrap: { width: Math.min(540, width * 0.84) },
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.refreshStatsText();

    const x2Cfg = this.state.config.ads?.rewarded?.x2Results;
    if (x2Cfg?.enabled) {
      const boostedMult = this.getRewardedResultsMult();
      const btnX2 = this.add
        .rectangle(width / 2, height * 0.52, 280, 52, 0x1b2635, 0.95)
        .setStrokeStyle(2, 0x57c27d, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(2001);
      const labelX2 = this.add
        .text(btnX2.x, btnX2.y, t(this.locale, "results.boost", { mult: formatMult(boostedMult) }), {
          fontSize: "16px",
          color: "#d9f2ff",
          fontStyle: "700",
        })
        .setOrigin(0.5)
        .setDepth(2001);
      btnX2.on("pointerdown", () => void this.handleX2());
      this.x2Btn = btnX2;
      this.x2Label = labelX2;
    }

    const btnRestart = this.add
      .rectangle(width / 2, height * 0.62, 280, 64, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(2001);
    this.add
      .text(btnRestart.x, btnRestart.y, t(this.locale, "results.restart"), { fontSize: "24px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    const btnMenu = this.add
      .rectangle(width / 2, height * 0.74, 280, 52, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(2001);
    this.add
      .text(btnMenu.x, btnMenu.y, t(this.locale, "results.menu"), { fontSize: "20px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    btnRestart.on("pointerdown", () => void this.exitTo("restart"));
    btnMenu.on("pointerdown", () => void this.exitTo("menu"));

    void this.recordRunOnceAndPersistScores();
  }

  private refreshStatsText(): void {
    const save = this.saveManager?.get?.() ?? null;
    const rewardPreview = this.computeCurrentRunRewards(save);
    const currentEntry = buildLeaderboardEntry(this.state, this.getLeaderboardEntryId(), save?.settings?.pilotName);
    const score = computeRunScore(this.state);
    const division = getLeaderboardDivision(score);
    const nextDivision = getLeaderboardNextDivision(score);
    const careerProgress = getLeaderboardCareerProgress({
      bestScore: Math.max(score, save?.leaderboard?.entries?.reduce((best, entry) => Math.max(best, entry.score), 0) ?? 0),
      bestWave: Math.max(this.state.waveIndex, save?.stats?.bestWave ?? 0),
      bestBolts: Math.max(this.state.bolts, save?.stats?.bestBolts ?? 0),
      highestDivision: getLeaderboardHigherDivision(save?.leaderboard?.highestDivision ?? "scrapper", division.id),
    });
    const claimedMilestones = new Set<LeaderboardCareerMilestoneId>(save?.leaderboard?.claimedMilestones ?? []);
    for (const milestoneId of this.latestCareerMilestones) claimedMilestones.add(milestoneId);
    const nextMilestone = getNextLeaderboardCareerMilestone(careerProgress, [...claimedMilestones]);
    const leaderboardEntries = filterLeaderboardEntries(save?.leaderboard?.entries ?? [], this.latestLeaderboardFilter);
    const rank = this.latestLeaderboardRank ?? getLeaderboardRank(leaderboardEntries, this.getLeaderboardEntryId());
    const topLines = leaderboardEntries.slice(0, 3).map((entry, index) =>
      `${index + 1}. ${entry.pilot} [${entry.mode === "daily" ? t(this.locale, "leaderboard.mode.daily") : t(this.locale, "leaderboard.mode.run")} | ${t(this.locale, `leaderboard.division.${getLeaderboardDivision(entry.score).id}`)}] | ${formatNumber(this.locale, entry.score)} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, entry.wave)}`
    );
    const bestDelta =
      this.latestLeaderboardPreviousBest === null ? null : score - this.latestLeaderboardPreviousBest;
    this.statsText.setText(
      [
        `${t(this.locale, "results.pilot")}: ${currentEntry.pilot}`,
        `${t(this.locale, "results.division")}: ${t(this.locale, `leaderboard.division.${division.id}`)}`,
        `${t(this.locale, "hud.level")}: ${formatNumber(this.locale, this.state.endless.current.index)}`,
        `${t(this.locale, "hud.wave")}: ${formatNumber(this.locale, this.state.waveIndex)}`,
        `${t(this.locale, "hud.bolts")}: ${formatNumber(this.locale, this.state.bolts)}`,
        `${t(this.locale, "results.cores")}: ${formatNumber(this.locale, this.state.cores)}`,
        t(this.locale, "results.workshop", {
          bolts: formatNumber(this.locale, rewardPreview.bolts),
          cores: formatNumber(this.locale, rewardPreview.cores),
        }),
        `${t(this.locale, "results.score")}: ${formatNumber(this.locale, score)}`,
        this.latestPromotionDivision
          ? t(this.locale, "results.promotion", {
              division: t(this.locale, `leaderboard.division.${this.latestPromotionDivision}`),
              reward: formatLeaderboardReward(this.locale, this.latestPromotionReward),
            })
          : "",
        this.latestCareerMilestones.length > 0
          ? t(this.locale, "results.milestoneUnlock", {
              titles: formatCareerMilestoneTitles(this.locale, this.latestCareerMilestones),
              reward: formatLeaderboardReward(this.locale, this.latestCareerMilestoneReward),
            })
          : "",
        bestDelta === null
          ? t(this.locale, "results.bestDeltaNone")
          : t(this.locale, "results.bestDelta", {
              value: `${bestDelta >= 0 ? "+" : ""}${formatNumber(this.locale, bestDelta)}`,
            }),
        nextDivision
          ? t(this.locale, "results.nextDivision", {
              division: t(this.locale, `leaderboard.division.${nextDivision.id}`),
              score: formatNumber(this.locale, nextDivision.minScore),
            })
          : t(this.locale, "results.topDivision"),
        nextMilestone
          ? t(this.locale, "results.nextMilestone", {
              title: t(this.locale, `leaderboard.milestone.${nextMilestone.id}`),
            })
          : t(this.locale, "results.allMilestones"),
        rank ? t(this.locale, "results.rank", { rank: formatNumber(this.locale, rank) }) : "",
        this.latestLeaderboardIsRecord ? t(this.locale, "results.newRecord") : "",
        `${t(this.locale, "results.leaderboardTitle")} (${t(this.locale, `leaderboard.filter.${this.latestLeaderboardFilter}`)})`,
        ...(topLines.length > 0 ? topLines : [t(this.locale, "menu.leaderboardEmpty")]),
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  private async handleX2(): Promise<void> {
    if (this.exitBusy) return;
    if (this.x2Used) return;
    const cfg = this.state.config.ads?.rewarded?.x2Results;
    if (!cfg?.enabled) return;

    const res = await this.ads.showRewarded(AD_PLACEMENTS.X2_RESULTS);
    if (res.ok && res.rewarded) {
      const mult = this.getRewardedResultsMult();
      this.state.bolts = Math.floor(this.state.bolts * mult);
      this.x2Used = true;
      this.x2Btn?.setVisible(false);
      this.x2Label?.setVisible(false);
      this.refreshStatsText();
      await this.persistScoresOnly();
    }
  }

  private getRewardedResultsMult(): number {
    const adMult = this.state.config.ads?.rewarded?.x2Results?.mult;
    const perkMult = this.state.perks.results_bonus?.params?.baseMult;
    return positiveNum(adMult, 2) * positiveNum(perkMult, 1);
  }

  private async recordRunOnceAndPersistScores(): Promise<void> {
    if (this.recordRunPromise) return this.recordRunPromise;
    this.recordRunPromise = this.persistRunResults(true);
    return this.recordRunPromise;
  }

  private async persistRunResults(incrementRunsCompleted: boolean): Promise<void> {
    const s0 = this.saveManager.get();
    const s1 = this.state.mode === "daily" && this.state.daily?.dateUtc ? normalizeDailySave(s0, this.state.daily.dateUtc) : s0;
    const saveWithRewards = this.syncRunRewards(s1);
    const entry = buildLeaderboardEntry(this.state, this.getLeaderboardEntryId(), saveWithRewards.settings.pilotName);
    const previousFiltered = filterLeaderboardEntries(saveWithRewards.leaderboard.entries, this.latestLeaderboardFilter);
    const previousBestScore = getLeaderboardBestScore(previousFiltered, entry.id);
    const promotion = getLeaderboardPromotionRewards(
      saveWithRewards.leaderboard.highestDivision,
      entry.score,
      saveWithRewards.leaderboard.claimedRewardDivisions
    );
    const promotedDivision = promotion.divisions[promotion.divisions.length - 1] ?? null;
    const promotionReward = promotion.reward;
    const withPromotionRewards =
      promotionReward.bolts > 0 || promotionReward.cores > 0 ? grantMetaWallet(saveWithRewards, promotionReward) : saveWithRewards;
    const s = this.upsertRunLeaderboard(withPromotionRewards, entry, promotion.divisions);
    const bestWave = Math.max(s.stats.bestWave, this.state.waveIndex);
    const bestBolts = Math.max(s.stats.bestBolts, this.state.bolts);
    const bestScore = s.leaderboard.entries.reduce((best, candidate) => Math.max(best, candidate.score), 0);
    const milestoneUnlocks = getLeaderboardCareerMilestoneUnlocks(
      {
        bestScore,
        bestWave,
        bestBolts,
        highestDivision: s.leaderboard.highestDivision,
      },
      s.leaderboard.claimedMilestones
    );
    const withMilestoneRewards =
      milestoneUnlocks.reward.bolts > 0 || milestoneUnlocks.reward.cores > 0 ? grantMetaWallet(s, milestoneUnlocks.reward) : s;
    const claimedMilestones = Array.from(new Set([...withMilestoneRewards.leaderboard.claimedMilestones, ...milestoneUnlocks.ids]));
    const filteredEntries = filterLeaderboardEntries(withMilestoneRewards.leaderboard.entries, this.latestLeaderboardFilter);
    this.latestLeaderboardRank = getLeaderboardRank(filteredEntries, entry.id);
    this.latestLeaderboardPreviousBest = previousBestScore;
    this.latestLeaderboardIsRecord = Boolean(this.latestLeaderboardRank === 1 && entry.score > (previousBestScore ?? -1));
    this.latestPromotionDivision = promotedDivision;
    this.latestPromotionReward = promotionReward;
    this.latestCareerMilestones = milestoneUnlocks.ids;
    this.latestCareerMilestoneReward = milestoneUnlocks.reward;
    const runsCompleted = incrementRunsCompleted ? Math.max(0, Math.floor(s.stats.runsCompleted)) + 1 : s.stats.runsCompleted;

    let daily = withMilestoneRewards.daily;
    if (this.state.mode === "daily" && this.state.daily?.dateUtc && daily.lastDateUtc === this.state.daily.dateUtc) {
      daily = {
        ...daily,
        bestWave: Math.max(daily.bestWave, this.state.waveIndex),
        bestBolts: Math.max(daily.bestBolts, this.state.bolts),
      };
    }

    await this.saveManager.save({
      ...withMilestoneRewards,
      stats: { ...withMilestoneRewards.stats, bestWave, bestBolts, runsCompleted },
      leaderboard: {
        ...withMilestoneRewards.leaderboard,
        claimedMilestones,
      },
      daily,
    });
    this.registry.set("saveData", this.saveManager.get());
    this.registry.set("lastLeaderboardEntryId", entry.id);
    this.registry.set("lastLeaderboardFilter", this.latestLeaderboardFilter);
    this.registry.set("lastLeaderboardRank", this.latestLeaderboardRank);
    this.registry.set("lastLeaderboardIsRecord", this.latestLeaderboardIsRecord);
    this.registry.set("lastLeaderboardPromotionDivision", this.latestPromotionDivision);
    this.registry.set("lastLeaderboardPromotionBolts", promotionReward.bolts);
    this.registry.set("lastLeaderboardPromotionCores", promotionReward.cores);
    this.registry.set("lastLeaderboardCareerMilestones", this.latestCareerMilestones);
    this.registry.set("lastLeaderboardCareerMilestoneBolts", milestoneUnlocks.reward.bolts);
    this.registry.set("lastLeaderboardCareerMilestoneCores", milestoneUnlocks.reward.cores);
    this.refreshStatsText();
    const submit = this.platformAdapter?.submitScore?.(computeRunScore(this.state));
    if (submit) void submit.catch(() => {});
  }

  private async persistScoresOnly(): Promise<void> {
    await this.persistRunResults(false);
  }

  private syncRunRewards(save: SaveData): SaveData {
    const total = this.computeCurrentRunRewards(save);
    const delta = {
      bolts: Math.max(0, total.bolts - this.grantedRewards.bolts),
      cores: Math.max(0, total.cores - this.grantedRewards.cores),
    };

    this.grantedRewards = total;
    return grantMetaWallet(save, delta);
  }

  private computeCurrentRunRewards(save: SaveData | null): { bolts: number; cores: number } {
    const dailyMult = this.getDailyRewardMultiplier(save);
    return {
      bolts: Math.max(0, Math.floor(this.state.bolts * dailyMult)),
      cores: Math.max(0, Math.floor(this.state.cores)),
    };
  }

  private getDailyRewardMultiplier(save: SaveData | null): number {
    if (this.state.mode !== "daily" || !this.state.daily?.dateUtc || !save) return 1;
    if (save.daily.lastDateUtc !== this.state.daily.dateUtc) return 1;
    if (save.daily.attemptsUsed !== 1) return 1;
    return positiveNum(this.state.config.daily.dailyRewards.firstRunBonusBoltsMult, 1);
  }

  private upsertRunLeaderboard(
    save: SaveData,
    entry: ReturnType<typeof buildLeaderboardEntry>,
    promotedDivisions: readonly LeaderboardDivisionId[] = []
  ): SaveData {
    const claimed = new Set<LeaderboardDivisionId>(save.leaderboard.claimedRewardDivisions);
    for (const division of promotedDivisions) claimed.add(division);
    const previousBestScore = save.leaderboard.entries.reduce((best, candidate) => Math.max(best, candidate.score), 0);
    const highestDivision = getLeaderboardHigherDivision(save.leaderboard.highestDivision, getLeaderboardDivision(Math.max(previousBestScore, entry.score)).id);

    return {
      ...save,
      leaderboard: {
        ...save.leaderboard,
        entries: upsertLeaderboardEntries(save.leaderboard.entries, entry),
        highestDivision,
        claimedRewardDivisions: ["raider", "ace", "elite", "legend"].filter((division) => claimed.has(division as LeaderboardDivisionId)) as LeaderboardDivisionId[],
      },
    };
  }

  private getLeaderboardEntryId(): string {
    return createLeaderboardEntryId(this.state);
  }

  private async exitTo(target: "restart" | "menu"): Promise<void> {
    if (this.exitBusy) return;
    this.exitBusy = true;

    await this.recordRunOnceAndPersistScores();
    await this.ads.showInterstitial(this.state.config.ads, "results");

    if (target === "restart") {
      this.scene.stop("ui");
      this.scene.start("game", { mode: this.state.mode });
      this.scene.launch("ui");
      this.scene.stop();
      return;
    }

    this.scene.stop("ui");
    this.scene.start("menu");
    this.scene.stop();
  }
}

function positiveNum(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return n > 0 ? n : fallback;
}

function formatMult(v: number): string {
  return Number.isInteger(v) ? `${v}` : v.toFixed(2).replace(/\.?0+$/, "");
}

function formatLeaderboardReward(locale: Locale, reward: { bolts: number; cores: number }): string {
  const parts = [];
  if (reward.bolts > 0) parts.push(formatResource(locale, "bolts", reward.bolts));
  if (reward.cores > 0) parts.push(formatResource(locale, "cores", reward.cores));
  return parts.join(" | ");
}

function formatCareerMilestoneTitles(locale: Locale, ids: readonly LeaderboardCareerMilestoneId[]): string {
  return ids.map((id) => t(locale, `leaderboard.milestone.${id}`)).join(", ");
}
