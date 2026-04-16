import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
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
import { getUtcYyyymmdd } from "../daily/daily";
import { applyRunSummaryToLiveops, getBoardId, getWeekKey, upsertWeeklyLeaderboardEntry } from "../liveops/liveops";
import { getUiProgressSnapshot } from "../meta/uiProgression";
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
import { getPlatformNowMs, signalPlatformGameplayStop } from "../../platform/platformRuntime";

export class ResultsScene extends Phaser.Scene {
  private ads!: AdsManager;
  private saveManager!: SaveManager;
  private state!: RunState;
  private analytics: AnalyticsAdapter | null = null;
  private platformAdapter: PlatformAdapter | null = null;
  private resultsPanel!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private summaryPanel!: Phaser.GameObjects.Rectangle;
  private progressPanel!: Phaser.GameObjects.Rectangle;
  private leaderboardPanel!: Phaser.GameObjects.Rectangle;
  private summaryText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private leaderboardText!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Rectangle;
  private restartLabel!: Phaser.GameObjects.Text;
  private menuBtn!: Phaser.GameObjects.Rectangle;
  private menuLabel!: Phaser.GameObjects.Text;
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
  private latestWeeklyRank: number | null = null;
  private latestWeeklyRankDelta: number | null = null;
  private latestWeeklyBoardDebut = false;

  constructor() {
    super("results");
  }

