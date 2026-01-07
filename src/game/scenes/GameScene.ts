import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private player!: Phaser.GameObjects.Arc;
  private move!: Phaser.Math.Vector2;

  constructor() {
    super("game");
  }

  create(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.move = new Phaser.Math.Vector2();

    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x0b0f14);

    this.player = this.add.circle(width / 2, height / 2, 14, 0x5cc8ff);

    this.add
      .text(16, 16, "Prototype scene (next: full gameplay)", { fontSize: "14px", color: "#98b7c7" })
      .setDepth(10);
  }

  update(_time: number, dtMs: number): void {
    const dt = dtMs / 1000;
    const speed = 260;

    const left = this.cursors.left?.isDown ?? false;
    const right = this.cursors.right?.isDown ?? false;
    const up = this.cursors.up?.isDown ?? false;
    const down = this.cursors.down?.isDown ?? false;

    this.move.set(Number(right) - Number(left), Number(down) - Number(up));
    if (this.move.lengthSq() > 0) this.move.normalize();

    this.player.x = Phaser.Math.Clamp(this.player.x + this.move.x * speed * dt, 0, this.scale.width);
    this.player.y = Phaser.Math.Clamp(this.player.y + this.move.y * speed * dt, 0, this.scale.height);
  }
}

