import { describe, expect, it } from "vitest";
import {
  formatResource,
  getDailyVariantCopy,
  getMetaNodeName,
  getRarityLabel,
  normalizeLanguageSetting,
  resolveLocale,
  t,
} from "../../src/i18n/localization";

describe("localization", () => {
  it("resolves locale from an explicit setting", () => {
    expect(resolveLocale("ru", ["en-US"])).toBe("ru");
    expect(resolveLocale("en", ["ru-RU"])).toBe("en");
  });

  it("resolves auto locale from browser languages", () => {
    expect(resolveLocale("auto", ["ru-RU", "en-US"])).toBe("ru");
    expect(resolveLocale("auto", ["de-DE", "en-US"])).toBe("en");
  });

  it("normalizes invalid language settings to auto", () => {
    expect(normalizeLanguageSetting("fr")).toBe("auto");
    expect(normalizeLanguageSetting("ru")).toBe("ru");
  });

  it("formats localized copy for gameplay and meta data", () => {
    expect(t("ru", "menu.play")).toBe("ИГРАТЬ");
    expect(getDailyVariantCopy("ru", "daily_fast_flip").title).toBe("Быстрый флип");
    expect(getMetaNodeName("ru", "meta_dash_unlock", "Dash")).toBe("Модуль рывка");
    expect(getRarityLabel("en", "epic")).toBe("EPIC");
    expect(formatResource("ru", "cores", 3)).toBe("3 ядра");
  });
});
