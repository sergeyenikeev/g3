export function deepMerge<T>(base: T, patch: Partial<T>): T {
  if (patch == null) return base;

  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const cur: any = (base as any)[k];
    if (Array.isArray(cur) || Array.isArray(v)) {
      (base as any)[k] = v as any;
      continue;
    }
    if (isPlainObject(cur) && isPlainObject(v)) {
      deepMerge(cur, v as any);
      continue;
    }
    (base as any)[k] = v as any;
  }

  return base;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

