type PlatformMode = "auto" | "mock" | "local" | "web" | "generic" | "yandex" | "vk";

type SdkScript = {
  url: string;
  isPresent: () => boolean;
};

const SCRIPTS: Record<Exclude<PlatformMode, "auto" | "mock" | "local" | "web" | "generic">, SdkScript> = {
  yandex: {
    url: "https://yandex.ru/games/sdk/v2",
    isPresent: () => Boolean((window as any)?.YaGames?.init),
  },
  vk: {
    url: "https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js",
    isPresent: () => Boolean((window as any)?.vkBridge?.send),
  },
};

export async function ensurePlatformSdkLoaded(): Promise<void> {
  const raw = (import.meta as any).env?.VITE_PLATFORM_ADAPTER ?? (import.meta as any).env?.VITE_PLATFORM ?? "auto";
  const mode = String(raw).toLowerCase() as PlatformMode;
  if (mode === "auto" || mode === "mock" || mode === "local" || mode === "web" || mode === "generic") return;

  const script = (SCRIPTS as any)[mode] as SdkScript | undefined;
  if (!script) return;
  if (script.isPresent()) return;

  try {
    await withTimeout(loadScriptOnce(script.url), 7000);
  } catch {
    // ignore: safe degradation if SDK isn't reachable
  }
}

const loaded = new Set<string>();

function loadScriptOnce(url: string): Promise<void> {
  if (loaded.has(url)) return Promise.resolve();
  loaded.add(url);

  return new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
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
