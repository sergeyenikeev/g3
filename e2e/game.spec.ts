import { expect, test, type Page } from "@playwright/test";

function makeGrowingSave(language: "ru" | "en" = "ru") {
  return {
    v: 1,
    settings: {
      sfxVolume: 0.8,
      musicVolume: 0.6,
      visualQuality: "auto",
      language,
      pilotName: language === "ru" ? "RIG-24" : "AXLE-7",
    },
    tutorial: {
      completed: true,
      skipped: false,
    },
    meta: {
      nodeLevels: {
        meta_frame_1: 1,
        meta_core_1: 1,
        meta_coil_1: 1,
      },
      wallet: {
        bolts: 220,
        cores: 2,
      },
    },
    stats: {
      bestWave: 11,
      bestBolts: 180,
      runsCompleted: 4,
    },
    ads: {
      lastInterstitialAtMs: 0,
      lastRewardedAtMs: 0,
      rewardedChainCount: 0,
      lastFrustrationAtMs: 0,
      lastRunStartedAtMs: 0,
      lastRunDurationSec: 0,
      interstitialDateUtc: null,
      interstitialsShownToday: 0,
    },
    loginRewards: {
      lastClaimDateUtc: "2026-04-16",
      day: 2,
    },
    liveops: {
      firstSeenDateUtc: "2026-04-10",
      lastSeenDateUtc: "2026-04-16",
      sessionsStarted: 4,
      lastReturnGapDays: 0,
      activation: {
        firstScrapTracked: true,
        firstBankTracked: true,
        firstUpgradeTracked: true,
      },
      onboarding: {
        freeBoostsUsed: 1,
      },
      streak: {
        day: 2,
        claimedDateUtc: "2026-04-16",
      },
      comeback: {
        lastClaimDateUtc: null,
        lastEligibleGapDays: 0,
      },
      missions: {
        daily: {
          dateUtc: "2026-04-16",
          progress: {},
          claimedIds: [],
        },
        weekly: {
          weekKey: "2026-W16",
          progress: {},
          claimedIds: [],
        },
      },
      claimedEventRewardIds: [],
      weeklyLeaderboard: {
        weekKey: "2026-W16",
        entries: [],
        highestDivision: "scrapper",
        claimedRewardDivisions: [],
        claimedRewardWeekKeys: [],
      },
    },
    daily: {
      lastDateUtc: "2026-04-16",
      attemptsUsed: 0,
      bestWave: 0,
      bestBolts: 0,
    },
    leaderboard: {
      entries: [],
      highestDivision: "raider",
      claimedRewardDivisions: [],
      claimedMilestones: [],
    },
  };
}

async function clearStorageAndReload(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    window.location.reload();
  });
  await page.waitForSelector("canvas");
}

async function seedSaveAndReload(page: Page, save: ReturnType<typeof makeGrowingSave>) {
  await page.evaluate((payload) => {
    const raw = JSON.stringify(payload);
    localStorage.setItem("magnet-caravan:save-mirror", raw);
    localStorage.setItem("magnet-caravan:platform-save", raw);
    window.location.reload();
  }, save);
  await page.waitForSelector("canvas");
}

async function clickMenuText(page: Page, fragments: string[]) {
  const target = await page.evaluate((parts) => {
    const menu = (window as any).__MC_GAME__?.scene?.keys?.menu;
    if (!menu) return null;
    const normalizedParts = parts.map((part) => part.toLowerCase());
    const texts = menu.children.list
      .filter((obj: any) => obj?.type === "Text" && obj.visible)
      .map((obj: any) => ({
        text: String(obj.text ?? ""),
        x: Number(obj.x ?? 0),
        y: Number(obj.y ?? 0),
      }));
    return texts.find((entry: { text: string }) => normalizedParts.some((part) => entry.text.toLowerCase().includes(part))) ?? null;
  }, fragments);

  expect(target, `menu text not found for: ${fragments.join(", ")}`).toBeTruthy();
  await page.mouse.click(target!.x, target!.y);
}

