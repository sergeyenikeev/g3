import Phaser from "phaser";
import type { StaticGameData } from "../../data/staticGameData";
import { createPlatformAdapter } from "../../platform/platformFactory";
import { SaveManager } from "../../platform/save/saveManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.setPath("assets");
    this.load.json("balances", "data/balances.json");
    this.load.json("enemies", "data/enemies.json");
    this.load.json("wave_sets", "data/wave_sets.json");
    this.load.json("patterns", "data/patterns.json");
    this.load.json("daily", "data/daily.json");
    this.load.json("run_upgrades", "data/run_upgrades.json");
    this.load.json("balance_presets", "data/balance_presets.json");
    this.load.json("meta_tree", "data/meta_tree.json");

    const w = this.scale.width;
    const h = this.scale.height;
    const barBg = this.add.rectangle(w / 2, h / 2, Math.min(520, w * 0.8), 16, 0x1b2635);
    barBg.setOrigin(0.5);
    const bar = this.add.rectangle(barBg.x - barBg.width / 2, barBg.y, 0, 12, 0x5cc8ff);
    bar.setOrigin(0, 0.5);

    this.load.on("progress", (p: number) => {
      bar.width = barBg.width * Phaser.Math.Clamp(p, 0, 1);
    });
  }

  create(): void {
    const data: StaticGameData = {
      balances: this.cache.json.get("balances"),
      enemies: this.cache.json.get("enemies"),
      waveSets: this.cache.json.get("wave_sets"),
      patterns: this.cache.json.get("patterns"),
      daily: this.cache.json.get("daily"),
      runUpgrades: this.cache.json.get("run_upgrades"),
      balancePresets: this.cache.json.get("balance_presets"),
      metaTree: this.cache.json.get("meta_tree"),
    };
    this.registry.set("staticGameData", data);

    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const adapter = createPlatformAdapter();
    await adapter.init();
    const saveManager = new SaveManager(adapter);
    const save = await saveManager.load();
    this.registry.set("platformAdapter", adapter);
    this.registry.set("saveManager", saveManager);
    this.registry.set("saveData", save);

    this.scene.start("menu");
  }
}
