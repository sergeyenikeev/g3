import Phaser from "phaser";
import type { AnalyticsAdapter } from "../../analytics/analyticsAdapter";
import { ANALYTICS_EVENTS } from "../../analytics/eventNames";
import type { StaticGameData } from "../../data/staticGameData";
import { getUtcYyyymmdd, pickDailyVariant } from "../daily/daily";
import { consumeDailyAttempt, getDailyAttemptsInfo, normalizeDailySave, planDailyStart, type DailyAttemptsInfo } from "../daily/dailyAttempts";
import { getMetaNodeCost, getMetaNodeLevel, getMetaWalletAmount, purchaseMetaNode } from "../meta/metaProgression";
import type { AdsManager } from "../../platform/ads/adsManager";
import { AD_PLACEMENTS } from "../../platform/ads/placements";
import type { SaveData } from "../../platform/save/saveManager";
import type { SaveManager } from "../../platform/save/saveManager";
import {
  type LanguageSetting,
  type Locale,
  formatNumber,
  formatQualityLabel,
  formatResource,
  formatVolume,
  getDailyVariantCopy,
  getLanguageSettingLabel,
  getMetaNodeDescription,
  getMetaNodeName,
  normalizeLanguageSetting,
  resolveLocale,
  t,
} from "../../i18n/localization";

const VOLUME_STEPS = [0, 0.3, 0.6, 0.8, 1] as const;

export class MenuScene extends Phaser.Scene {
  private staticData!: StaticGameData;
  private ads!: AdsManager;
  private analytics!: AnalyticsAdapter;
  private saveManager!: SaveManager;
  private saveData: SaveData | null = null;
  private toastText: Phaser.GameObjects.Text | null = null;
  private walletText: Phaser.GameObjects.Text | null = null;
  private workshopDim!: Phaser.GameObjects.Rectangle;
  private workshopBox!: Phaser.GameObjects.Container;
  private workshopWalletText!: Phaser.GameObjects.Text;
  private workshopHintText!: Phaser.GameObjects.Text;
  private workshopFooterText!: Phaser.GameObjects.Text;
  private workshopCards: Phaser.GameObjects.Container[] = [];
  private workshopBusy = false;
  private locale: Locale = "en";
  private languageSetting: LanguageSetting = "auto";

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
    this.languageSetting = normalizeLanguageSetting(save?.settings?.language);
    this.locale = resolveLocale(this.languageSetting);
    this.registry.set("languageSetting", this.languageSetting);
    this.registry.set("locale", this.locale);
    const stats = save?.stats ?? { bestWave: 0, bestBolts: 0 };
    const boosterCfg = this.staticData.balances.ads?.rewarded?.startBooster;
    const boosterEnabled = Boolean(boosterCfg?.enabled);

