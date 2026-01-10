import Phaser from "phaser";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { AdsManager } from "../../platform/ads/adsManager";
import type { SaveManager } from "../../platform/save/saveManager";
import type { RunState } from "../run/runState";
import { normalizeDailySave } from "../daily/dailyAttempts";

export class ResultsScene extends Phaser.Scene {
  private ads!: AdsManager;
  private saveManager!: SaveManager;
  private state!: RunState;
  private statsText!: Phaser.GameObjects.Text;
  private exitBusy = false;
  private x2Used = false;
  private x2Btn: Phaser.GameObjects.Rectangle | null = null;
  private x2Label: Phaser.GameObjects.Text | null = null;
  private runRecorded = false;

  constructor() {
    super("results");
  }

  create(): void {
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.state = this.registry.get("runState") as RunState;
    this.exitBusy = false;
    this.x2Used = false;
    this.runRecorded = false;
    this.x2Btn = null;
    this.x2Label = null;
    this.input.enabled = true;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(2000);

    this.add
      .text(width / 2, height * 0.22, "RUN OVER", { fontSize: "44px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.statsText = this.add
      .text(width / 2, height * 0.36, "", {
        fontSize: "20px",
        color: "#98b7c7",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(2001);
    this.refreshStatsText();

    const x2Cfg = this.state.config.ads?.rewarded?.x2Results;
    if (x2Cfg?.enabled) {
      const btnX2 = this.add
        .rectangle(width / 2, height * 0.52, 280, 52, 0x1b2635, 0.95)
        .setStrokeStyle(2, 0x57c27d, 0.9)
        .setInteractive({ useHandCursor: true })
        .setDepth(2001);
      const labelX2 = this.add
        .text(btnX2.x, btnX2.y, "X2 BOLTS (Rewarded)", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
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
      .text(btnRestart.x, btnRestart.y, "RESTART", { fontSize: "24px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    const btnMenu = this.add
      .rectangle(width / 2, height * 0.74, 280, 52, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true })
      .setDepth(2001);
    this.add
      .text(btnMenu.x, btnMenu.y, "MENU", { fontSize: "20px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    btnRestart.on("pointerdown", () => void this.exitTo("restart"));
    btnMenu.on("pointerdown", () => void this.exitTo("menu"));

    void this.recordRunOnceAndPersistScores();
  }

  private refreshStatsText(): void {
    this.statsText.setText(`Wave: ${this.state.waveIndex}\nBolts: ${this.state.bolts}\nCores: ${this.state.cores}`);
  }

  private async handleX2(): Promise<void> {
    if (this.exitBusy) return;
    if (this.x2Used) return;
    const cfg = this.state.config.ads?.rewarded?.x2Results;
    if (!cfg?.enabled) return;

    const res = await this.ads.showRewarded(AD_PLACEMENTS.X2_RESULTS);
    if (res.ok && res.rewarded) {
      const mult = typeof cfg.mult === "number" && Number.isFinite(cfg.mult) ? cfg.mult : 2;
      this.state.bolts = Math.floor(this.state.bolts * mult);
      this.x2Used = true;
      this.x2Btn?.setVisible(false);
      this.x2Label?.setVisible(false);
      this.refreshStatsText();
      await this.persistScoresOnly();
    }
  }

  private async recordRunOnceAndPersistScores(): Promise<void> {
    if (this.runRecorded) return;
    this.runRecorded = true;

    const s0 = this.saveManager.get();
    const s = this.state.mode === "daily" && this.state.daily?.dateUtc ? normalizeDailySave(s0, this.state.daily.dateUtc) : s0;

    const bestWave = Math.max(s.stats.bestWave, this.state.waveIndex);
    const bestBolts = Math.max(s.stats.bestBolts, this.state.bolts);
    const runsCompleted = Math.max(0, Math.floor(s.stats.runsCompleted)) + 1;

    let daily = s.daily;
    if (this.state.mode === "daily" && this.state.daily?.dateUtc && daily.lastDateUtc === this.state.daily.dateUtc) {
      daily = {
        ...daily,
        bestWave: Math.max(daily.bestWave, this.state.waveIndex),
        bestBolts: Math.max(daily.bestBolts, this.state.bolts),
      };
    }

    await this.saveManager.save({ ...s, stats: { ...s.stats, bestWave, bestBolts, runsCompleted }, daily });
    this.registry.set("saveData", this.saveManager.get());
  }

  private async persistScoresOnly(): Promise<void> {
    const s0 = this.saveManager.get();
    const s = this.state.mode === "daily" && this.state.daily?.dateUtc ? normalizeDailySave(s0, this.state.daily.dateUtc) : s0;

    const bestWave = Math.max(s.stats.bestWave, this.state.waveIndex);
    const bestBolts = Math.max(s.stats.bestBolts, this.state.bolts);

    let daily = s.daily;
    if (this.state.mode === "daily" && this.state.daily?.dateUtc && daily.lastDateUtc === this.state.daily.dateUtc) {
      daily = {
        ...daily,
        bestWave: Math.max(daily.bestWave, this.state.waveIndex),
        bestBolts: Math.max(daily.bestBolts, this.state.bolts),
      };
    }

    await this.saveManager.save({ ...s, stats: { ...s.stats, bestWave, bestBolts }, daily });
    this.registry.set("saveData", this.saveManager.get());
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
