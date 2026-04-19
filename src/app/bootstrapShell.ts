import { type Locale, resolveLocale, t } from "../i18n/localization";
import { getPlatformBootstrapLocaleHint, getPreinitializedYandexSdk } from "../platform/sdk/loadPlatformSdk";

type BootstrapLocale = Locale;

type FatalOverlayCopy = {
  title: string;
  body: string;
  action: string;
};

const FATAL_OVERLAY_ID = "mc-fatal-overlay";

let browserInteractionGuardsInstalled = false;

export function installBrowserInteractionGuards(target: Window = window): void {
  if (browserInteractionGuardsInstalled) return;
  browserInteractionGuardsInstalled = true;

  const preventBrowserUi = (event: Event) => {
    if (event.cancelable) event.preventDefault();
  };

  for (const eventName of ["contextmenu", "selectstart", "dragstart", "gesturestart", "gesturechange", "gestureend"] as const) {
    target.addEventListener(eventName, preventBrowserUi, { capture: true });
  }
}

export function reportFatalStartupError(error: unknown): void {
  console.error("[Magnet Caravan] fatal bootstrap/runtime error", error);
  const locale = getBootstrapLocale();
  syncDocumentLocale(locale);
  renderFatalOverlay(locale);
  void refreshFatalOverlayLocaleHint(locale);
}

export function getBootstrapLocale(): BootstrapLocale {
  const platformHint = getPlatformBootstrapLocaleHint();
  if (platformHint) return platformHint;
  return resolveLocale("auto", getNavigatorLanguages());
}

export function syncDocumentLocale(locale: BootstrapLocale): void {
  if (typeof document === "undefined") return;

  if (document.documentElement) document.documentElement.lang = locale;
  document.title = t(locale, "app.title");
}

function renderFatalOverlay(locale: BootstrapLocale): void {
  if (typeof document === "undefined") return;

  const host = document.getElementById("app") ?? document.body;
  if (!host) return;

  const copy = getFatalOverlayCopy(locale);
  const overlay = ensureOverlay(host);
  overlay.lang = locale;

  const title = overlay.querySelector<HTMLElement>("[data-role='title']");
  const body = overlay.querySelector<HTMLElement>("[data-role='body']");
  const action = overlay.querySelector<HTMLButtonElement>("[data-role='action']");

  if (title) title.textContent = copy.title;
  if (body) body.textContent = copy.body;
  if (action) {
    action.textContent = copy.action;
    action.onclick = () => {
      try {
        window.location.reload();
      } catch {
        // ignore
      }
    };
  }
}

async function refreshFatalOverlayLocaleHint(currentLocale: BootstrapLocale): Promise<void> {
  try {
    await getPreinitializedYandexSdk();
  } catch {
    return;
  }

  const nextLocale = getBootstrapLocale();
  if (nextLocale === currentLocale) return;
  syncDocumentLocale(nextLocale);
  renderFatalOverlay(nextLocale);
}

function ensureOverlay(host: HTMLElement): HTMLElement {
  const existing = document.getElementById(FATAL_OVERLAY_ID);
  if (existing instanceof HTMLElement) return existing;

  const overlay = document.createElement("section");
  overlay.id = FATAL_OVERLAY_ID;
  overlay.setAttribute("role", "alertdialog");
  overlay.setAttribute("aria-live", "assertive");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "24px";
  overlay.style.background = "radial-gradient(circle at top, rgba(34, 57, 81, 0.96), rgba(7, 11, 15, 0.98))";

  const panel = document.createElement("div");
  panel.style.width = "min(560px, calc(100vw - 32px))";
  panel.style.padding = "24px";
  panel.style.borderRadius = "24px";
  panel.style.border = "2px solid rgba(92, 200, 255, 0.5)";
  panel.style.background = "rgba(8, 17, 26, 0.96)";
  panel.style.boxShadow = "0 24px 64px rgba(0, 0, 0, 0.42)";
  panel.style.color = "#d9f2ff";
  panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  panel.style.textAlign = "center";

  const title = document.createElement("h1");
  title.dataset.role = "title";
  title.style.margin = "0";
  title.style.fontSize = "clamp(28px, 4.8vw, 38px)";
  title.style.lineHeight = "1.1";
  title.style.fontWeight = "800";

  const body = document.createElement("p");
  body.dataset.role = "body";
  body.style.margin = "16px 0 0";
  body.style.fontSize = "clamp(17px, 3.2vw, 20px)";
  body.style.lineHeight = "1.45";
  body.style.color = "#a9d7ee";

  const action = document.createElement("button");
  action.dataset.role = "action";
  action.type = "button";
  action.style.margin = "20px auto 0";
  action.style.minWidth = "220px";
  action.style.minHeight = "56px";
  action.style.padding = "0 20px";
  action.style.border = "0";
  action.style.borderRadius = "18px";
  action.style.background = "linear-gradient(180deg, #74deff 0%, #2ca8d9 100%)";
  action.style.color = "#031019";
  action.style.fontSize = "clamp(18px, 3.5vw, 22px)";
  action.style.fontWeight = "800";
  action.style.cursor = "pointer";

  panel.append(title, body, action);
  overlay.append(panel);
  host.append(overlay);
  return overlay;
}

function getFatalOverlayCopy(locale: BootstrapLocale): FatalOverlayCopy {
  return {
    title: t(locale, "bootstrap.fatal.title"),
    body: t(locale, "bootstrap.fatal.body"),
    action: t(locale, "bootstrap.fatal.action"),
  };
}

function getNavigatorLanguages(): readonly string[] {
  try {
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) return navigator.languages;
  } catch {
    // ignore
  }

  try {
    if (typeof navigator.language === "string" && navigator.language.length > 0) return [navigator.language];
  } catch {
    // ignore
  }

  return ["en"];
}
