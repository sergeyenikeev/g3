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
    disableContextMenu: true,
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    input: {
      keyboard: {
        capture: [
          Phaser.Input.Keyboard.KeyCodes.UP,
          Phaser.Input.Keyboard.KeyCodes.DOWN,
          Phaser.Input.Keyboard.KeyCodes.LEFT,
          Phaser.Input.Keyboard.KeyCodes.RIGHT,
          Phaser.Input.Keyboard.KeyCodes.W,
          Phaser.Input.Keyboard.KeyCodes.A,
          Phaser.Input.Keyboard.KeyCodes.S,
          Phaser.Input.Keyboard.KeyCodes.D,
          Phaser.Input.Keyboard.KeyCodes.SPACE,
          Phaser.Input.Keyboard.KeyCodes.SHIFT,
          Phaser.Input.Keyboard.KeyCodes.ESC,
        ],
      },
      mouse: {
        preventDefaultDown: true,
        preventDefaultUp: true,
        preventDefaultMove: true,
        preventDefaultWheel: true,
      },
      touch: {
        capture: true,
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
