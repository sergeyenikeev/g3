import { test, expect } from "@playwright/test";

test("smoke: training, daily, tutorial, upgrade, results", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (e) => errors.push(e));
  const clickMenuText = async (fragments: string[]) => {
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
      return (
        texts.find((entry: { text: string }) => normalizedParts.some((part) => entry.text.toLowerCase().includes(part))) ?? null
      );
    }, fragments);

    expect(target, `menu text not found for: ${fragments.join(", ")}`).toBeTruthy();
    await page.mouse.click(target!.x, target!.y);
  };

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

  // TRAINING
  await clickMenuText(["training", "обуч"]);

  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return s?.mode === "tutorial";
  });

  await page.mouse.click(width / 2 + 220, 78);

  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("menu") === true);

  // DAILY
  await clickMenuText(["daily", "ежеднев"]);

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
  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const cd = g?.registry?.get("flipCooldown");
    return typeof cd === "number" && cd > 0;
  });

  // Dash
  await page.keyboard.press("Shift");
  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const cd = g?.registry?.get("dashCooldown");
    return typeof cd === "number" && cd > 0;
  });

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
  await page.mouse.click(width / 2, height * 0.49);
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === false);

  // Force end run (VITE_E2E API; works even if game is paused by upgrade)
  await page.waitForFunction(() => typeof (window as any).__MC_E2E__?.endRun === "function");
  await page.evaluate(() => (window as any).__MC_E2E__.endRun());
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("results") === true);

  expect(errors, "page errors").toEqual([]);
});
