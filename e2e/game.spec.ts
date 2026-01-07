import { test, expect } from "@playwright/test";

test("smoke: daily, tutorial, upgrade, results x2", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));

  await page.addInitScript(() => {
    localStorage.clear();
  });

  await page.goto("/");
  await page.waitForSelector("canvas");

  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

  const vp = page.viewportSize();
  expect(vp).toBeTruthy();
  const width = vp!.width;
  const height = vp!.height;

  // DAILY
  await page.mouse.click(width / 2, height * 0.72);

  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return s?.mode === "daily";
  });

  // UI active
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("ui") === true);

  // Daily attempt consumed
  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const save = g?.registry?.get("saveData");
    return save?.daily?.attemptsUsed === 1;
  });

  // Skip tutorial
  await page.mouse.click(width / 2 + 220, 78);

  // Flip
  await page.keyboard.press("Space");

  // Move to recycler
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");

  // Bank => bolts > 0
  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return Boolean(s && typeof s.bolts === "number" && s.bolts > 0);
  });

  // Upgrade screen
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === true);

  // Pick first upgrade to resume game
  await page.mouse.click(width / 2, height * 0.36);
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === false);

  const boltsBefore = await page.evaluate(() => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return typeof s?.bolts === "number" ? s.bolts : null;
  });
  expect(typeof boltsBefore).toBe("number");

  // Force end run (VITE_E2E API; works even if game is paused by upgrade)
  await page.waitForFunction(() => typeof (window as any).__MC_E2E__?.endRun === "function");
  await page.evaluate(() => (window as any).__MC_E2E__.endRun());
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("results") === true);

  // X2 results (rewarded)
  await page.mouse.click(width / 2, height * 0.52);
  await page.waitForFunction((before) => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return typeof s?.bolts === "number" && s.bolts === before * 2;
  }, boltsBefore);

  expect(errors, "page errors").toEqual([]);
});