async function clickTopRightMenuButton(page: Page, viewportWidth: number) {
  const target = await page.evaluate((width) => {
    const menu = (window as any).__MC_GAME__?.scene?.keys?.menu;
    if (!menu) return null;
    const texts = menu.children.list
      .filter((obj: any) => obj?.type === "Text" && obj.visible)
      .map((obj: any) => ({
        text: String(obj.text ?? ""),
        x: Number(obj.x ?? 0),
        y: Number(obj.y ?? 0),
      }))
      .filter((entry: { x: number; y: number }) => Number.isFinite(entry.x) && Number.isFinite(entry.y) && entry.y < 80 && entry.x > width * 0.6)
      .sort((a: { x: number }, b: { x: number }) => b.x - a.x);
    return texts[0] ?? null;
  }, viewportWidth);

  expect(target, "top-right menu button not found").toBeTruthy();
  await page.mouse.click(target!.x, target!.y);
}

async function waitForVisibleMenuText(page: Page, fragments: string[], visible: boolean) {
  await page.waitForFunction(
    ({ parts, expectedVisible }) => {
      const menu = (window as any).__MC_GAME__?.scene?.keys?.menu;
      if (!menu) return false;
      const normalizedParts = parts.map((part: string) => part.toLowerCase());
      const matches = menu.children.list.some((obj: any) => {
        if (obj?.type !== "Text" || !obj.visible) return false;
        const text = String(obj.text ?? "").toLowerCase();
        return normalizedParts.some((part: string) => text.includes(part));
      });
      return matches === expectedVisible;
    },
    { parts: fragments, expectedVisible: visible },
    { timeout: 2_000 }
  );
}

async function expectVisibleSceneTextInBounds(page: Page, sceneKey: string, viewport: { width: number; height: number }) {
  const offenders = await page.evaluate(
    ({ key, width, height }) => {
      const scene = (window as any).__MC_GAME__?.scene?.keys?.[key];
      if (!scene) return [{ text: `scene:${key}:missing`, left: -1, right: -1, top: -1, bottom: -1 }];
      const texts = scene.children?.list?.filter((obj: any) => obj?.type === "Text" && obj.visible && obj.active && String(obj.text ?? "").trim().length > 0) ?? [];
      return texts
        .map((obj: any) => {
          const bounds = typeof obj.getBounds === "function" ? obj.getBounds() : null;
          return {
            text: String(obj.text ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
            left: Number(bounds?.x ?? NaN),
            right: Number((bounds?.x ?? 0) + (bounds?.width ?? 0)),
            top: Number(bounds?.y ?? NaN),
            bottom: Number((bounds?.y ?? 0) + (bounds?.height ?? 0)),
          };
        })
        .filter((entry: any) => {
          if (![entry.left, entry.right, entry.top, entry.bottom].every(Number.isFinite)) return true;
          return entry.left < -6 || entry.top < -6 || entry.right > width + 6 || entry.bottom > height + 6;
        });
    },
    { key: sceneKey, width: viewport.width, height: viewport.height }
  );

  expect(offenders, `${sceneKey} has visible text outside viewport`).toEqual([]);
}

async function pickUpgradeCard(page: Page) {
  const targets = await page.evaluate(() => {
    const upgrade = (window as any).__MC_GAME__?.scene?.keys?.upgrade;
    const cards = Array.isArray(upgrade?.cards) ? upgrade.cards : [];
    return cards
      .filter((card: any) => card?.visible && card?.active)
      .map((card: any) => ({
        x: Number(card.x ?? 0),
        y: Number(card.y ?? 0),
      }))
      .filter((card: { x: number; y: number }) => Number.isFinite(card.x) && Number.isFinite(card.y))
      .sort((a: { y: number }, b: { y: number }) => a.y - b.y);
  });

  expect(targets.length, "upgrade cards not found").toBeGreaterThan(0);

  for (const target of targets) {
    await page.mouse.click(target.x, target.y);
    try {
      await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === false, null, {
        timeout: 1_500,
      });
      return;
    } catch {
      // try the next card
    }
  }

  throw new Error("Unable to dismiss upgrade scene");
}

