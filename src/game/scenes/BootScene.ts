import Phaser from "phaser";
import { getBootstrapLocale, syncDocumentLocale } from "../../app/bootstrapShell";
import type { StaticGameData } from "../../data/staticGameData";
import { createAnalyticsAdapter } from "../../analytics/analyticsFactory";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { AdsManager } from "../../platform/ads/adsManager";
import { createPlatformAdapter } from "../../platform/platformFactory";
import { getPlatformLanguageHint, resolvePlatformTimeOffsetMs } from "../../platform/platformRuntime";
import { SaveManager } from "../../platform/save/saveManager";
import { getPreinitializedYandexSdk } from "../../platform/sdk/loadPlatformSdk";
import { type Locale, resolveLocale, t } from "../../i18n/localization";
import { getUtcYyyymmdd } from "../daily/daily";
import { normalizeLiveopsSave } from "../liveops/liveops";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    const bootLocale = getBootstrapLocale();
    syncDocumentLocale(bootLocale);
    let activeBootLocale: Locale = bootLocale;
    let loadingProgress = 0;
    const w = this.scale.width;
    const h = this.scale.height;
    const panelWidth = Math.min(620, w * 0.84);
    const panelHeight = Math.min(210, h * 0.34);
    const titleSize = Math.max(28, Math.min(42, w * 0.05));
    const bodySize = Math.max(14, Math.min(20, w * 0.022));
    const progressSize = Math.max(14, Math.min(18, w * 0.02));

    this.cameras.main.setBackgroundColor(0x07111b);
    this.add.ellipse(w / 2, h / 2 - panelHeight * 0.35, panelWidth * 0.92, panelHeight * 0.95, 0x123048, 0.24);

    const panel = this.add.rectangle(w / 2, h / 2, panelWidth, panelHeight, 0x102030, 0.96);
    panel.setStrokeStyle(2, 0x29445f, 0.9);
    this.add.rectangle(w / 2, panel.y - panelHeight / 2 + 18, panelWidth - 32, 4, 0x5cc8ff, 0.92);

    const titleText = this.add
      .text(w / 2, panel.y - 48, t(bootLocale, "bootstrap.loading.title"), {
        fontSize: `${titleSize}px`,
        color: "#f5fbff",
        fontStyle: "700",
        align: "center",
      })
      .setOrigin(0.5);

    const bodyText = this.add
      .text(w / 2, panel.y - 8, t(bootLocale, "bootstrap.loading.body"), {
        fontSize: `${bodySize}px`,
        color: "#b8d3e8",
        align: "center",
        wordWrap: { width: panelWidth - 56, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    const progressText = this.add
      .text(w / 2, panel.y + 44, t(bootLocale, "bootstrap.loading.progress", { value: 0 }), {
        fontSize: `${progressSize}px`,
        color: "#d7ecff",
        fontStyle: "600",
        align: "center",
      })
      .setOrigin(0.5);

    this.load.setPath("assets");
    this.load.json("balances", "data/balances.json");
    this.load.json("enemies", "data/enemies.json");
    this.load.json("wave_sets", "data/wave_sets.json");
    this.load.json("patterns", "data/patterns.json");
    this.load.json("daily", "data/daily.json");
    this.load.json("liveops", "data/liveops.json");
    this.load.json("leaderboards", "data/leaderboards.json");
    this.load.json("run_upgrades", "data/run_upgrades.json");
    this.load.json("balance_presets", "data/balance_presets.json");
    this.load.json("meta_tree", "data/meta_tree.json");

    this.load.audio("sfx_pickup", "audio/pickup.mp3");
    this.load.audio("sfx_hit", "audio/hit.mp3");
    this.load.audio("sfx_flip", "audio/flip.mp3");
    this.load.audio("sfx_bank", "audio/bank.mp3");
    this.load.audio("sfx_ui_click", "audio/ui_click.mp3");
    this.load.audio("sfx_upgrade", "audio/upgrade_select.mp3");
    this.load.audio("sfx_dash_arc", "audio/dash_arc.mp3");
    this.load.audio("sfx_dash_siphon", "audio/dash_siphon.mp3");
    this.load.audio("music_menu", "audio/music_menu_loop.mp3");
    this.load.audio("music_main", "audio/music_battle_loop.mp3");

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

    const barBg = this.add.rectangle(w / 2, panel.y + 76, Math.min(520, panelWidth - 40), 18, 0x1b2635, 1);
    barBg.setOrigin(0.5);
    barBg.setStrokeStyle(1, 0x34516e, 0.9);
    const bar = this.add.rectangle(barBg.x - barBg.width / 2 + 3, barBg.y, 0, 12, 0x5cc8ff, 1);
    bar.setOrigin(0, 0.5);

    this.load.on("progress", (p: number) => {
      const safeProgress = Phaser.Math.Clamp(p, 0, 1);
      loadingProgress = safeProgress;
      bar.width = Math.max(0, (barBg.width - 6) * safeProgress);
      progressText.setText(t(activeBootLocale, "bootstrap.loading.progress", { value: Math.round(safeProgress * 100) }));
    });

    void this.refreshBootLocaleHint(bootLocale, titleText, bodyText, progressText, () => loadingProgress, (locale) => {
      activeBootLocale = locale;
    });
  }

  create(): void {
    const data: StaticGameData = {
      balances: this.cache.json.get("balances"),
      enemies: this.cache.json.get("enemies"),
      waveSets: this.cache.json.get("wave_sets"),
      patterns: this.cache.json.get("patterns"),
      daily: this.cache.json.get("daily"),
      liveops: this.cache.json.get("liveops"),
      leaderboards: this.cache.json.get("leaderboards"),
      runUpgrades: this.cache.json.get("run_upgrades"),
      balancePresets: this.cache.json.get("balance_presets"),
      metaTree: this.cache.json.get("meta_tree"),
    };
    this.registry.set("staticGameData", data);

    void this.bootstrap();
  }

  private async refreshBootLocaleHint(
    initialLocale: Locale,
    titleText: Phaser.GameObjects.Text,
    bodyText: Phaser.GameObjects.Text,
    progressText: Phaser.GameObjects.Text,
    getProgress: () => number,
    setActiveLocale: (locale: Locale) => void
  ): Promise<void> {
    try {
      await getPreinitializedYandexSdk();
    } catch {
      return;
    }

    const nextLocale = getBootstrapLocale();
    if (nextLocale === initialLocale) return;
    if (!this.scene.isActive()) return;

    syncDocumentLocale(nextLocale);
    setActiveLocale(nextLocale);
    titleText.setText(t(nextLocale, "bootstrap.loading.title"));
    bodyText.setText(t(nextLocale, "bootstrap.loading.body"));
    progressText.setText(t(nextLocale, "bootstrap.loading.progress", { value: Math.round(getProgress() * 100) }));
  }

  private async bootstrap(): Promise<void> {
    const adapter = createPlatformAdapter();
    await adapter.init();
    const platformLanguageHint = getPlatformLanguageHint(adapter);
    const platformTimeOffsetMs = await resolvePlatformTimeOffsetMs(adapter);
    const saveManager = new SaveManager(adapter);
    let save = await saveManager.load();
    const dateUtc = getUtcYyyymmdd(new Date(Date.now() + platformTimeOffsetMs));
    const liveopsInit = normalizeLiveopsSave(
      save,
      (this.registry.get("staticGameData") as StaticGameData).liveops,
      (this.registry.get("staticGameData") as StaticGameData).leaderboards,
      dateUtc
    );
    let nextSave = liveopsInit.save;
    if ((nextSave.ads.rewardedChainCount ?? 0) !== 0) {
      nextSave = {
        ...nextSave,
        ads: {
          ...nextSave.ads,
          rewardedChainCount: 0,
        },
      };
    }
    if (nextSave !== save) {
      save = nextSave;
      await saveManager.save(save);
    }

    const analytics = createAnalyticsAdapter();
    await analytics.init();
    const adsManager = new AdsManager(adapter, analytics, saveManager, this.game.events);
    const locale = resolveLocale(save.settings.language, platformLanguageHint ? [platformLanguageHint] : null);
    syncDocumentLocale(locale);

    this.registry.set("platformAdapter", adapter);
    this.registry.set("platformLanguageHint", platformLanguageHint);
    this.registry.set("platformTimeOffsetMs", platformTimeOffsetMs);
    this.registry.set("saveManager", saveManager);
    this.registry.set("saveData", save);
    this.registry.set("languageSetting", save.settings.language);
    this.registry.set("locale", locale);
    this.registry.set("analytics", analytics);
    this.registry.set("adsManager", adsManager);
    this.registry.set("liveopsSessionSummary", liveopsInit.summary);
    this.registry.set("currentDateUtc", dateUtc);

    trackSessionStart(analytics, adapter.name, {
      dateUtc,
      returnGapDays: liveopsInit.summary.returnedAfterDays,
      streakDay: liveopsInit.summary.streakDay,
      sessionsStarted: save.liveops.sessionsStarted,
    });
    if (liveopsInit.summary.returnedAfterDays >= 1) {
      analytics.track(ANALYTICS_EVENTS.RETURN_AFTER_DAY, {
        dateUtc,
        daysAway: liveopsInit.summary.returnedAfterDays,
      });
    }
    try {
      window.addEventListener("beforeunload", () => trackSessionEnd(analytics, adapter.name));
    } catch {
      // ignore
    }

    this.scene.start("menu");
  }
}

function trackSessionStart(analytics: AnalyticsAdapter, platform: string, payload: Record<string, unknown>): void {
  analytics.track(ANALYTICS_EVENTS.SESSION_START, { platform, t: Date.now(), ...payload });
}

function trackSessionEnd(analytics: AnalyticsAdapter, platform: string): void {
  analytics.track(ANALYTICS_EVENTS.SESSION_END, { platform, t: Date.now() });
}
