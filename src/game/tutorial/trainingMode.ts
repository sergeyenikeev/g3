import type { RuntimeConfig } from "../../data/runtimeConfig";

export const TRAINING_STARTING_SCRAP = 3;

export function applyTrainingModeConfig(cfg: RuntimeConfig): void {
  cfg.player.hpMax = Math.max(cfg.player.hpMax, 12);
  cfg.recycler.bankTimeSec = Math.min(cfg.recycler.bankTimeSec, 0.45);
  cfg.scrap.respawnTimeSec = Math.min(cfg.scrap.respawnTimeSec, 1.2);

  cfg.tail.lossOnCutter = Math.min(cfg.tail.lossOnCutter, 1);
  cfg.tail.lossOnProjectile = Math.min(cfg.tail.lossOnProjectile, 1);

  cfg.enemies.chaser.speed *= 0.58;
  cfg.enemies.chaser.contactDamage = 1;

  cfg.enemies.shooter.speed *= 0.55;
  cfg.enemies.shooter.contactDamage = 1;
  cfg.enemies.shooter.fireCooldownSec *= 1.6;
  cfg.enemies.shooter.projectile.speed *= 0.75;
  cfg.enemies.shooter.projectile.damage = 1;

  cfg.enemies.cutter.speed *= 0.5;
  cfg.enemies.cutter.contactDamage = 1;
  cfg.enemies.cutter.tailCut = 1;
  cfg.enemies.cutter.cooldownAfterCutSec *= 1.5;

  cfg.ads.interstitialCooldownSec = 60 * 60 * 24;
  cfg.ads.interstitialMinRunsCompleted = Number.MAX_SAFE_INTEGER;
  cfg.ads.noInterstitialAfterRewardedSec = 60 * 60 * 24;
  cfg.ads.rewarded.revive.enabled = false;
  cfg.ads.rewarded.x2Results.enabled = false;
  cfg.ads.rewarded.reroll.enabled = false;
  cfg.ads.rewarded.startBooster.enabled = false;
}
