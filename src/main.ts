import "./style.css";
import { installBrowserInteractionGuards, reportFatalStartupError } from "./app/bootstrapShell";
import { ensurePlatformSdkLoaded } from "./platform/sdk/loadPlatformSdk";

// Phaser source builds still touch `global` in some code paths.
(globalThis as typeof globalThis & { global?: typeof globalThis }).global ??= globalThis;

installBrowserInteractionGuards();

window.addEventListener("error", (event) => {
  reportFatalStartupError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  reportFatalStartupError(event.reason);
});

void (async () => {
  try {
    await ensurePlatformSdkLoaded();
    const { createGame } = await import("./app/createGame");
    const game = createGame("app");
    if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
      (window as any).__MC_GAME__ = game;
    }
  } catch (error) {
    reportFatalStartupError(error);
  }
})();
