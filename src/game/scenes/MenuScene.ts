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
      .rectangle(width / 2, height * 0.62, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(btnPlay.x, btnPlay.y, "PLAY", { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnPlay.on("pointerdown", () => {
      this.scene.start("game", { mode: "run" });
      this.scene.launch("ui");
    });

    const btnDaily = this.add
      .rectangle(width / 2, height * 0.72, 280, 56, 0x121a24)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(btnDaily.x, btnDaily.y, "DAILY", { fontSize: "22px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const dailyInfo = this.add
      .text(width / 2, height * 0.78, "", { fontSize: "14px", color: "#98b7c7", align: "center", wordWrap: { width: 520 } })
      .setOrigin(0.5);

    btnDaily.on("pointerdown", () => void this.startDaily());

    if (save) {
      this.add
        .text(width / 2, height * 0.48, `Best wave: ${save.stats.bestWave} | Best bolts: ${save.stats.bestBolts}`, {
          fontSize: "16px",
          color: "#98b7c7",
        })
        .setOrigin(0.5);
    }

    this.add
      .text(width / 2, height * 0.9, "WASD/Arrows: move | Space: flip", {
        fontSize: "16px",
        color: "#98b7c7",
      })
      .setOrigin(0.5);

    void this.ensureDailyNormalizedAndRefresh(dailyInfo);

    this.scale.on("resize", (s: Phaser.Structs.Size) => {
      btnPlay.setPosition(s.width / 2, s.height * 0.62);
      labelPlay.setPosition(btnPlay.x, btnPlay.y);
      btnDaily.setPosition(s.width / 2, s.height * 0.72);
      labelDaily.setPosition(btnDaily.x, btnDaily.y);
      dailyInfo.setPosition(s.width / 2, s.height * 0.78);
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

  private async startDaily(): Promise<void> {
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

    if (info.canStartFree) {
      const next = consumeDailyAttempt(save, dateUtc);
      await this.saveManager.save(next);
      this.registry.set("saveData", this.saveManager.get());
      this.analytics.track(ANALYTICS_EVENTS.DAILY_ATTEMPT_USED, { dateUtc, rewarded: false, attemptsUsed: next.daily.attemptsUsed });
      this.scene.start("game", { mode: "daily" });
      this.scene.launch("ui");
      return;
    }

    if (info.canStartRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_ATTEMPT);
      if (res.ok && res.rewarded) {
        const next = consumeDailyAttempt(this.saveManager.get(), dateUtc);
        await this.saveManager.save(next);
        this.registry.set("saveData", this.saveManager.get());
        this.analytics.track(ANALYTICS_EVENTS.DAILY_ATTEMPT_USED, { dateUtc, rewarded: true, attemptsUsed: next.daily.attemptsUsed });
        this.scene.start("game", { mode: "daily" });
        this.scene.launch("ui");
        return;
      }
      this.toast("Rewarded attempt not granted.");
      return;
    }

    this.toast("No daily attempts left today.");
  }

  private toast(msg: string): void {
    const { width, height } = this.scale;
    if (this.toastText) this.toastText.destroy();
    this.toastText = this.add.text(width / 2, height * 0.9, msg, { fontSize: "14px", color: "#d9f2ff" }).setOrigin(0.5);
    this.time.delayedCall(1500, () => {
      this.toastText?.destroy();
      this.toastText = null;
    });
  }
}
