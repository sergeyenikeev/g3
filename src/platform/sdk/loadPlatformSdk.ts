import type { Locale } from "../../i18n/localization";
import { resolveLocaleFromLanguageTag } from "../../i18n/localization";

type PlatformMode = "auto" | "mock" | "local" | "web" | "generic" | "yandex" | "vk";

type SdkScript = {
  getUrl: () => string;
  isPresent: () => boolean;
};

const SCRIPTS: Record<Exclude<PlatformMode, "auto" | "mock" | "local" | "web" | "generic">, SdkScript> = {
  yandex: {
    getUrl: () => {
      const envUrl = (import.meta as any).env?.VITE_YANDEX_SDK_URL;
      if (typeof envUrl === "string" && envUrl.trim().length > 0) return envUrl.trim();
      return "/sdk.js";
    },
    isPresent: () => Boolean((window as any)?.YaGames?.init),
  },
  vk: {
    getUrl: () => "https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js",
    isPresent: () => Boolean((window as any)?.vkBridge?.send),
  },
};

let bootstrapLocaleHint: Locale | null = null;
let yandexSdkInitPromise: Promise<unknown | null> | null = null;
let yandexInitSource: unknown = null;

export async function ensurePlatformSdkLoaded(): Promise<void> {
  const raw = (import.meta as any).env?.VITE_PLATFORM_ADAPTER ?? (import.meta as any).env?.VITE_PLATFORM ?? "auto";
  const mode = String(raw).toLowerCase() as PlatformMode;
  if (mode === "auto" || mode === "mock" || mode === "local" || mode === "web" || mode === "generic") return;

  const script = (SCRIPTS as any)[mode] as SdkScript | undefined;
  if (!script) return;
  if (script.isPresent()) return;

  try {
    await withTimeout(loadScriptOnce(script.getUrl()), 7000);
  } catch {
    // ignore: safe degradation if SDK isn't reachable
  }

  if (mode === "yandex") {
    try {
      await withTimeout(getPreinitializedYandexSdk(), 400);
    } catch {
      // ignore: the game can continue booting while the SDK finishes initialization
    }
  }
}

export function getPlatformBootstrapLocaleHint(): Locale | null {
  return bootstrapLocaleHint;
}

export async function getPreinitializedYandexSdk(): Promise<unknown | null> {
  const api = (window as any)?.YaGames;
  if (!api?.init) return null;
  if (yandexInitSource !== api.init) {
    yandexInitSource = api.init;
    yandexSdkInitPromise = null;
    bootstrapLocaleHint = null;
  }
  if (yandexSdkInitPromise) return yandexSdkInitPromise;

  yandexSdkInitPromise = Promise.resolve(api.init())
    .then((sdk: any) => {
      bootstrapLocaleHint = resolveLocaleFromLanguageTag(sdk?.environment?.i18n?.lang) ?? bootstrapLocaleHint;
      return sdk ?? null;
    })
    .catch(() => null);

  const sdk = await yandexSdkInitPromise;
  if (!sdk) yandexSdkInitPromise = null;
  return sdk;
}

const loading = new Map<string, Promise<void>>();

function loadScriptOnce(url: string): Promise<void> {
  const existingPromise = loading.get(url);
  if (existingPromise) return existingPromise;

  const existingScript = findScriptByUrl(url);
  const promise = new Promise<void>((resolve, reject) => {
    const handleLoad = () => resolve();
    const handleError = () => reject(new Error(`Failed to load script: ${url}`));

    if (existingScript) {
      if ((existingScript as HTMLScriptElement & { readyState?: string }).dataset.mcLoaded === "true") {
        resolve();
        return;
      }
      const readyState = (existingScript as HTMLScriptElement & { readyState?: string }).readyState;
      if (readyState === "loaded" || readyState === "complete") {
        resolve();
        return;
      }
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => {
      s.dataset.mcLoaded = "true";
      handleLoad();
    };
    s.onerror = handleError;
    document.head.appendChild(s);
  });

  loading.set(url, promise);
  return promise.finally(() => {
    loading.delete(url);
  });
}

function findScriptByUrl(url: string): HTMLScriptElement | null {
  const targetUrl = normalizeScriptUrl(url);
  if (!targetUrl) return null;

  for (const script of Array.from(document.scripts)) {
    if (!(script instanceof HTMLScriptElement)) continue;
    if (normalizeScriptUrl(script.src) === targetUrl) return script;
  }

  return null;
}

function normalizeScriptUrl(url: string): string | null {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}
