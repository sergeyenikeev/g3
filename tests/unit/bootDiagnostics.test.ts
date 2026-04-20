import { afterEach, describe, expect, it } from "vitest";
import {
  buildBootReport,
  clearBootReport,
  clearRawPlatformSave,
  getBootQueryFlags,
  persistBootReport,
  persistRawPlatformSave,
  readBootReport,
  readRawPlatformSave,
  resetBootDiagnostics,
  setCurrentBootStage,
} from "../../src/app/bootDiagnostics";

const originalLocalStorage = (globalThis as any).localStorage;
const originalLocation = (globalThis as any).location;
const originalDocument = (globalThis as any).document;

class MemoryStorage implements Storage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

afterEach(() => {
  resetBootDiagnostics();
  clearBootReport();
  clearRawPlatformSave();

  if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
  else (globalThis as any).localStorage = originalLocalStorage;

  if (originalLocation === undefined) delete (globalThis as any).location;
  else (globalThis as any).location = originalLocation;

  if (originalDocument === undefined) delete (globalThis as any).document;
  else (globalThis as any).document = originalDocument;
});

describe("bootDiagnostics", () => {
  it("persists boot reports with stage, error, and recovery metadata", () => {
    (globalThis as any).localStorage = new MemoryStorage();
    (globalThis as any).location = { search: "?mc_bootdiag=1&mc_reset_yandex_save=1" };
    (globalThis as any).document = { documentElement: { lang: "ru" } };

    setCurrentBootStage("save-load");
    const report = buildBootReport(new Error("legacy save exploded"), {
      platform: "yandex",
      storageScope: "yandex:player-a",
      recoveryAttempted: true,
      recoveredFromPlatformSave: true,
      status: "recovered",
    });

    persistBootReport(report);

    expect(readBootReport()).toMatchObject({
      status: "recovered",
      stage: "save-load",
      message: "legacy save exploded",
      platform: "yandex",
      documentLang: "ru",
      storageScope: "yandex:player-a",
      recoveryAttempted: true,
      recoveredFromPlatformSave: true,
      query: {
        bootDiag: true,
        resetYandexSave: true,
      },
    });
  });

  it("reads query flags and quarantines raw platform saves", () => {
    (globalThis as any).localStorage = new MemoryStorage();
    (globalThis as any).location = { search: "?mc_bootdiag=1" };

    expect(getBootQueryFlags()).toEqual({
      bootDiag: true,
      resetYandexSave: false,
    });

    persistRawPlatformSave({ v: 1, legacyDraftMeta: { version: 0 } });
    expect(readRawPlatformSave()).toEqual({
      v: 1,
      legacyDraftMeta: { version: 0 },
    });
  });
});