  create(): void {
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.state = this.registry.get("runState") as RunState;
    this.analytics = (this.registry.get("analytics") as AnalyticsAdapter | undefined) ?? null;
    this.platformAdapter = (this.registry.get("platformAdapter") as PlatformAdapter | undefined) ?? null;
    void signalPlatformGameplayStop(this.platformAdapter);
    const save = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    this.locale = ((this.registry.get("locale") as Locale | undefined) ?? resolveLocale(save?.settings?.language ?? "auto"));
    const uiStage = save ? getUiProgressSnapshot(save).stage : "starter";
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
    this.latestWeeklyRank = null;
    this.latestWeeklyRankDelta = null;
    this.latestWeeklyBoardDebut = false;
    this.input.enabled = true;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(2000);
    this.resultsPanel = this.add
      .rectangle(width / 2, height / 2, Math.min(720, width - 28), Math.min(820, height - 28), 0x08111a, 0.9)
      .setStrokeStyle(2, 0x3aa4d4, 0.58)
      .setDepth(2000.5);

    this.titleText = this.add
      .text(width / 2, 0, t(this.locale, "results.title"), { fontSize: "44px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.summaryPanel = this.add
      .rectangle(width / 2, 0, 0, 0, 0x10202c, 0.96)
      .setStrokeStyle(2, 0x57c27d, 0.72)
      .setDepth(2000.8);
    this.progressPanel = this.add
      .rectangle(width / 2, 0, 0, 0, 0x0e1822, 0.96)
      .setStrokeStyle(2, 0x3aa4d4, 0.72)
      .setDepth(2000.8);
    this.leaderboardPanel = this.add
      .rectangle(width / 2, 0, 0, 0, 0x111923, 0.96)
      .setStrokeStyle(2, 0xffd166, 0.72)
      .setDepth(2000.8);

    this.summaryText = this.add
      .text(0, 0, "", {
        fontSize: "16px",
        color: "#d9f2ff",
        align: "left",
        wordWrap: { width: Math.min(540, width * 0.84) },
      })
      .setOrigin(0, 0)
      .setDepth(2001);
    this.progressText = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#a9d7ee",
        align: "left",
        wordWrap: { width: Math.min(540, width * 0.84) },
      })
      .setOrigin(0, 0)
      .setLineSpacing(4)
      .setDepth(2001);
    this.leaderboardText = this.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#d9f2ff",
        align: "left",
        wordWrap: { width: Math.min(540, width * 0.84) },
      })
      .setOrigin(0, 0)
      .setLineSpacing(4)
      .setDepth(2001);

    const x2Cfg = uiStage === "starter" ? undefined : this.state.config.ads?.rewarded?.x2Results;
    if (x2Cfg?.enabled) {
      this.analytics?.track(ANALYTICS_EVENTS.X2_RESULTS_OFFER, {
        mode: this.state.mode,
        score: computeRunScore(this.state),
        wave: this.state.waveIndex,
      });
      const boostedMult = this.getRewardedResultsMult();
      const btnX2 = this.add
        .rectangle(width / 2, 0, 280, 52, 0x1b2635, 0.95)
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

    this.restartBtn = this.add
      .rectangle(width / 2, 0, 280, 64, 0x1b2635, 0.95)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(2001);
    this.restartLabel = this.add
      .text(this.restartBtn.x, this.restartBtn.y, t(this.locale, "results.restart"), { fontSize: "24px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.menuBtn = this.add
      .rectangle(width / 2, 0, 280, 52, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(2001);
    this.menuLabel = this.add
      .text(this.menuBtn.x, this.menuBtn.y, t(this.locale, "results.menu"), { fontSize: "20px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.restartBtn.on("pointerdown", () => void this.exitTo("restart"));
    this.menuBtn.on("pointerdown", () => void this.exitTo("menu"));

    const onResize = () => this.layoutResults();
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
    });

    this.refreshStatsText();
    void this.recordRunOnceAndPersistScores();
  }

  private refreshStatsText(): void {
    const save = this.saveManager?.get?.() ?? null;
    const rewardPreview = this.computeCurrentRunRewards(save);
    const currentEntry = buildLeaderboardEntry(this.state, this.getLeaderboardEntryId(), save?.settings?.pilotName);
    const score = computeRunScore(this.state);
    const compactLayout = this.scale.height <= 430 || this.scale.width <= 720;
    const ultraCompactLayout = this.scale.height <= 380 || this.scale.width <= 680;
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
    const topLines = leaderboardEntries.slice(0, ultraCompactLayout ? 1 : compactLayout ? 1 : 3).map((entry, index) =>
      `${index + 1}. ${entry.pilot} [${entry.mode === "daily" ? t(this.locale, "leaderboard.mode.daily") : t(this.locale, "leaderboard.mode.run")} | ${t(this.locale, `leaderboard.division.${getLeaderboardDivision(entry.score).id}`)}] | ${formatNumber(this.locale, entry.score)} | ${t(this.locale, "hud.wave")} ${formatNumber(this.locale, entry.wave)}`
    );
    const bestDelta =
      this.latestLeaderboardPreviousBest === null ? null : score - this.latestLeaderboardPreviousBest;
    const summaryLines = compactLayout
      ? [
          `${t(this.locale, "results.pilot")}: ${currentEntry.pilot} | ${t(this.locale, "results.division")}: ${t(this.locale, `leaderboard.division.${division.id}`)}`,
          `${t(this.locale, "hud.level")}: ${formatNumber(this.locale, this.state.endless.current.index)} | ${t(this.locale, "hud.wave")}: ${formatNumber(this.locale, this.state.waveIndex)} | ${t(this.locale, "results.score")}: ${formatNumber(this.locale, score)} | ${t(this.locale, "results.workshop", {
            bolts: formatNumber(this.locale, rewardPreview.bolts),
            cores: formatNumber(this.locale, rewardPreview.cores),
          })}`,
        ]
      : [
          `${t(this.locale, "results.pilot")}: ${currentEntry.pilot} | ${t(this.locale, "results.division")}: ${t(this.locale, `leaderboard.division.${division.id}`)}`,
          `${t(this.locale, "hud.level")}: ${formatNumber(this.locale, this.state.endless.current.index)} | ${t(this.locale, "hud.wave")}: ${formatNumber(this.locale, this.state.waveIndex)}`,
          `${t(this.locale, "hud.bolts")}: ${formatNumber(this.locale, this.state.bolts)} | ${t(this.locale, "results.cores")}: ${formatNumber(this.locale, this.state.cores)} | ${t(this.locale, "results.score")}: ${formatNumber(this.locale, score)}`,
          t(this.locale, "results.workshop", {
            bolts: formatNumber(this.locale, rewardPreview.bolts),
            cores: formatNumber(this.locale, rewardPreview.cores),
          }),
        ];
    const progressLines = [
      rank ? t(this.locale, "results.rank", { rank: formatNumber(this.locale, rank) }) : "",
      this.latestLeaderboardIsRecord ? t(this.locale, "results.newRecord") : "",
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
      this.latestWeeklyRank
        ? t(this.locale, "results.weeklyBoard", {
            rank: formatNumber(this.locale, this.latestWeeklyRank),
            division: t(this.locale, `leaderboard.division.${division.id}`),
          })
        : "",
      this.latestWeeklyBoardDebut
        ? t(this.locale, "results.weeklyDeltaNew")
        : this.latestWeeklyRankDelta && this.latestWeeklyRankDelta > 0
          ? t(this.locale, "results.weeklyDeltaUp", { value: formatNumber(this.locale, this.latestWeeklyRankDelta) })
          : this.latestWeeklyRankDelta && this.latestWeeklyRankDelta < 0
            ? t(this.locale, "results.weeklyDeltaDown", { value: formatNumber(this.locale, Math.abs(this.latestWeeklyRankDelta)) })
            : "",
    ].filter(Boolean);
    this.summaryText.setText(summaryLines.join("\n"));
    this.progressText.setText(progressLines.slice(0, ultraCompactLayout ? 2 : compactLayout ? 2 : progressLines.length).join("\n"));
    this.leaderboardText.setText(
      [
        `${t(this.locale, "results.leaderboardTitle")} (${t(this.locale, `leaderboard.filter.${this.latestLeaderboardFilter}`)})`,
        ...(topLines.length > 0 ? topLines : [t(this.locale, "menu.leaderboardEmpty")]),
      ].join("\n")
    );
    this.layoutResults();
  }

  private layoutResults(): void {
    if (!this.resultsPanel || !this.titleText || !this.summaryText || !this.progressText || !this.leaderboardText || !this.restartBtn || !this.menuBtn) return;
    const { width, height } = this.scale;
    const compactLayout = height <= 520 || width <= 720;
    const ultraCompactLayout = height <= 430 || width <= 680;
    const panelWidth = Math.min(720, width - (ultraCompactLayout ? 16 : 28));
    const panelHeight = Math.min(820, height - (ultraCompactLayout ? 16 : 28));
    const panelTop = height / 2 - panelHeight / 2;
    const panelBottom = panelTop + panelHeight;
    const contentWidth = panelWidth - 56;
    const titleFont = ultraCompactLayout ? 28 : compactLayout ? 32 : height < 680 ? 34 : height < 760 ? 38 : 44;
    const x2Visible = Boolean(this.x2Btn?.visible && this.x2Label?.visible);
    const x2Height = x2Visible ? (ultraCompactLayout ? 32 : compactLayout ? 40 : height < 700 ? 46 : 52) : 0;
    const restartHeight = ultraCompactLayout ? 38 : compactLayout ? 48 : height < 700 ? 56 : 64;
    const menuHeight = ultraCompactLayout ? 32 : compactLayout ? 40 : height < 700 ? 46 : 52;
    const buttonGap = ultraCompactLayout ? 6 : compactLayout ? 10 : height < 700 ? 14 : 20;
    const sectionGap = ultraCompactLayout ? 4 : compactLayout ? 8 : height < 700 ? 10 : 14;
    const titleGap = ultraCompactLayout ? 6 : compactLayout ? 10 : height < 700 ? 14 : 18;
    const reservedButtonsHeight = (x2Visible ? x2Height + buttonGap : 0) + restartHeight + buttonGap + menuHeight;

    this.resultsPanel.setPosition(width / 2, height / 2).setSize(panelWidth, panelHeight);
    this.titleText.setStyle({ fontSize: `${titleFont}px` }).setPosition(width / 2, panelTop + (ultraCompactLayout ? 30 : 42));
    const contentLeft = width / 2 - panelWidth / 2 + 28;
    const textLeft = contentLeft + 16;
    const textWrapWidth = Math.max(240, contentWidth - 32);
    const sectionsTop = this.titleText.y + this.titleText.displayHeight / 2 + titleGap;
    const availableSectionHeight = Math.max(140, panelBottom - 20 - reservedButtonsHeight - sectionGap - sectionsTop);
    const fontPresets = ultraCompactLayout
      ? [
          { summary: 12, progress: 9, leaderboard: 9 },
          { summary: 11, progress: 8, leaderboard: 8 },
          { summary: 10, progress: 8, leaderboard: 8 },
        ]
      : compactLayout
        ? [
            { summary: 13, progress: 10, leaderboard: 10 },
            { summary: 12, progress: 9, leaderboard: 9 },
            { summary: 11, progress: 8, leaderboard: 8 },
          ]
        : [
            { summary: 16, progress: 13, leaderboard: 13 },
            { summary: 15, progress: 12, leaderboard: 12 },
            { summary: 14, progress: 11, leaderboard: 11 },
          ];
    let summaryHeight = 0;
    let progressHeight = 0;
    let leaderboardHeight = 0;

    for (const preset of fontPresets) {
      this.summaryText.setStyle({ fontSize: `${preset.summary}px`, wordWrap: { width: textWrapWidth }, align: "left" });
      this.summaryText.setLineSpacing(preset.summary >= 16 ? 4 : 3);
      this.progressText.setStyle({ fontSize: `${preset.progress}px`, wordWrap: { width: textWrapWidth }, align: "left" });
      this.progressText.setLineSpacing(preset.progress <= 11 ? 3 : 4);
      this.leaderboardText.setStyle({ fontSize: `${preset.leaderboard}px`, wordWrap: { width: textWrapWidth }, align: "left" });
      this.leaderboardText.setLineSpacing(preset.leaderboard <= 11 ? 3 : 4);

      summaryHeight = this.summaryText.height + (ultraCompactLayout ? 10 : compactLayout ? 18 : 28);
      progressHeight = this.progressText.height + (ultraCompactLayout ? 10 : compactLayout ? 18 : 24);
      leaderboardHeight = this.leaderboardText.height + (ultraCompactLayout ? 10 : compactLayout ? 18 : 24);
      const totalHeight = summaryHeight + progressHeight + leaderboardHeight + sectionGap * 2;
      if (totalHeight <= availableSectionHeight || preset === fontPresets[fontPresets.length - 1]) break;
    }

    let cursorTop = sectionsTop;
    this.summaryPanel.setPosition(width / 2, cursorTop + summaryHeight / 2).setSize(contentWidth, summaryHeight);
    this.summaryText.setPosition(textLeft, cursorTop + 14);
    cursorTop += summaryHeight + sectionGap;

    this.progressPanel.setPosition(width / 2, cursorTop + progressHeight / 2).setSize(contentWidth, progressHeight);
    this.progressText.setPosition(textLeft, cursorTop + 12);
    cursorTop += progressHeight + sectionGap;

    this.leaderboardPanel.setPosition(width / 2, cursorTop + leaderboardHeight / 2).setSize(contentWidth, leaderboardHeight);
    this.leaderboardText.setPosition(textLeft, cursorTop + 12);

    const statsBottom = cursorTop + leaderboardHeight;
    const buttonWidth = Math.min(320, panelWidth - (ultraCompactLayout ? 56 : 140));
    let nextTop = Math.max(statsBottom + sectionGap, panelBottom - 24 - reservedButtonsHeight);

    if (x2Visible && this.x2Btn && this.x2Label) {
      this.x2Btn.setSize(buttonWidth, x2Height).setPosition(width / 2, nextTop + x2Height / 2);
      this.x2Label.setStyle({ fontSize: ultraCompactLayout ? "12px" : height < 700 ? "14px" : "16px" }).setPosition(this.x2Btn.x, this.x2Btn.y);
      fitTextScaleToWidth(this.x2Label, buttonWidth - 20, 0.76);
      nextTop += x2Height + buttonGap;
    }

    this.restartBtn.setSize(buttonWidth, restartHeight).setPosition(width / 2, nextTop + restartHeight / 2);
    this.restartLabel.setStyle({ fontSize: ultraCompactLayout ? "18px" : height < 700 ? "22px" : "24px" }).setPosition(this.restartBtn.x, this.restartBtn.y);
    fitTextScaleToWidth(this.restartLabel, buttonWidth - 20, 0.76);
    nextTop += restartHeight + buttonGap;

    this.menuBtn.setSize(buttonWidth, menuHeight).setPosition(width / 2, nextTop + menuHeight / 2);
    this.menuLabel.setStyle({ fontSize: ultraCompactLayout ? "15px" : height < 700 ? "18px" : "20px" }).setPosition(this.menuBtn.x, this.menuBtn.y);
    fitTextScaleToWidth(this.menuLabel, buttonWidth - 20, 0.76);
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
      this.analytics?.track(ANALYTICS_EVENTS.X2_RESULTS_ACCEPT, {
        mode: this.state.mode,
        mult,
        score: computeRunScore(this.state),
        wave: this.state.waveIndex,
      });
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
    const dateUtc = this.state.daily?.dateUtc ?? this.getCurrentDateUtc();
    const nowMs = getPlatformNowMs(this.registry);
    const runDurationSec = Math.max(0, Math.floor((nowMs - this.state.startedAtMs) / 1000));
    const frustratedRun = this.state.metrics.reviveOffers > this.state.metrics.revivesAccepted;
    const s0 = this.saveManager.get();
    const s1 = this.state.mode === "daily" && this.state.daily?.dateUtc ? normalizeDailySave(s0, this.state.daily.dateUtc) : s0;
    const saveWithRewards = this.syncRunRewards(s1);
    const runScore = computeRunScore(this.state);
    const liveopsSave =
      this.state.mode === "tutorial"
        ? saveWithRewards
        : applyRunSummaryToLiveops(saveWithRewards, this.state.config.liveops, dateUtc, {
            mode: this.state.mode,
            wave: this.state.waveIndex,
            score: runScore,
            totalBolts: this.state.bolts,
            bankedBolts: this.state.metrics.boltsBanked,
            heavyScrapCollected: this.state.metrics.heavyScrapCollected,
            projectilesDeflected: this.state.metrics.projectilesDeflected,
            flipsUsed: this.state.metrics.flipsUsed,
          });
    const entry = buildLeaderboardEntry(this.state, this.getLeaderboardEntryId(), liveopsSave.settings.pilotName);
    const previousFiltered = filterLeaderboardEntries(liveopsSave.leaderboard.entries, this.latestLeaderboardFilter);
    const previousBestScore = getLeaderboardBestScore(previousFiltered, entry.id);
    const promotion = getLeaderboardPromotionRewards(
      liveopsSave.leaderboard.highestDivision,
      entry.score,
      liveopsSave.leaderboard.claimedRewardDivisions
    );
    const promotedDivision = promotion.divisions[promotion.divisions.length - 1] ?? null;
    const promotionReward = promotion.reward;
    const withPromotionRewards =
      promotionReward.bolts > 0 || promotionReward.cores > 0 ? grantMetaWallet(liveopsSave, promotionReward) : liveopsSave;
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

    let nextSave: SaveData = {
      ...withMilestoneRewards,
      stats: { ...withMilestoneRewards.stats, bestWave, bestBolts, runsCompleted },
      ads: {
        ...withMilestoneRewards.ads,
        lastRunStartedAtMs: Math.max(0, Math.floor(this.state.startedAtMs)),
        lastRunDurationSec: runDurationSec,
        lastFrustrationAtMs: frustratedRun ? nowMs : withMilestoneRewards.ads.lastFrustrationAtMs,
      },
      leaderboard: {
        ...withMilestoneRewards.leaderboard,
        claimedMilestones,
      },
      daily,
    };
    if (this.state.mode !== "tutorial") {
      const previousWeeklyRank = getLeaderboardRank(nextSave.liveops.weeklyLeaderboard.entries, entry.id);
      const weeklyBoard = upsertWeeklyLeaderboardEntry(nextSave, this.state.config.leaderboards, getWeekKey(dateUtc), entry);
      nextSave = weeklyBoard.save;
      this.latestWeeklyRank = weeklyBoard.rank;
      this.latestWeeklyBoardDebut = previousWeeklyRank === null && weeklyBoard.rank !== null;
      this.latestWeeklyRankDelta =
        previousWeeklyRank !== null && weeklyBoard.rank !== null ? previousWeeklyRank - weeklyBoard.rank : null;
    }

    await this.saveManager.save(nextSave);
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
    this.registry.set("lastWeeklyLeaderboardRank", this.latestWeeklyRank);
    this.registry.set("lastWeeklyLeaderboardDelta", this.latestWeeklyRankDelta);
    this.registry.set("lastWeeklyLeaderboardDebut", this.latestWeeklyBoardDebut);
    this.refreshStatsText();
    if (this.state.mode === "daily") {
      this.analytics?.track(ANALYTICS_EVENTS.DAILY_FINISH, {
        dateUtc,
        score: entry.score,
        wave: this.state.waveIndex,
        bolts: this.state.bolts,
        weeklyRank: this.latestWeeklyRank,
      });
    }
    await this.submitBoardScores(entry.score);
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

  private async submitBoardScores(score: number): Promise<void> {
    if (!this.platformAdapter) return;

    const submissions: Promise<void>[] = [];
    if (this.state.mode === "daily") {
      submissions.push(this.platformAdapter.submitScore?.(getBoardId(this.state.config.leaderboards, "daily"), score) ?? Promise.resolve());
    }
    if (this.state.mode !== "tutorial") {
      submissions.push(this.platformAdapter.submitScore?.(getBoardId(this.state.config.leaderboards, "weekly"), score) ?? Promise.resolve());
    }
    if (this.state.mode === "run") {
      submissions.push(this.platformAdapter.submitScore?.(getBoardId(this.state.config.leaderboards, "all_time"), score) ?? Promise.resolve());
    }

    await Promise.allSettled(submissions);

    if (this.state.mode !== "tutorial") {
      try {
        const snapshot = await this.platformAdapter.getLeaderboard?.(getBoardId(this.state.config.leaderboards, "weekly"), "weekly");
        if (snapshot?.currentPlayerRank) {
          this.latestWeeklyRank = snapshot.currentPlayerRank;
          this.registry.set("lastWeeklyLeaderboardRank", this.latestWeeklyRank);
          this.registry.set("lastWeeklyLeaderboardDelta", this.latestWeeklyRankDelta);
          this.registry.set("lastWeeklyLeaderboardDebut", this.latestWeeklyBoardDebut);
          this.refreshStatsText();
        }
      } catch {
        // ignore
      }
    }
  }

  private getCurrentDateUtc(): string {
    return getUtcYyyymmdd(new Date(getPlatformNowMs(this.registry)));
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

function fitTextScaleToWidth(text: Phaser.GameObjects.Text, maxWidth: number, minScale = 0.72): void {
  text.setScale(1);
  if (text.width <= 0 || text.width <= maxWidth) return;
  text.setScale(Phaser.Math.Clamp(maxWidth / text.width, minScale, 1));
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