test("smoke: staged menu, training, daily, upgrade, results", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));

  await page.goto("/");
  await page.waitForSelector("canvas");
  await clearStorageAndReload(page);
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

  const vp = page.viewportSize();
  expect(vp).toBeTruthy();
  const width = vp!.width;
  const height = vp!.height;

  await clickMenuText(page, ["training", "обуч"]);
  await page.waitForFunction(() => {
    const runState = (window as any).__MC_GAME__?.registry?.get("runState");
    return runState?.mode === "tutorial";
  });
  await page.mouse.click(width / 2 + 220, 78);
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

  await seedSaveAndReload(page, makeGrowingSave());
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

  await clickMenuText(page, ["daily", "ежеднев"]);
  await page.waitForFunction(() => {
    const runState = (window as any).__MC_GAME__?.registry?.get("runState");
    return runState?.mode === "daily";
  });
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("ui") === true);

  await page.waitForFunction(() => {
    const save = (window as any).__MC_GAME__?.registry?.get("saveData");
    return save?.daily?.attemptsUsed === 1;
  });

  await page.keyboard.press("Space");
  await page.waitForFunction(() => {
    const cooldown = (window as any).__MC_GAME__?.registry?.get("flipCooldown");
    return typeof cooldown === "number" && cooldown > 0;
  });

  await page.keyboard.press("Shift");
  await page.waitForFunction(() => {
    const cooldown = (window as any).__MC_GAME__?.registry?.get("dashCooldown");
    return typeof cooldown === "number" && cooldown > 0;
  });

  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");

  await page.waitForFunction(() => {
    const runState = (window as any).__MC_GAME__?.registry?.get("runState");
    return Boolean(runState && typeof runState.bolts === "number" && runState.bolts > 0);
  });

  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === true);
  await pickUpgradeCard(page);

  await page.waitForFunction(() => typeof (window as any).__MC_E2E__?.endRun === "function");
  await page.evaluate(() => (window as any).__MC_E2E__.endRun());
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("results") === true);

  expect(errors, "page errors").toEqual([]);
});

test.describe("moderation smoke: compact viewport", () => {
  test.use({ viewport: { width: 680, height: 380 } });

  for (const locale of ["ru", "en"] as const) {
    test(`compact viewport stays readable (${locale})`, async ({ page }) => {
      const errors: Error[] = [];
      page.on("pageerror", (error) => errors.push(error));

      await page.goto("/");
      await page.waitForSelector("canvas");
      await seedSaveAndReload(page, makeGrowingSave(locale));
      await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

      const vp = page.viewportSize();
      expect(vp).toBeTruthy();
      const viewport = { width: vp!.width, height: vp!.height };

      await expectVisibleSceneTextInBounds(page, "menu", viewport);
      await waitForVisibleMenuText(page, ["close", "закры"], false);
      await clickTopRightMenuButton(page, viewport.width);
      await waitForVisibleMenuText(page, ["close", "закры"], true);
      await expectVisibleSceneTextInBounds(page, "menu", viewport);
      await page.mouse.click(40, Math.min(120, viewport.height - 40));
      await waitForVisibleMenuText(page, ["close", "закры"], false);

      await page.evaluate(() => {
        const menu = (window as any).__MC_GAME__?.scene?.keys?.menu;
        void menu?.startDaily?.(false);
      });
      await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("ui") === true);
      await expectVisibleSceneTextInBounds(page, "ui", viewport);

      await page.mouse.click(viewport.width - 74, 34);
      await page.waitForFunction(() => {
        const ui = (window as any).__MC_GAME__?.scene?.keys?.ui;
        return Boolean(ui?.settingsVisible);
      });
      await expectVisibleSceneTextInBounds(page, "ui", viewport);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => {
        const ui = (window as any).__MC_GAME__?.scene?.keys?.ui;
        return ui?.settingsVisible === false;
      });

      await page.evaluate(() => {
        const gameScene = (window as any).__MC_GAME__?.scene?.keys?.game;
        gameScene?.onWaveComplete?.();
      });
      await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === true);
      await expectVisibleSceneTextInBounds(page, "upgrade", viewport);
      await pickUpgradeCard(page);

      await page.waitForFunction(() => typeof (window as any).__MC_E2E__?.endRun === "function");
      await page.evaluate(() => (window as any).__MC_E2E__.endRun());
      await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("results") === true);
      await expectVisibleSceneTextInBounds(page, "results", viewport);

      expect(errors, "page errors").toEqual([]);
    });
  }
});
