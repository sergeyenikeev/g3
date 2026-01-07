import Phaser from "phaser";
import type { SaveData } from "../../platform/save/saveManager";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this.scale;
    const save = this.registry.get("saveData") as SaveData | undefined;

    this.add
      .text(width / 2, height * 0.35, "MAGNET CARAVAN", {
        fontSize: "42px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnPlay = this.add
      .rectangle(width / 2, height * 0.62, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(btnPlay.x, btnPlay.y, "PLAY", { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnPlay.on("pointerdown", () => {
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    });

    const btnDaily = this.add
      .rectangle(width / 2, height * 0.72, 280, 56, 0x121a24)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(btnDaily.x, btnDaily.y, "DAILY", { fontSize: "22px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnDaily.on("pointerdown", () => {
      this.scene.start("game", { mode: "daily" });
      this.scene.launch("ui");
    });

    if (save) {
      this.add
        .text(width / 2, height * 0.48, `Best wave: ${save.stats.bestWave} | Best bolts: ${save.stats.bestBolts}`, {
          fontSize: "16px",
          color: "#98b7c7",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, height * 0.82, "WASD/Arrows: move | Space: flip", {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    this.scale.on("resize", (s: Phaser.Structs.Size) => {
      btnPlay.setPosition(s.width / 2, s.height * 0.62);
      labelPlay.setPosition(btnPlay.x, btnPlay.y);
      btnDaily.setPosition(s.width / 2, s.height * 0.72);
      labelDaily.setPosition(btnDaily.x, btnDaily.y);
    });
  }
}
