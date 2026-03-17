import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart, type DailyAttemptsInfo } from "../daily/dailyAttempts";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { SaveData } from "../../platform/save/saveManager";
import type { SaveManager } from "../../platform/save/saveManager";

const VOLUME_STEPS = [0, 0.3, 0.6, 0.8, 1] as const;

export class MenuScene extends Phaser.Scene {
  private staticData!: StaticGameData;
  private ads!: AdsManager;
  private analytics!: AnalyticsAdapter;
  private saveManager!: SaveManager;
  private saveData: SaveData | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("menu");
  }

  create(): void {
    this.staticData = this.registry.get("staticGameData") as StaticGameData;
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.analytics = this.registry.get("analytics") as AnalyticsAdapter;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.saveData = (this.registry.get("saveData") as SaveData | undefined) ?? this.saveManager.get();
    const save = this.saveData;
    const stats = save?.stats ?? { bestWave: 0, bestBolts: 0 };
    const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
    const boosterEnabled = Boolean(boosterCfg?.enabled);

    const title = this.add
      .text(0, 0, "MAGNET CARAVAN", {
        fontSize: "42px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const bestText = this.add
      .text(0, 0, `Best wave: ${stats.bestWave} | Best bolts: ${stats.bestBolts}`, {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    const btnQuality = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelQuality = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnSfx = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelSfx = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnMusic = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0x3aa4d4, 0.7)
      .setInteractive({ useHandCursor: true });
    const labelMusic = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const order: SaveData["settings"]["visualQuality"][] = ["auto", "low", "medium", "high"];
    let qualityPref: SaveData["settings"]["visualQuality"] = save?.settings?.visualQuality ?? "auto";
    let sfxVolume = snapVolumeStep(save?.settings?.sfxVolume ?? 0.8);
    let musicVolume = snapVolumeStep(save?.settings?.musicVolume ?? 0.6);

    const applyQualityLabel = (q: SaveData["settings"]["visualQuality"]) => {
      const label = q === "auto" ? "AUTO" : q === "medium" ? "MED" : q.toUpperCase();
      labelQuality.setText(`GFX: ${label}`);
      const stroke = q === "low" ? 0x6e7a86 : q === "medium" ? 0x2d7bff : q === "high" ? 0x3af2ff : 0x3aa4d4;
      btnQuality.setStrokeStyle(2, stroke, 0.8);
    };
    const applyVolumeLabel = (
      button: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      prefix: "SFX" | "MUSIC",
      value: number
    ) => {
      label.setText(formatVolumeLabel(prefix, value));
      const stroke = value <= 0 ? 0x5f6b76 : prefix === "SFX" ? 0x3aa4d4 : 0x57c27d;
      button.setStrokeStyle(2, stroke, value <= 0 ? 0.55 : 0.8);
    };
    applyQualityLabel(qualityPref);
    applyVolumeLabel(btnSfx, labelSfx, "SFX", sfxVolume);
    applyVolumeLabel(btnMusic, labelMusic, "MUSIC", musicVolume);

    btnQuality.on("pointerdown", () => {
      const idx = order.indexOf(qualityPref);
      const next = order[(idx + 1) % order.length]!;
      void this.setVisualQuality(next).then(() => {
        qualityPref = next;
        applyQualityLabel(next);
        this.toast(`Graphics: ${next.toUpperCase()}`);
      });
    });

    btnSfx.on("pointerdown", () => {
      const next = nextVolumeStep(sfxVolume);
      void this.setAudioVolume("sfxVolume", next).then(() => {
        sfxVolume = next;
        applyVolumeLabel(btnSfx, labelSfx, "SFX", next);
        this.toast(`SFX: ${formatToastVolume(next)}`);
      });
    });

    btnMusic.on("pointerdown", () => {
      const next = nextVolumeStep(musicVolume);
      void this.setAudioVolume("musicVolume", next).then(() => {
        musicVolume = next;
        applyVolumeLabel(btnMusic, labelMusic, "MUSIC", next);
        this.toast(`Music: ${formatToastVolume(next)}`);
      });
    });

    const btnPlay = this.add
      .rectangle(0, 0, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(0, 0, "PLAY", { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnPlay.on("pointerdown", () => {
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    });

    const btnPlayBoost = this.add
      .rectangle(0, 0, 280, 52, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlayBoost = this.add
      .text(0, 0, "PLAY + BOOST (Rewarded)", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnPlayBoost.setVisible(boosterEnabled);
    labelPlayBoost.setVisible(boosterEnabled);
    btnPlayBoost.on("pointerdown", () => void this.startRunBoosted());

    const btnTraining = this.add
      .rectangle(0, 0, 280, 46, 0x0f1720, 0.95)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelTraining = this.add
      .text(0, 0, "TRAINING", { fontSize: "18px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnTraining.on("pointerdown", () => {
      this.scene.start("game", { mode: "tutorial" });
      this.scene.launch("ui");
    });

    const btnDaily = this.add
      .rectangle(0, 0, 280, 56, 0x121a24)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(0, 0, "DAILY", { fontSize: "22px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const btnDailyBoost = this.add
      .rectangle(0, 0, 280, 46, 0x0f1720, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelDailyBoost = this.add
      .text(0, 0, "DAILY + BOOST", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    btnDailyBoost.setVisible(boosterEnabled);
    labelDailyBoost.setVisible(boosterEnabled);

    const dailyInfo = this.add
      .text(0, 0, "", { fontSize: "14px", color: "#98b7c7", align: "center", wordWrap: { width: 520 } })
      .setOrigin(0.5)
      .setLineSpacing(4);

    const controlsText = this.add
      .text(0, 0, "WASD/Arrows: move | Space: flip | Shift: dash", {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    const applyDailyButtonState = (
      button: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      active: boolean,
      stroke: number
    ) => {
      button.setAlpha(active ? 1 : 0.58);
      label.setAlpha(active ? 1 : 0.72);
      button.setStrokeStyle(2, active ? stroke : 0x5f6b76, active ? 0.85 : 0.5);
      button.setFillStyle(active ? 0x121a24 : 0x0d131b, active ? 0.95 : 0.9);
    };

    const refreshDailyButtons = (info: DailyAttemptsInfo) => {
      const regularPlan = planDailyStart(info, { boosted: false, boosterEnabled });
      const boostedPlan = planDailyStart(info, { boosted: true, boosterEnabled });

      labelDaily.setText(
        regularPlan.canStart ? (regularPlan.kind === "free" ? "DAILY (Free)" : "DAILY (Rewarded)") : "DAILY (Locked)"
      );
      applyDailyButtonState(btnDaily, labelDaily, regularPlan.canStart, regularPlan.kind === "rewarded" ? 0x57c27d : 0x3aa4d4);

      if (!boosterEnabled) return;

      labelDailyBoost.setText(
        boostedPlan.canStart
          ? boostedPlan.kind === "boosted_rewarded"
            ? "DAILY + BOOST (Extra Attempt)"
            : "DAILY + BOOST"
          : "DAILY + BOOST (Locked)"
      );
      applyDailyButtonState(btnDailyBoost, labelDailyBoost, boostedPlan.canStart, 0x57c27d);
    };

    btnDaily.on("pointerdown", () => void this.startDaily(false));
    btnDailyBoost.on("pointerdown", () => void this.startDaily(true));

    const layoutMenu = (s: { width: number; height: number }) => {
      title.setPosition(s.width / 2, s.height * 0.25);
      bestText.setPosition(s.width / 2, s.height * 0.36);

      btnQuality.setPosition(s.width - 16, 16);
      labelQuality.setPosition(btnQuality.x - btnQuality.width / 2, btnQuality.y + btnQuality.height / 2);
      btnSfx.setPosition(s.width - 16, 56);
      labelSfx.setPosition(btnSfx.x - btnSfx.width / 2, btnSfx.y + btnSfx.height / 2);
      btnMusic.setPosition(s.width - 16, 96);
      labelMusic.setPosition(btnMusic.x - btnMusic.width / 2, btnMusic.y + btnMusic.height / 2);

      btnPlay.setPosition(s.width / 2, s.height * 0.47);
      labelPlay.setPosition(btnPlay.x, btnPlay.y);
      btnPlayBoost.setPosition(s.width / 2, s.height * 0.56);
      labelPlayBoost.setPosition(btnPlayBoost.x, btnPlayBoost.y);
      btnTraining.setPosition(s.width / 2, s.height * 0.65);
      labelTraining.setPosition(btnTraining.x, btnTraining.y);
      btnDaily.setPosition(s.width / 2, s.height * 0.75);
      labelDaily.setPosition(btnDaily.x, btnDaily.y);
      btnDailyBoost.setPosition(s.width / 2, s.height * 0.84);
      labelDailyBoost.setPosition(btnDailyBoost.x, btnDailyBoost.y);
      dailyInfo.setPosition(s.width / 2, s.height * 0.92);
      dailyInfo.setWordWrapWidth(Math.max(280, Math.min(580, s.width - 48)), true);
      controlsText.setPosition(s.width / 2, s.height * 0.975);
      if (this.toastText) this.toastText.setPosition(s.width / 2, s.height * 0.93);
    };

    const onResize = (s: Phaser.Structs.Size) => layoutMenu(s);
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
    });

    layoutMenu(this.scale);
    void this.ensureDailyNormalizedAndRefresh(dailyInfo).then((info) => refreshDailyButtons(info));
  }

  private async ensureDailyNormalizedAndRefresh(dailyInfoText: Phaser.GameObjects.Text): Promise<DailyAttemptsInfo> {
    const dateUtc = getUtcYyyymmdd();
    const save = this.saveManager.get();
    const normalized = normalizeDailySave(save, dateUtc);
    if (normalized !== save) {
      await this.saveManager.save(normalized);
      this.registry.set("saveData", this.saveManager.get());
    }
    this.saveData = this.saveManager.get();

    const sel = pickDailyVariant(this.staticData.daily, dateUtc);
    const variant = this.staticData.daily.dailyVariants.find((v) => v.id === sel.variantId);
    const title = variant?.ui?.title ?? sel.variantId;
    const desc = variant?.ui?.desc ?? "";

    const info = getDailyAttemptsInfo(this.staticData.daily, this.saveData, dateUtc);
    const best = this.saveData.daily.lastDateUtc === dateUtc ? `Best: W${this.saveData.daily.bestWave}, B${this.saveData.daily.bestBolts}` : "Best: -";
    const nextStartLine =
      info.canStartFree
        ? "Next daily: free start."
        : info.canStartRewarded
          ? "Next daily: rewarded extra attempt."
          : "Next daily: no starts left today.";
    const boostedLine = !this.staticData.balances.ads?.rewarded?.startBooster?.enabled
      ? "Boosted daily: disabled."
      : info.canStartFree
        ? "Boosted daily: one rewarded ad for the booster."
        : info.canStartRewarded
          ? "Boosted daily: one rewarded ad grants the booster and uses the extra attempt."
          : "Boosted daily: unavailable today.";
    dailyInfoText.setText(
      `Seed: ${dateUtc} | ${title}\n${desc}\nAttempts: ${info.attemptsUsed}/${info.maxAttempts} | ${best}\n${nextStartLine}\n${boostedLine}`
    );
    return info;
  }

  private async startRunBoosted(): Promise<void> {
    const cfg = this.staticData.balances.ads?.rewarded?.startBooster;
    if (!cfg?.enabled) return;

    const res = await this.ads.showRewarded(AD_PLACEMENTS.START_BOOSTER);
    if (res.ok && res.rewarded) {
      this.registry.set("pendingStartBooster", true);
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
      return;
    }

    this.toast("Rewarded booster not granted.");
  }

  private async startDaily(boosted: boolean): Promise<void> {
    const dateUtc = getUtcYyyymmdd();
    const save0 = this.saveManager.get();
    const normalized = normalizeDailySave(save0, dateUtc);
    if (normalized !== save0) {
      await this.saveManager.save(normalized);
      this.registry.set("saveData", this.saveManager.get());
    }

    const save = this.saveManager.get();
    const info = getDailyAttemptsInfo(this.staticData.daily, save, dateUtc);
    const plan = planDailyStart(info, {
      boosted,
      boosterEnabled: Boolean(this.staticData.balances.ads?.rewarded?.startBooster?.enabled),
    });

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ENTER, {
      dateUtc,
      attemptsUsed: info.attemptsUsed,
      maxAttempts: info.maxAttempts,
      startKind: plan.kind,
      boosted,
    });

    if (!plan.canStart) {
      this.toast(plan.reason === "booster_disabled" ? "Boosters are disabled." : "No daily attempts left today.");
      return;
    }

    let boosterGranted = false;

    if (plan.needsBoosterRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_START_BOOSTER);
      if (!(res.ok && res.rewarded)) {
        this.toast("Rewarded booster not granted.");
        return;
      }
      boosterGranted = true;
    }

    if (plan.needsAttemptRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_ATTEMPT);
      if (!(res.ok && res.rewarded)) {
        this.toast("Rewarded attempt not granted.");
        return;
      }
    }

    const next = consumeDailyAttempt(this.saveManager.get(), dateUtc);
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ATTEMPT_USED, {
      dateUtc,
      rewarded: plan.attemptWasRewarded,
      attemptsUsed: next.daily.attemptsUsed,
      boosted,
      startKind: plan.kind,
    });

    if (boosterGranted) this.registry.set("pendingStartBooster", true);
    this.scene.start("game", { mode: "daily" });
    this.scene.launch("ui");
  }

  private async setVisualQuality(quality: SaveData["settings"]["visualQuality"]): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, visualQuality: quality } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
  }

  private async setAudioVolume(key: "sfxVolume" | "musicVolume", value: number): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, [key]: value } };
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());
    this.saveData = this.saveManager.get();
  }

  private toast(msg: string): void {
    const { width, height } = this.scale;
    if (this.toastText) this.toastText.destroy();
    this.toastText = this.add.text(width / 2, height * 0.93, msg, { fontSize: "14px", color: "#d9f2ff" }).setOrigin(0.5);
    this.time.delayedCall(1500, () => {
      this.toastText?.destroy();
      this.toastText = null;
    });
  }
}

function snapVolumeStep(value: number): number {
  let best: number = VOLUME_STEPS[0];
  let bestDiff = Math.abs(value - best);
  for (const step of VOLUME_STEPS) {
    const diff = Math.abs(value - step);
    if (diff < bestDiff) {
      best = step;
      bestDiff = diff;
    }
  }
  return best;
}

function nextVolumeStep(current: number): number {
  const idx = VOLUME_STEPS.indexOf(snapVolumeStep(current) as (typeof VOLUME_STEPS)[number]);
  return VOLUME_STEPS[(idx + 1) % VOLUME_STEPS.length]!;
}

function formatVolumeLabel(prefix: "SFX" | "MUSIC", value: number): string {
  return `${prefix}: ${formatToastVolume(value)}`;
}

function formatToastVolume(value: number): string {
  return value <= 0 ? "OFF" : `${Math.round(value * 100)}%`;
}
