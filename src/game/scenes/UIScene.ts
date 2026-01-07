import Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  constructor() {
    super("ui");
  }

  create(): void {
    const { width, height } = this.scale;
    const hint = this.add
      .text(width - 16, 16, "UI overlay (next: joystick/buttons)", {
        fontSize: "14px",
        color: "#98b7c7",
      })
      .setOrigin(1, 0);
    hint.setDepth(1000);

    this.scale.on("resize", (s: Phaser.Structs.Size) => {
      hint.setPosition(s.width - 16, 16);
    });
  }
}

