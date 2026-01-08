import Phaser from "phaser";
import type { StaticGameData } from "../../data/staticGameData";
import { createAnalyticsAdapter } from "../../analytics/analyticsFactory";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { AdsManager } from "../../platform/ads/adsManager";
import { createPlatformAdapter } from "../../platform/platformFactory";
import { SaveManager } from "../../platform/save/saveManager";
import { getCrazyGamesGameApi } from "../../platform/sdk/crazyGamesSdk";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    const cgGame = getCrazyGamesGameApi();
    try {
      cgGame?.sdkGameLoadingStart?.();
    } catch {
      // ignore
    }

    this.load.setPath("assets");
    this.load.json("balances", "data/balances.json");
    this.load.json("enemies", "data/enemies.json");
    this.load.json("wave_sets", "data/wave_sets.json");
    this.load.json("patterns", "data/patterns.json");
    this.load.json("daily", "data/daily.json");
    this.load.json("run_upgrades", "data/run_upgrades.json");
    this.load.json("balance_presets", "data/balance_presets.json");
    this.load.json("meta_tree", "data/meta_tree.json");

    this.load.audio("sfx_pickup", "audio/pickup.mp3");
    this.load.audio("sfx_hit", "audio/hit.mp3");
    this.load.audio("sfx_flip", "audio/flip.mp3");
    this.load.audio("sfx_bank", "audio/bank.mp3");
    this.load.audio("sfx_ui_click", "audio/ui_click.mp3");
    this.load.audio("sfx_upgrade", "audio/upgrade_select.mp3");
    this.load.audio("music_main", "audio/music_loop.mp3");

    // Visual (generated / optional runtime fallback)
    this.load.image("bg_tile_256", "generated/bg_tile_256.png");
    this.load.image("bg_far_silhouette", "generated/bg_far_silhouette.png");
    this.load.image("vignette", "generated/vignette.png");
    this.load.image("lightGradient", "generated/lightGradient.png");

    for (let i = 1; i <= 4; i++) this.load.image(`decal_oil_0${i}`, `generated/decal_oil_0${i}.png`);
    for (let i = 1; i <= 4; i++) this.load.image(`decal_scratch_0${i}`, `generated/decal_scratch_0${i}.png`);
    for (let i = 1; i <= 4; i++) this.load.image(`decal_bolts_0${i}`, `generated/decal_bolts_0${i}.png`);

    this.load.image("vfx_ring", "generated/vfx_ring.png");
    this.load.image("vfx_glow_blob", "generated/vfx_glow_blob.png");
    this.load.image("vfx_spark", "generated/vfx_spark.png");
    this.load.image("vfx_smoke_puff", "generated/vfx_smoke_puff.png");
    this.load.image("vfx_trail", "generated/vfx_trail.png");
    this.load.image("vfx_hit_flash", "generated/vfx_hit_flash.png");
    this.load.image("vfx_line", "generated/vfx_line.png");
    this.load.image("rarity_frame_common", "generated/rarity_frame_common.png");
    this.load.image("rarity_frame_uncommon", "generated/rarity_frame_uncommon.png");
    this.load.image("rarity_frame_rare", "generated/rarity_frame_rare.png");
    this.load.image("rarity_frame_epic", "generated/rarity_frame_epic.png");

    const w = this.scale.width;
    const h = this.scale.height;
    const barBg = this.add.rectangle(w / 2, h / 2, Math.min(520, w * 0.8), 16, 0x1b2635);
    barBg.setOrigin(0.5);
    const bar = this.add.rectangle(barBg.x - barBg.width / 2, barBg.y, 0, 12, 0x5cc8ff);
    bar.setOrigin(0, 0.5);

    this.load.on("progress", (p: number) => {
      bar.width = barBg.width * Phaser.Math.Clamp(p, 0, 1);
      try {
        cgGame?.sdkGameLoadingProgress?.(Math.round(Phaser.Math.Clamp(p, 0, 1) * 100));
      } catch {
        // ignore
      }
    });

    this.load.on("complete", () => {
      try {
        cgGame?.sdkGameLoadingStop?.();
      } catch {
        // ignore
      }
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

    const analytics = createAnalyticsAdapter();
    await analytics.init();
    const adsManager = new AdsManager(adapter, analytics, saveManager);

    this.registry.set("platformAdapter", adapter);
    this.registry.set("saveManager", saveManager);
    this.registry.set("saveData", save);
    this.registry.set("analytics", analytics);
    this.registry.set("adsManager", adsManager);

    trackSessionStart(analytics, adapter.name);
    try {
      window.addEventListener("beforeunload", () => trackSessionEnd(analytics, adapter.name));
    } catch {
      // ignore
    }

    this.scene.start("menu");
  }
}

function trackSessionStart(analytics: AnalyticsAdapter, platform: string): void {
  analytics.track(ANALYTICS_EVENTS.SESSION_START, { platform, t: Date.now() });
}

function trackSessionEnd(analytics: AnalyticsAdapter, platform: string): void {
  analytics.track(ANALYTICS_EVENTS.SESSION_END, { platform, t: Date.now() });
}
