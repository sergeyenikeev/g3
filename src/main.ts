import "./style.css";
import { buildBootReport, clearBootReport, clearRawPlatformSave, resetBootDiagnostics, setCurrentBootStage } from "./app/bootDiagnostics";
import { getBootstrapLocale, installBrowserInteractionGuards, reportFatalStartupErrorWithReport, syncDocumentLocale } from "./app/bootstrapShell";
import { ensurePlatformSdkLoaded } from "./platform/sdk/loadPlatformSdk";

// Phaser source builds still touch `global` in some code paths.
(globalThis as typeof globalThis & { global?: typeof globalThis }).global ??= globalThis;

installBrowserInteractionGuards();
resetBootDiagnostics();
clearBootReport();
clearRawPlatformSave();

window.addEventListener("error", (event) => {
  reportFatalStartupErrorWithReport(event.error ?? event.message, buildBootReport(event.error ?? event.message));
});

window.addEventListener("unhandledrejection", (event) => {
  reportFatalStartupErrorWithReport(event.reason, buildBootReport(event.reason));
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
