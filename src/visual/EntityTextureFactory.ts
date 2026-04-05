import Phaser from "phaser";
import { VISUAL_PALETTE } from "./TextureFactory";

export function createEntityTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("player")) return;

  drawTexture(scene, "player", 40, 28, (g) => {
    g.fillStyle(VISUAL_PALETTE.metalGray, 1);
    g.fillRoundedRect(4, 7, 26, 14, 5);
    g.lineStyle(2, VISUAL_PALETTE.metalLight, 0.92);
    g.strokeRoundedRect(4, 7, 26, 14, 5);

    g.fillStyle(VISUAL_PALETTE.rustDark, 1);
    g.fillRoundedRect(8, 9, 10, 10, 3);
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillRoundedRect(20, 4, 10, 20, 4);
    g.fillStyle(VISUAL_PALETTE.neonCyan, 1);
    g.fillRoundedRect(22, 6, 6, 8, 2);

    g.lineStyle(4, VISUAL_PALETTE.neonCyan, 1);
    g.lineBetween(30, 9, 36, 9);
    g.lineBetween(30, 19, 36, 19);
    g.lineBetween(36, 9, 36, 19);

    g.fillStyle(VISUAL_PALETTE.warningAmber, 1);
    g.fillCircle(18, 14, 4);
    g.lineStyle(2, VISUAL_PALETTE.metalLight, 0.85);
    g.strokeCircle(18, 14, 5.8);

    g.fillStyle(VISUAL_PALETTE.black, 0.95);
    g.fillCircle(9, 7, 3);
    g.fillCircle(9, 21, 3);
    g.fillCircle(24, 7, 3);
    g.fillCircle(24, 21, 3);
  });

  drawTexture(scene, "recycler", 140, 140, (g) => {
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillCircle(70, 70, 64);
    g.lineStyle(4, VISUAL_PALETTE.neonBlue, 0.9);
    g.strokeCircle(70, 70, 62);

    g.fillStyle(VISUAL_PALETTE.rustDark, 0.9);
    g.fillCircle(70, 70, 48);
    g.lineStyle(7, VISUAL_PALETTE.metalGray, 0.82);
    g.strokeCircle(70, 70, 43);

    g.fillStyle(VISUAL_PALETTE.warningAmber, 0.94);
    g.fillTriangle(70, 18, 82, 34, 58, 34);
    g.fillTriangle(122, 70, 106, 58, 106, 82);
    g.fillTriangle(70, 122, 58, 106, 82, 106);
    g.fillTriangle(18, 70, 34, 82, 34, 58);

    g.fillStyle(VISUAL_PALETTE.bgDeep, 1);
    g.fillCircle(70, 70, 22);
    g.lineStyle(3, VISUAL_PALETTE.neonCyan, 0.8);
    g.strokeCircle(70, 70, 24);

    g.lineStyle(3, VISUAL_PALETTE.neonCyan, 0.65);
    g.lineBetween(49, 70, 91, 70);
    g.lineBetween(70, 49, 70, 91);
  });

  drawTexture(scene, "scrap_common", 18, 18, (g) => {
    g.fillStyle(VISUAL_PALETTE.metalLight, 1);
    g.fillRoundedRect(3, 5, 12, 8, 3);
    g.lineStyle(2, VISUAL_PALETTE.metalGray, 0.95);
    g.strokeRoundedRect(3, 5, 12, 8, 3);
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillCircle(7, 9, 2);
    g.fillCircle(11, 9, 2);
  });

  drawTexture(scene, "scrap_heavy", 22, 22, (g) => {
    g.fillStyle(VISUAL_PALETTE.rustMid, 1);
    g.fillRoundedRect(3, 4, 16, 14, 3);
    g.lineStyle(2, VISUAL_PALETTE.rustDark, 0.95);
    g.strokeRoundedRect(3, 4, 16, 14, 3);
    g.fillStyle(VISUAL_PALETTE.warningAmber, 1);
    g.fillRect(6, 7, 10, 3);
    g.fillRect(6, 12, 6, 3);
    g.fillStyle(VISUAL_PALETTE.black, 0.8);
    g.fillCircle(8, 18, 2.5);
    g.fillCircle(15, 18, 2.5);
  });

  drawTexture(scene, "scrap_rare", 20, 20, (g) => {
    g.fillStyle(VISUAL_PALETTE.neonBlue, 0.75);
    g.fillTriangle(10, 1, 18, 10, 10, 19);
    g.fillTriangle(10, 1, 2, 10, 10, 19);
    g.fillStyle(VISUAL_PALETTE.neonMagenta, 1);
    g.fillTriangle(10, 3, 16, 10, 10, 17);
    g.fillTriangle(10, 3, 4, 10, 10, 17);
    g.lineStyle(2, VISUAL_PALETTE.white, 0.88);
    g.strokeLineShape(new Phaser.Geom.Line(10, 4, 10, 16));
    g.strokeLineShape(new Phaser.Geom.Line(5, 10, 15, 10));
  });

  drawTexture(scene, "enemy_chaser", 32, 24, (g) => {
    g.fillStyle(VISUAL_PALETTE.hpRed, 1);
    g.fillRoundedRect(4, 6, 18, 12, 4);
    g.fillTriangle(21, 6, 30, 12, 21, 18);
    g.lineStyle(2, VISUAL_PALETTE.rustDark, 0.95);
    g.strokeRoundedRect(4, 6, 18, 12, 4);
    g.strokeLineShape(new Phaser.Geom.Line(21, 6, 30, 12));
    g.strokeLineShape(new Phaser.Geom.Line(21, 18, 30, 12));
    g.fillStyle(VISUAL_PALETTE.black, 0.95);
    g.fillCircle(8, 5, 3);
    g.fillCircle(8, 19, 3);
    g.fillCircle(20, 5, 3);
    g.fillCircle(20, 19, 3);
    g.fillStyle(VISUAL_PALETTE.warningAmber, 0.9);
    g.fillRect(8, 10, 8, 4);
  });

  drawTexture(scene, "enemy_shooter", 32, 24, (g) => {
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillRoundedRect(5, 6, 16, 12, 4);
    g.lineStyle(2, VISUAL_PALETTE.neonBlue, 0.95);
    g.strokeRoundedRect(5, 6, 16, 12, 4);
    g.fillStyle(VISUAL_PALETTE.neonBlue, 0.95);
    g.fillCircle(14, 12, 5);
    g.fillRoundedRect(17, 10, 11, 4, 2);
    g.fillStyle(VISUAL_PALETTE.metalLight, 0.9);
    g.fillCircle(9, 6, 2.5);
    g.fillCircle(9, 18, 2.5);
    g.fillCircle(18, 6, 2.5);
    g.fillCircle(18, 18, 2.5);
  });

  drawTexture(scene, "enemy_cutter", 28, 28, (g) => {
    g.fillStyle(VISUAL_PALETTE.metalLight, 0.98);
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2;
      const a1 = a0 + Math.PI / 8;
      const x0 = 14 + Math.cos(a0) * 6;
      const y0 = 14 + Math.sin(a0) * 6;
      const x1 = 14 + Math.cos(a1) * 12;
      const y1 = 14 + Math.sin(a1) * 12;
      const x2 = 14 + Math.cos(a0 - Math.PI / 8) * 12;
      const y2 = 14 + Math.sin(a0 - Math.PI / 8) * 12;
      g.fillTriangle(x0, y0, x1, y1, x2, y2);
    }
    g.fillStyle(VISUAL_PALETTE.neonMagenta, 1);
    g.fillCircle(14, 14, 7);
    g.lineStyle(2, VISUAL_PALETTE.rustDark, 0.95);
    g.strokeCircle(14, 14, 8);
    g.fillStyle(VISUAL_PALETTE.warningAmber, 0.95);
    g.fillCircle(14, 14, 2.5);
  });

  drawTexture(scene, "projectile", 14, 8, (g) => {
    g.fillStyle(VISUAL_PALETTE.white, 1);
    g.fillEllipse(8, 4, 10, 6);
    g.fillStyle(VISUAL_PALETTE.neonCyan, 0.95);
    g.fillTriangle(1, 4, 6, 1, 6, 7);
  });

  drawTexture(scene, "shrapnel", 8, 8, (g) => {
    g.fillStyle(VISUAL_PALETTE.neonCyan, 1);
    g.fillTriangle(1, 4, 7, 1, 6, 7);
  });

  drawTexture(scene, "telegraph", 32, 32, (g) => {
    g.lineStyle(2, VISUAL_PALETTE.neonCyan, 0.9);
    g.strokeCircle(16, 16, 9);
    g.lineBetween(4, 16, 10, 16);
    g.lineBetween(22, 16, 28, 16);
    g.lineBetween(16, 4, 16, 10);
    g.lineBetween(16, 22, 16, 28);
    g.lineBetween(7, 7, 11, 11);
    g.lineBetween(21, 21, 25, 25);
    g.lineBetween(21, 11, 25, 7);
    g.lineBetween(7, 25, 11, 21);
  });

  drawTexture(scene, "drone_buddy", 24, 18, (g) => {
    g.lineStyle(2, VISUAL_PALETTE.neonBlue, 0.95);
    g.lineBetween(6, 9, 18, 9);
    g.lineBetween(12, 4, 12, 14);
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillRoundedRect(8, 6, 8, 6, 3);
    g.lineStyle(2, VISUAL_PALETTE.neonCyan, 0.9);
    g.strokeRoundedRect(8, 6, 8, 6, 3);
    g.fillStyle(VISUAL_PALETTE.warningAmber, 0.95);
    g.fillCircle(6, 9, 2.5);
    g.fillCircle(18, 9, 2.5);
    g.fillCircle(12, 4, 2.5);
    g.fillCircle(12, 14, 2.5);
  });

  drawTexture(scene, "scrap_mine", 18, 18, (g) => {
    g.fillStyle(VISUAL_PALETTE.bgMid, 1);
    g.fillCircle(9, 9, 6);
    g.lineStyle(2, VISUAL_PALETTE.warningAmber, 0.95);
    g.strokeCircle(9, 9, 6.5);
    g.fillStyle(VISUAL_PALETTE.warningAmber, 1);
    g.fillTriangle(9, 0, 11, 5, 7, 5);
    g.fillTriangle(18, 9, 13, 7, 13, 11);
    g.fillTriangle(9, 18, 7, 13, 11, 13);
    g.fillTriangle(0, 9, 5, 11, 5, 7);
    g.fillStyle(VISUAL_PALETTE.neonMagenta, 0.95);
    g.fillCircle(9, 9, 2);
  });
}

function drawTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}
