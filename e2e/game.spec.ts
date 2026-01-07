import { test, expect } from "@playwright/test";

test("smoke: старт, flip, bank, экран апгрейда", async ({ page }) => {
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

  // PLAY (кнопка нарисована в canvas)
  await page.mouse.click(width / 2, height * 0.62);

  // UI активна
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("ui") === true);

  // SKIP tutorial (если он показан)
  await page.mouse.click(width / 2 + 220, 78);

  // Flip (клавиатура)
  await page.keyboard.press("Space");

  // Дойти до recycler (игрок стартует ниже центра)
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");

  // Подождать bank: bolts увеличатся
  await page.waitForFunction(() => {
    const g = (window as any).__MC_GAME__;
    const s = g?.registry?.get("runState");
    return Boolean(s && typeof s.bolts === "number" && s.bolts > 0);
  });

  // Дождаться экрана апгрейда (в e2e-режиме волна короткая)
  await page.waitForFunction(() => (window as any).__MC_GAME__?.scene?.isActive("upgrade") === true);

  expect(errors, "page errors").toEqual([]);
});
