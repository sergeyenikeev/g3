import { safeJsonParse, safeJsonStringify, safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "../platform/utils/localStorage";

export type BootStage =
  | "sdk-script"
  | "ysdk-init"
  | "adapter-init"
  | "save-load"
  | "liveops-normalize"
  | "analytics-init"
  | "menu-start";

export type BootQueryFlags = {
  bootDiag: boolean;
  resetYandexSave: boolean;
};

export type BootReportStatus = "fatal" | "recovered";

export type BootReport = {
  status: BootReportStatus;
  stage: BootStage;
  message: string;
  stack: string | null;
  platform: string;
  documentLang: string | null;
  hasYaGames: boolean;
  storageScope: string | null;
  recoveryAttempted: boolean;
  recoveredFromPlatformSave: boolean;
  timestampIso: string;
  query: BootQueryFlags;
};

export const BOOT_REPORT_STORAGE_KEY = "magnet_caravan.boot_report";
export const RAW_PLATFORM_SAVE_QUARANTINE_KEY = "magnet_caravan.boot_report.raw_platform_save";

let currentBootStage: BootStage = "sdk-script";

export function setCurrentBootStage(stage: BootStage): void {
  currentBootStage = stage;
}

export function getCurrentBootStage(): BootStage {
  return currentBootStage;
}

export function resetBootDiagnostics(): void {
  currentBootStage = "sdk-script";
}

export function getBootQueryFlags(locationLike: Pick<Location, "search"> | null | undefined = globalThis.location): BootQueryFlags {
  let search = "";
  try {
    search = typeof locationLike?.search === "string" ? locationLike.search : "";
  } catch {
    search = "";
  }

  const params = new URLSearchParams(search);
  return {
    bootDiag: params.get("mc_bootdiag") === "1",
    resetYandexSave: params.get("mc_reset_yandex_save") === "1",
  };
}

export function buildBootReport(
  error: unknown,
  details: Partial<Omit<BootReport, "status" | "message" | "stack" | "timestampIso" | "query">> & { status?: BootReportStatus } = {}
): BootReport {
  const normalized = normalizeError(error);
  return {
    status: details.status ?? "fatal",
    stage: details.stage ?? currentBootStage,
    message: normalized.message,
    stack: normalized.stack,
    platform: details.platform ?? "unknown",
    documentLang: details.documentLang ?? getDocumentLanguage(),
    hasYaGames: details.hasYaGames ?? hasYaGamesSdk(),
    storageScope: details.storageScope ?? null,
    recoveryAttempted: details.recoveryAttempted ?? false,
    recoveredFromPlatformSave: details.recoveredFromPlatformSave ?? false,
    timestampIso: new Date().toISOString(),
    query: getBootQueryFlags(),
  };
}

export function persistBootReport(report: BootReport): void {
  const raw = safeJsonStringify(report);
  if (!raw) return;
  safeLocalStorageSet(BOOT_REPORT_STORAGE_KEY, raw);
}

export function readBootReport(): BootReport | null {
  return safeJsonParse<BootReport>(safeLocalStorageGet(BOOT_REPORT_STORAGE_KEY));
}

export function clearBootReport(): void {
  safeLocalStorageRemove(BOOT_REPORT_STORAGE_KEY);
}

export function persistRawPlatformSave(value: unknown): void {
  const raw = safeJsonStringify(value);
  if (!raw) return;
  safeLocalStorageSet(RAW_PLATFORM_SAVE_QUARANTINE_KEY, raw);
}

export function clearRawPlatformSave(): void {
  safeLocalStorageRemove(RAW_PLATFORM_SAVE_QUARANTINE_KEY);
}

export function readRawPlatformSave(): unknown | null {
  return safeJsonParse(safeLocalStorageGet(RAW_PLATFORM_SAVE_QUARANTINE_KEY));
}

function normalizeError(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || "Unknown boot error",
      stack: typeof error.stack === "string" && error.stack.length > 0 ? error.stack : null,
    };
  }

  if (typeof error === "string" && error.length > 0) {
    return { message: error, stack: null };
  }

  return { message: "Unknown boot error", stack: null };
}

function getDocumentLanguage(): string | null {
  try {
    const value = document.documentElement?.lang;
    return typeof value === "string" && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function hasYaGamesSdk(): boolean {
  try {
    return Boolean((globalThis as typeof globalThis & { YaGames?: { init?: unknown } }).YaGames?.init);
  } catch {
    return false;
  }
}