    const title = this.add
      .text(0, 0, t(this.locale, "app.title"), {
        fontSize: "42px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0.5);

    const bestText = this.add
      .text(
        0,
        0,
        t(this.locale, "menu.best", {
          bestWave: formatNumber(this.locale, stats.bestWave),
          bestBolts: formatNumber(this.locale, stats.bestBolts),
        }),
        {
        fontSize: "16px",
        color: "#98b7c7",
        }
      )
      .setOrigin(0.5);

    this.walletText = this.add
      .text(0, 0, "", {
        fontSize: "14px",
        color: "#d9f2ff",
        fontStyle: "700",
      })
      .setOrigin(0, 0);

    const btnWorkshop = this.add
      .rectangle(0, 0, 196, 40, 0x0f1720, 0.95)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffd166, 0.82)
      .setInteractive({ useHandCursor: true });
    const labelWorkshop = this.add
      .text(0, 0, t(this.locale, "menu.workshop"), {
        fontSize: "16px",
        color: "#d9f2ff",
        fontStyle: "700",
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

    const btnLanguage = this.add
      .rectangle(0, 0, 168, 34, 0x121a24, 0.9)
      .setOrigin(1, 0)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelLanguage = this.add
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
    const languageOrder: LanguageSetting[] = ["auto", "ru", "en"];

    const applyQualityLabel = (q: SaveData["settings"]["visualQuality"]) => {
      const label = formatQualityLabel(this.locale, q);
      labelQuality.setText(`${t(this.locale, "settings.gfx")}: ${label}`);
      const stroke = q === "low" ? 0x6e7a86 : q === "medium" ? 0x2d7bff : q === "high" ? 0x3af2ff : 0x3aa4d4;
      btnQuality.setStrokeStyle(2, stroke, 0.8);
    };
    const applyVolumeLabel = (
      button: Phaser.GameObjects.Rectangle,
      label: Phaser.GameObjects.Text,
      prefixKey: "settings.sfx" | "settings.music",
      value: number
    ) => {
      label.setText(formatVolumeLabel(this.locale, prefixKey, value));
      const stroke = value <= 0 ? 0x5f6b76 : prefixKey === "settings.sfx" ? 0x3aa4d4 : 0x57c27d;
      button.setStrokeStyle(2, stroke, value <= 0 ? 0.55 : 0.8);
    };
    const applyLanguageLabel = (setting: LanguageSetting) => {
      labelLanguage.setText(`${t(this.locale, "settings.language")}: ${getLanguageSettingLabel(this.locale, setting)}`);
      const stroke = setting === "auto" ? 0xffd166 : setting === "ru" ? 0x57c27d : 0x5cc8ff;
      btnLanguage.setStrokeStyle(2, stroke, 0.82);
    };
    applyQualityLabel(qualityPref);
    applyVolumeLabel(btnSfx, labelSfx, "settings.sfx", sfxVolume);
    applyVolumeLabel(btnMusic, labelMusic, "settings.music", musicVolume);
    applyLanguageLabel(this.languageSetting);

    btnQuality.on("pointerdown", () => {
      const idx = order.indexOf(qualityPref);
      const next = order[(idx + 1) % order.length]!;
      void this.setVisualQuality(next).then(() => {
        qualityPref = next;
        applyQualityLabel(next);
        this.toast(t(this.locale, "toast.graphics", { value: formatQualityLabel(this.locale, next) }));
      });
    });

    btnSfx.on("pointerdown", () => {
      const next = nextVolumeStep(sfxVolume);
      void this.setAudioVolume("sfxVolume", next).then(() => {
        sfxVolume = next;
        applyVolumeLabel(btnSfx, labelSfx, "settings.sfx", next);
        this.toast(t(this.locale, "toast.sfx", { value: formatVolume(this.locale, next) }));
      });
    });

    btnMusic.on("pointerdown", () => {
      const next = nextVolumeStep(musicVolume);
      void this.setAudioVolume("musicVolume", next).then(() => {
        musicVolume = next;
        applyVolumeLabel(btnMusic, labelMusic, "settings.music", next);
        this.toast(t(this.locale, "toast.music", { value: formatVolume(this.locale, next) }));
      });
    });

    btnLanguage.on("pointerdown", () => {
      const idx = languageOrder.indexOf(this.languageSetting);
      const next = languageOrder[(idx + 1) % languageOrder.length]!;
      void this.setLanguage(next).then(() => {
        this.languageSetting = next;
        this.locale = resolveLocale(next);
        this.registry.set("languageSetting", next);
        this.registry.set("locale", this.locale);
        this.scene.restart();
      });
    });

    const btnPlay = this.add
      .rectangle(0, 0, 280, 64, 0x1b2635)
      .setStrokeStyle(2, 0x5cc8ff, 0.9)
      .setInteractive({ useHandCursor: true });
    const labelPlay = this.add
      .text(0, 0, t(this.locale, "menu.play"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
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
      .text(0, 0, t(this.locale, "menu.playBoost"), { fontSize: "16px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnPlayBoost.setVisible(boosterEnabled);
    labelPlayBoost.setVisible(boosterEnabled);
    btnPlayBoost.on("pointerdown", () => void this.startRunBoosted());

    const btnTraining = this.add
      .rectangle(0, 0, 280, 46, 0x0f1720, 0.95)
      .setStrokeStyle(2, 0xffd166, 0.78)
      .setInteractive({ useHandCursor: true });
    const labelTraining = this.add
      .text(0, 0, t(this.locale, "menu.training"), { fontSize: "18px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    btnTraining.on("pointerdown", () => {
      this.scene.start("game", { mode: "tutorial" });
      this.scene.launch("ui");
    });

    btnWorkshop.on("pointerdown", () => this.showWorkshop());

    const btnDaily = this.add
      .rectangle(0, 0, 280, 56, 0x121a24)
      .setStrokeStyle(2, 0x3aa4d4, 0.8)
      .setInteractive({ useHandCursor: true });
    const labelDaily = this.add
      .text(0, 0, t(this.locale, "menu.daily"), { fontSize: "18px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);

    const btnDailyBoost = this.add
      .rectangle(0, 0, 280, 46, 0x0f1720, 0.95)
      .setStrokeStyle(2, 0x57c27d, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelDailyBoost = this.add
      .text(0, 0, t(this.locale, "menu.dailyBoost"), {
        fontSize: "13px",
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
      .text(0, 0, t(this.locale, "menu.controls"), {
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
        regularPlan.canStart
          ? regularPlan.kind === "free"
            ? t(this.locale, "menu.dailyFree")
            : t(this.locale, "menu.dailyRewarded")
          : t(this.locale, "menu.dailyLocked")
      );
      applyDailyButtonState(btnDaily, labelDaily, regularPlan.canStart, regularPlan.kind === "rewarded" ? 0x57c27d : 0x3aa4d4);

      if (!boosterEnabled) return;

      labelDailyBoost.setText(
        boostedPlan.canStart
          ? boostedPlan.kind === "boosted_rewarded"
            ? t(this.locale, "menu.dailyBoostExtra")
            : t(this.locale, "menu.dailyBoost")
          : t(this.locale, "menu.dailyBoostLocked")
      );
      applyDailyButtonState(btnDailyBoost, labelDailyBoost, boostedPlan.canStart, 0x57c27d);
    };

    btnDaily.on("pointerdown", () => void this.startDaily(false));
    btnDailyBoost.on("pointerdown", () => void this.startDaily(true));
    this.createWorkshopUi();

    const layoutMenu = (s: { width: number; height: number }) => {
      title.setPosition(s.width / 2, s.height * 0.25);
      bestText.setPosition(s.width / 2, s.height * 0.36);
      this.walletText?.setPosition(16, 16);
      btnWorkshop.setPosition(16, 46);
      labelWorkshop.setPosition(btnWorkshop.x + btnWorkshop.width / 2, btnWorkshop.y + btnWorkshop.height / 2);

      btnQuality.setPosition(s.width - 16, 16);
      labelQuality.setPosition(btnQuality.x - btnQuality.width / 2, btnQuality.y + btnQuality.height / 2);
      btnSfx.setPosition(s.width - 16, 56);
      labelSfx.setPosition(btnSfx.x - btnSfx.width / 2, btnSfx.y + btnSfx.height / 2);
      btnMusic.setPosition(s.width - 16, 96);
      labelMusic.setPosition(btnMusic.x - btnMusic.width / 2, btnMusic.y + btnMusic.height / 2);
      btnLanguage.setPosition(s.width - 16, 136);
      labelLanguage.setPosition(btnLanguage.x - btnLanguage.width / 2, btnLanguage.y + btnLanguage.height / 2);

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
      this.layoutWorkshop();
    };

    const onResize = (s: Phaser.Structs.Size) => layoutMenu(s);
    this.scale.on("resize", onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize);
    });

    layoutMenu(this.scale);
    this.refreshWalletSummary();
    void this.ensureDailyNormalizedAndRefresh(dailyInfo).then((info) => refreshDailyButtons(info));
  }

  private createWorkshopUi(): void {
    this.workshopDim = this.add
      .rectangle(0, 0, 10, 10, 0x000000, 0.74)
      .setOrigin(0, 0)
      .setDepth(1400)
      .setScrollFactor(0)
      .setInteractive();
    this.workshopDim.setVisible(false);
    this.workshopDim.on("pointerdown", () => this.hideWorkshop());

    const panel = this.add.rectangle(0, 0, 620, 760, 0x0f1720, 0.98).setStrokeStyle(2, 0x5cc8ff, 0.9);
    const title = this.add
      .text(0, -338, t(this.locale, "menu.workshop"), { fontSize: "28px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    this.workshopWalletText = this.add
      .text(-270, -304, "", { fontSize: "16px", color: "#d9f2ff", fontStyle: "700", wordWrap: { width: 540 } })
      .setOrigin(0, 0);
    this.workshopHintText = this.add
      .text(-270, -270, t(this.locale, "menu.workshopHint"), {
        fontSize: "13px",
        color: "#98b7c7",
        wordWrap: { width: 540 },
      })
      .setOrigin(0, 0);

    const btnClose = this.add
      .rectangle(260, -338, 72, 34, 0x121a24, 0.95)
      .setStrokeStyle(2, 0x3aa4d4, 0.75)
      .setInteractive({ useHandCursor: true });
    const labelClose = this.add
      .text(260, -338, t(this.locale, "menu.close"), { fontSize: "12px", color: "#d9f2ff", fontStyle: "700" })
      .setOrigin(0.5);
    btnClose.on("pointerdown", () => this.hideWorkshop());

    this.workshopFooterText = this.add
      .text(-270, 332, t(this.locale, "menu.workshopFooter"), {
        fontSize: "12px",
        color: "#98b7c7",
        wordWrap: { width: 540 },
      })
      .setOrigin(0, 0);

    this.workshopBox = this.add
      .container(0, 0, [panel, title, this.workshopWalletText, this.workshopHintText, btnClose, labelClose, this.workshopFooterText])
      .setDepth(1401)
      .setScrollFactor(0);
    this.workshopBox.setVisible(false);
  }

  private layoutWorkshop(): void {
    if (!this.workshopDim || !this.workshopBox) return;
    const { width, height } = this.scale;
    this.workshopDim.setSize(width, height);
    this.workshopBox.setPosition(width / 2, height / 2);
  }

  private showWorkshop(): void {
    this.refreshWorkshopSummary();
    this.workshopDim.setVisible(true);
    this.workshopBox.setVisible(true);
    this.layoutWorkshop();
  }

  private hideWorkshop(): void {
    this.workshopDim.setVisible(false);
    this.workshopBox.setVisible(false);
  }

  private refreshWalletSummary(): void {
    const save = this.saveManager.get();
    this.saveData = save;
    const wallet = save.meta.wallet;
    this.walletText?.setText(
      t(this.locale, "menu.wallet", {
        bolts: formatResource(this.locale, "bolts", wallet.bolts ?? 0),
        cores: formatResource(this.locale, "cores", wallet.cores ?? 0),
      })
    );
  }

  private refreshWorkshopSummary(): void {
    const save = this.saveManager.get();
    this.saveData = save;
    this.refreshWalletSummary();

    this.workshopWalletText.setText(
      t(this.locale, "menu.stockpile", {
        bolts: formatResource(this.locale, "bolts", getMetaWalletAmount(save, "bolts")),
        cores: formatResource(this.locale, "cores", getMetaWalletAmount(save, "cores")),
      })
    );
    this.workshopHintText.setText(buildInstalledMetaSummary(this.locale, this.staticData.metaTree.nodes, save.meta.nodeLevels));

    for (const card of this.workshopCards) card.destroy();
    this.workshopCards = [];

    this.staticData.metaTree.nodes.forEach((node, idx) => {
      const level = getMetaNodeLevel(save, node.id);
      const cost = getMetaNodeCost(this.staticData.metaTree, node.id, level);
      const currencyAmount = cost ? getMetaWalletAmount(save, cost.currency) : 0;
      const costAmount = cost?.amount ?? Number.POSITIVE_INFINITY;
      const affordable = Boolean(cost) && currencyAmount >= costAmount;
      const maxed = level >= node.maxLevel || !cost;
      const y = -172 + idx * 104;

      const bg = this.add.rectangle(0, 0, 548, 86, 0x121a24, 0.96).setStrokeStyle(2, maxed ? 0x57c27d : 0x3aa4d4, 0.74);
      const title = this.add
        .text(-256, -28, getMetaNodeName(this.locale, node.id, node.name), {
          fontSize: "17px",
          color: "#d9f2ff",
          fontStyle: "700",
          wordWrap: { width: 330 },
        })
        .setOrigin(0, 0);
      const desc = this.add
        .text(-256, -2, getMetaNodeDescription(this.locale, node.id), {
          fontSize: "13px",
          color: "#98b7c7",
          wordWrap: { width: 330 },
        })
        .setOrigin(0, 0);
      const levelText = this.add
        .text(-256, 24, t(this.locale, "menu.level", { level, maxLevel: node.maxLevel }), {
          fontSize: "12px",
          color: maxed ? "#57c27d" : "#7fdfff",
          fontStyle: "700",
        })
        .setOrigin(0, 0);

      const btn = this.add
        .rectangle(180, 0, 130, 42, affordable ? 0x1b2635 : 0x0d131b, 0.98)
        .setStrokeStyle(2, maxed ? 0x57c27d : affordable ? 0xffd166 : 0x5f6b76, 0.86);
      const priceLabel = cost ? formatResource(this.locale, cost.currency, cost.amount) : t(this.locale, "menu.maxed");
      const btnLabel = this.add
        .text(
          180,
          -8,
          maxed ? t(this.locale, "menu.installedButton") : affordable ? t(this.locale, "menu.buy") : t(this.locale, "menu.locked"),
          { fontSize: "13px", color: "#d9f2ff", fontStyle: "700" }
        )
        .setOrigin(0.5);
      const costLabel = this.add
        .text(180, 12, priceLabel, { fontSize: "11px", color: maxed ? "#57c27d" : affordable ? "#ffd166" : "#98b7c7", fontStyle: "700" })
        .setOrigin(0.5);

      if (!maxed && affordable) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => void this.buyMetaNode(node.id));
      }

      const card = this.add.container(0, y, [bg, title, desc, levelText, btn, btnLabel, costLabel]).setDepth(1402);
      this.workshopCards.push(card);
      this.workshopBox.add(card);
    });
  }

  private async buyMetaNode(nodeId: string): Promise<void> {
    if (this.workshopBusy) return;
    this.workshopBusy = true;
    try {
      const save = this.saveManager.get();
      const result = purchaseMetaNode(this.staticData.metaTree, save, nodeId);
      if (!result.ok) {
        this.toast(result.reason === "insufficient_funds" ? t(this.locale, "menu.notEnough") : t(this.locale, "menu.upgradeUnavailable"));
        return;
      }

      await this.saveManager.save(result.save);
      this.registry.set("saveData", this.saveManager.get());
      this.saveData = this.saveManager.get();
      this.refreshWorkshopSummary();
      this.toast(
        t(this.locale, "menu.installedToast", {
          name: getMetaNodeName(this.locale, nodeId, nodeId),
          cost: formatResource(this.locale, result.cost.currency, result.cost.amount),
        })
      );
    } finally {
      this.workshopBusy = false;
    }
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
    const copy = getDailyVariantCopy(this.locale, sel.variantId, variant?.ui?.title ?? sel.variantId, variant?.ui?.desc ?? "");

    const info = getDailyAttemptsInfo(this.staticData.daily, this.saveData, dateUtc);
    const best =
      this.saveData.daily.lastDateUtc === dateUtc
        ? t(this.locale, "menu.bestToday", {
            wave: formatNumber(this.locale, this.saveData.daily.bestWave),
            bolts: formatNumber(this.locale, this.saveData.daily.bestBolts),
          })
        : t(this.locale, "menu.bestNone");
    const nextStartLine =
      info.canStartFree
        ? t(this.locale, "menu.nextDailyFree")
        : info.canStartRewarded
          ? t(this.locale, "menu.nextDailyRewarded")
          : t(this.locale, "menu.nextDailyUnavailable");
    const boostedLine = !this.staticData.balances.ads?.rewarded?.startBooster?.enabled
      ? t(this.locale, "menu.boostDailyDisabled")
      : info.canStartFree
        ? t(this.locale, "menu.boostDailyFree")
        : info.canStartRewarded
          ? t(this.locale, "menu.boostDailyRewarded")
          : t(this.locale, "menu.boostDailyUnavailable");
    dailyInfoText.setText(
      [
        `${t(this.locale, "menu.seedLine", { seed: dateUtc })} | ${copy.title}`,
        copy.desc,
        t(this.locale, "menu.attemptsLine", {
          used: formatNumber(this.locale, info.attemptsUsed),
          max: formatNumber(this.locale, info.maxAttempts),
          best,
        }),
        nextStartLine,
        boostedLine,
      ]
        .filter(Boolean)
        .join("\n")
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

    this.toast(t(this.locale, "menu.rewardedBoosterDenied"));
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
      this.toast(plan.reason === "booster_disabled" ? t(this.locale, "menu.boosterDisabled") : t(this.locale, "menu.noDailyAttempts"));
      return;
    }

    let boosterGranted = false;

    if (plan.needsBoosterRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_START_BOOSTER);
      if (!(res.ok && res.rewarded)) {
        this.toast(t(this.locale, "menu.rewardedBoosterDenied"));
        return;
      }
      boosterGranted = true;
    }

    if (plan.needsAttemptRewarded) {
      const res = await this.ads.showRewarded(AD_PLACEMENTS.DAILY_ATTEMPT);
      if (!(res.ok && res.rewarded)) {
        this.toast(t(this.locale, "menu.rewardedAttemptDenied"));
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

  private async setLanguage(language: LanguageSetting): Promise<void> {
    const save = this.saveManager.get();
    const next: SaveData = { ...save, settings: { ...save.settings, language } };
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

function formatVolumeLabel(locale: Locale, prefixKey: "settings.sfx" | "settings.music", value: number): string {
  return `${t(locale, prefixKey)}: ${formatVolume(locale, value)}`;
}

function buildInstalledMetaSummary(
  locale: Locale,
  nodes: Array<{ id: string; name: string }>,
  levels: Record<string, number>
): string {
  const active = nodes
    .map((node) => ({ node, level: Math.max(0, Math.floor(levels[node.id] ?? 0)) }))
    .filter((entry) => entry.level > 0)
    .map((entry) => `${getMetaNodeName(locale, entry.node.id, entry.node.name)} ${locale === "ru" ? "ур." : "Lv."}${entry.level}`);

  return active.length > 0
    ? t(locale, "menu.installedList", { items: active.join(" | ") })
    : t(locale, "menu.installedNone");
}
