import { type Locale, resolveLocale, t } from "../i18n/localization";
import { buildBootReport, getBootQueryFlags, persistBootReport, readBootReport, type BootReport } from "./bootDiagnostics";
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
  const report = buildBootReport(error);
  reportFatalStartupErrorWithReport(error, report);
}

export function reportFatalStartupErrorWithReport(error: unknown, report: BootReport | null): void {
  if (report) {
    persistBootReport(report);
    console.error("[Magnet Caravan] fatal bootstrap/runtime error", report, error);
  } else {
    console.error("[Magnet Caravan] fatal bootstrap/runtime error", error);
  }
  const locale = getBootstrapLocale();
  syncDocumentLocale(locale);
  renderFatalOverlay(locale, report ?? readBootReport());
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

function renderFatalOverlay(locale: BootstrapLocale, report: BootReport | null = null): void {
  if (typeof document === "undefined") return;

  const host = document.getElementById("app") ?? document.body;
  if (!host) return;

  const copy = getFatalOverlayCopy(locale);
  const overlay = ensureOverlay(host);
  overlay.lang = locale;

  const title = overlay.querySelector<HTMLElement>("[data-role='title']");
  const body = overlay.querySelector<HTMLElement>("[data-role='body']");
  const action = overlay.querySelector<HTMLButtonElement>("[data-role='action']");
  const details = overlay.querySelector<HTMLElement>("[data-role='details']");

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
  if (details) {
    const showDetails = getBootQueryFlags().bootDiag && report;
    details.style.display = showDetails ? "block" : "none";
    details.textContent = showDetails && report ? formatBootReportDetails(report) : "";
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
  renderFatalOverlay(nextLocale, readBootReport());
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
  overlay.style.padding = "clamp(24px, 4vw, 56px)";
  overlay.style.background = "radial-gradient(circle at top, rgba(34, 57, 81, 0.96), rgba(7, 11, 15, 0.98))";

  const panel = document.createElement("div");
  panel.style.width = "min(clamp(560px, 46vw, 1480px), calc(100vw - clamp(32px, 4vw, 112px)))";
  panel.style.padding = "clamp(24px, 3.8vw, 60px)";
  panel.style.borderRadius = "clamp(24px, 3vw, 42px)";
  panel.style.border = "2px solid rgba(92, 200, 255, 0.5)";
  panel.style.background = "rgba(8, 17, 26, 0.96)";
  panel.style.boxShadow = "0 clamp(24px, 3vw, 40px) clamp(64px, 8vw, 96px) rgba(0, 0, 0, 0.42)";
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
  body.style.margin = "clamp(16px, 2vw, 24px) 0 0";
  body.style.fontSize = "clamp(17px, 2.4vw, 32px)";
  body.style.lineHeight = "1.45";
  body.style.color = "#a9d7ee";

  const action = document.createElement("button");
  action.dataset.role = "action";
  action.type = "button";
  action.style.margin = "clamp(20px, 2.4vw, 32px) auto 0";
  action.style.minWidth = "clamp(220px, 22vw, 560px)";
  action.style.minHeight = "clamp(56px, 5vw, 116px)";
  action.style.padding = "0 clamp(20px, 2.5vw, 44px)";
  action.style.border = "0";
  action.style.borderRadius = "clamp(18px, 2vw, 28px)";
  action.style.background = "linear-gradient(180deg, #74deff 0%, #2ca8d9 100%)";
  action.style.color = "#031019";
  action.style.fontSize = "clamp(18px, 2.6vw, 34px)";
  action.style.fontWeight = "800";
  action.style.cursor = "pointer";

  const details = document.createElement("pre");
  details.dataset.role = "details";
  details.style.display = "none";
  details.style.margin = "clamp(16px, 2vw, 24px) 0 0";
  details.style.padding = "clamp(14px, 1.8vw, 26px) clamp(16px, 2vw, 30px)";
  details.style.borderRadius = "clamp(16px, 1.8vw, 28px)";
  details.style.background = "rgba(2, 8, 14, 0.7)";
  details.style.border = "1px solid rgba(92, 200, 255, 0.22)";
  details.style.color = "#8fc7df";
  details.style.fontSize = "clamp(13px, 1.4vw, 20px)";
  details.style.lineHeight = "1.45";
  details.style.fontFamily = "Consolas, 'Courier New', monospace";
  details.style.textAlign = "left";
  details.style.whiteSpace = "pre-wrap";
  details.style.wordBreak = "break-word";

  panel.append(title, body, details, action);
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

function formatBootReportDetails(report: BootReport): string {
  const lines = [
    `status: ${report.status}`,
    `stage: ${report.stage}`,
    `platform: ${report.platform}`,
    `documentLang: ${report.documentLang ?? "-"}`,
    `hasYaGames: ${report.hasYaGames ? "yes" : "no"}`,
    `storageScope: ${report.storageScope ?? "-"}`,
    `recoveryAttempted: ${report.recoveryAttempted ? "yes" : "no"}`,
    `recoveredFromPlatformSave: ${report.recoveredFromPlatformSave ? "yes" : "no"}`,
    `timestamp: ${report.timestampIso}`,
    `message: ${report.message}`,
  ];
  if (report.stack) lines.push(`stack:\n${report.stack}`);
  return lines.join("\n");
}
