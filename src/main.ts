import "./style.css";
import {
  buildBootReport,
  clearBootReport,
  clearRawPlatformSave,
  hasBootCompleted,
  persistBootReport,
  resetBootDiagnostics,
  setCurrentBootStage,
} from "./app/bootDiagnostics";
import { getBootstrapLocale, installBrowserInteractionGuards, reportFatalStartupErrorWithReport, syncDocumentLocale } from "./app/bootstrapShell";
import { ensurePlatformSdkLoaded } from "./platform/sdk/loadPlatformSdk";

// Phaser source builds still touch `global` in some code paths.
(globalThis as typeof globalThis & { global?: typeof globalThis }).global ??= globalThis;

installBrowserInteractionGuards();
resetBootDiagnostics();
clearBootReport();
clearRawPlatformSave();

window.addEventListener("error", (event) => {
  const error = event.error ?? event.message;
  const report = buildBootReport(error);
  if (hasBootCompleted()) {
    persistBootReport(report);
    console.error("[Magnet Caravan] runtime error after boot", report, error);
    return;
  }
  reportFatalStartupErrorWithReport(error, report);
});

window.addEventListener("unhandledrejection", (event) => {
  const report = buildBootReport(event.reason);
  if (hasBootCompleted()) {
    persistBootReport(report);
    console.error("[Magnet Caravan] unhandled rejection after boot", report, event.reason);
    return;
  }
  reportFatalStartupErrorWithReport(event.reason, report);
});

void (async () => {
  try {
    setCurrentBootStage("sdk-script");
    await ensurePlatformSdkLoaded();
    syncDocumentLocale(getBootstrapLocale());
    const { createGame } = await import("./app/createGame");
    const game = createGame("app");
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1" || import.meta.env.VITE_SMOKE_TEST === "1") {
      (window as any).__MC_GAME__ = game;
    }
  } catch (error) {
    reportFatalStartupErrorWithReport(error, buildBootReport(error));
  }
})();
