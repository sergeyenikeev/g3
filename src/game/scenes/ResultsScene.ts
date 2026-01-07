import Phaser from "phaser";
import type { PlatformAdapter } from "../../platform/platformAdapter";
import type { SaveManager } from "../../platform/save/saveManager";
import type { RunState } from "../run/runState";

export class ResultsScene extends Phaser.Scene {
  private adapter!: PlatformAdapter;
  private saveManager!: SaveManager;
  private state!: RunState;

  constructor() {
    super("results");
  }

  create(): void {
    this.adapter = this.registry.get("platformAdapter") as PlatformAdapter;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.state = this.registry.get("runState") as RunState;

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setDepth(2000);

    this.add
      .text(width / 2, height * 0.22, "RUN OVER", { fontSize: "44px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5)
      .setDepth(2001);

    this.add
      .text(width / 2, height * 0.36, `Wave: ${this.state.waveIndex}\nBolts: ${this.state.bolts}\nCores: ${this.state.cores}`, {
        fontSize: "20px",
        color: "#98b7c7",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(2001);

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

    btnRestart.on("pointerdown", () => {
      this.scene.stop("ui");
      this.scene.start("game", { mode: this.state.mode });
      this.scene.launch("ui");
      this.scene.stop();
    });

    btnMenu.on("pointerdown", () => {
      this.scene.stop("ui");
      this.scene.start("menu");
      this.scene.stop();
    });

    void this.maybeInterstitialAndSaveBest();
  }

  private async maybeInterstitialAndSaveBest(): Promise<void> {
    const s = this.saveManager.get();
    const bestWave = Math.max(s.stats.bestWave, this.state.waveIndex);
    const bestBolts = Math.max(s.stats.bestBolts, this.state.bolts);
    await this.saveManager.save({ ...s, stats: { bestWave, bestBolts } });
    this.registry.set("saveData", this.saveManager.get());

    await this.adapter.showInterstitial();
  }
}

