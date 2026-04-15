import "./style.css";
import { ensurePlatformSdkLoaded } from "./platform/sdk/loadPlatformSdk";

// Phaser source builds still touch `global` in some code paths.
(globalThis as typeof globalThis & { global?: typeof globalThis }).global ??= globalThis;

const preventBrowserUi = (event: Event) => {
  event.preventDefault();
};

for (const eventName of ["contextmenu", "selectstart", "dragstart"] as const) {
  window.addEventListener(eventName, preventBrowserUi, { capture: true });
}

void (async () => {
  try {
    await ensurePlatformSdkLoaded();
  } catch {
    // ignore
  }

  const { createGame } = await import("./app/createGame");
  const game = createGame("app");
  if (import.meta.env.DEV || import.meta.env.VITE_E2E === "1") {
    (window as any).__MC_GAME__ = game;
  }
})();
