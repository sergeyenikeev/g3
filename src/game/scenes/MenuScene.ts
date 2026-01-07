import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("menu");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height * 0.35, "MAGNET CARAVAN", {
        fontSize: "42px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btn = this.add
      .rectangle(width / 2, height * 0.62, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(btn.x, btn.y, "PLAY", { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btn.on("pointerdown", () => {
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    });

    this.add
      .text(width / 2, height * 0.82, "WASD/Arrows — move • Space — flip", {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    this.scale.on("resize", (s: Phaser.Structs.Size) => {
      btn.setPosition(s.width / 2, s.height * 0.62);
      label.setPosition(btn.x, btn.y);
    });
  }
}

