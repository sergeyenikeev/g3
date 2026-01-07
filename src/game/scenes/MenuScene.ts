import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave } from "../daily/dailyAttempts";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { SaveData } from "../../platform/save/saveManager";
import type { SaveManager } from "../../platform/save/saveManager";

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
    const { width, height } = this.scale;
    this.staticData = this.registry.get("staticGameData") as StaticGameData;
    this.ads = this.registry.get("adsManager") as AdsManager;
    this.analytics = this.registry.get("analytics") as AnalyticsAdapter;
    this.saveManager = this.registry.get("saveManager") as SaveManager;
    this.saveData = (this.registry.get("saveData") as SaveData | undefined) ?? null;
    const save = this.saveData;

    this.add
      .text(width / 2, height * 0.35, "MAGNET CARAVAN", {
        fontSize: "42px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const btnPlay = this.add
      .rectangle(width / 2, height * 0.56, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(btnPlay.x, btnPlay.y, "PLAY", { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnPlay.on("pointerdown", () => {
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    });

    const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
    const boosterEnabled = Boolean(boosterCfg?.enabled);
    const btnPlayBoost = this.add
      .rectangle(width / 2, height * 0.64, 280, 52, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlayBoost = this.add
      .text(btnPlayBoost.x, btnPlayBoost.y, "PLAY + BOOST (Rewarded)", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnPlayBoost.setVisible(boosterEnabled);
    labelPlayBoost.setVisible(boosterEnabled);
    btnPlayBoost.on("pointerdown", () => void this.startRunBoosted());

    const btnDaily = this.add
      .rectangle(width / 2, height * 0.72, 280, 56, 0x121a24)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(btnDaily.x, btnDaily.y, "DAILY", { fontSize: "22px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const btnDailyBoost = this.add
      .rectangle(width / 2, height * 0.79, 280, 46, 0x0f1720, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelDailyBoost = this.add
      .text(btnDailyBoost.x, btnDailyBoost.y, "DAILY + BOOST (Rewarded)", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);
    btnDailyBoost.setVisible(boosterEnabled);
    labelDailyBoost.setVisible(boosterEnabled);

    const dailyInfo = this.add
      .text(width / 2, height * 0.86, "", { fontSize: "14px", color: "#98b7c7", align: "center", wordWrap: { width: 520 } })
      .setOrigin(0.5);

    btnDaily.on("pointerdown", () => void this.startDaily(false));
    btnDailyBoost.on("pointerdown", () => void this.startDaily(true));

    if (save) {
      this.add
        .text(width / 2, height * 0.48, `Best wave: ${save.stats.bestWave} | Best bolts: ${save.stats.bestBolts}`, {
          fontSize: "16px",
          color: "#98b7c7",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, height * 0.93, "WASD/Arrows: move | Space: flip", {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    void this.ensureDailyNormalizedAndRefresh(dailyInfo);

    this.scale.on("resize", (s: Phaser.Structs.Size) => {
      btnPlay.setPosition(s.width / 2, s.height * 0.56);
      labelPlay.setPosition(btnPlay.x, btnPlay.y);
      btnPlayBoost.setPosition(s.width / 2, s.height * 0.64);
      labelPlayBoost.setPosition(btnPlayBoost.x, btnPlayBoost.y);
      btnDaily.setPosition(s.width / 2, s.height * 0.72);
      labelDaily.setPosition(btnDaily.x, btnDaily.y);
      btnDailyBoost.setPosition(s.width / 2, s.height * 0.79);
      labelDailyBoost.setPosition(btnDailyBoost.x, btnDailyBoost.y);
      dailyInfo.setPosition(s.width / 2, s.height * 0.86);
    });
  }

  private async ensureDailyNormalizedAndRefresh(dailyInfoText: Phaser.GameObjects.Text): Promise<void> {
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
    dailyInfoText.setText(`Seed: ${dateUtc} | ${title}\n${desc}\nAttempts: ${info.attemptsUsed}/${info.maxAttempts} | ${best}`);
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

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ENTER, { dateUtc, attemptsUsed: info.attemptsUsed, maxAttempts: info.maxAttempts });

    if (!info.canStartFree && !info.canStartRewarded) {
      this.toast("No daily attempts left today.");
      return;
    }

    let attemptWasRewarded = false;
    let boosterGranted = false;

    if (boosted) {
      const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
      if (!boosterCfg?.enabled) {
        this.toast("Boosters are disabled.");
        return;
      }
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_START_BOOSTER);
      if (!(res.ok && res.rewarded)) {
        this.toast("Rewarded booster not granted.");
        return;
      }
      boosterGranted = true;
      attemptWasRewarded = !info.canStartFree;
    } else if (info.canStartRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_ATTEMPT);
      if (!(res.ok && res.rewarded)) {
        this.toast("Rewarded attempt not granted.");
        return;
      }
      attemptWasRewarded = true;
    }

    const next = consumeDailyAttempt(this.saveManager.get(), dateUtc);
    await this.saveManager.save(next);
    this.registry.set("saveData", this.saveManager.get());

    this.analytics.track(ANALYTICS_EVENTS.DAILY_ATTEMPT_USED, {
      dateUtc,
      rewarded: attemptWasRewarded,
      attemptsUsed: next.daily.attemptsUsed,
      boosted,
    });

    if (boosterGranted) this.registry.set("pendingStartBooster", true);
    this.scene.start("game", { mode: "daily" });
    this.scene.launch("ui");
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
