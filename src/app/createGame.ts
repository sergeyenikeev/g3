import Phaser from "phaser";
import { BootScene } from "../game/scenes/BootScene";
import { GameScene } from "../game/scenes/GameScene";
import { MenuScene } from "../game/scenes/MenuScene";
import { ResultsScene } from "../game/scenes/ResultsScene";
import { UIScene } from "../game/scenes/UIScene";
import { UpgradeScene } from "../game/scenes/UpgradeScene";

export function createGame(parentId: string): Phaser.Game {
  const game = new Phaser.Game({
    type: import.meta.env.VITE_E2E === "1" ? Phaser.CANVAS : Phaser.AUTO,
    parent: parentId,
    backgroundColor: "#0b0f14",
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, GameScene, UIScene, UpgradeScene, ResultsScene],
  });

  return game;
}
