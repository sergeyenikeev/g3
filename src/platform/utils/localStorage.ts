export function safeLocalStorageGet(key: string): string | null {
  const ls = (globalThis as any)?.localStorage as Storage | undefined;
  if (!ls) return null;
  try {
    return ls.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  const ls = (globalThis as any)?.localStorage as Storage | undefined;
  if (!ls) return;
  try {
    ls.setItem(key, value);
  } catch {
    // ignore
  }
}

export function safeLocalStorageRemove(key: string): void {
  const ls = (globalThis as any)?.localStorage as Storage | undefined;
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    // ignore
  }
}

export function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
