export type PathKey = string | number;

function parsePart(part: string): PathKey {
  if (/^\d+$/.test(part)) return Number(part);
  return part;
}

export function parsePath(path: string): PathKey[] {
  if (path.trim().length === 0) throw new Error("Пустой path");
  return path.split(".").map((p) => parsePart(p.trim()));
}

export function getAtPath(root: unknown, path: string): unknown {
  const parts = parsePath(path);
  let cur: any = root;
  for (const p of parts) {
    if (cur == null) throw new Error(`Path не найден: ${path}`);
    cur = cur[p as any];
  }
  return cur;
}

export function setAtPath(root: unknown, path: string, value: unknown): void {
  const parts = parsePath(path);
  if (parts.length === 0) throw new Error("Пустой path");
  let cur: any = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (cur == null) throw new Error(`Path не найден: ${path}`);
    cur = cur[p as any];
  }
  const last = parts[parts.length - 1]!;
  if (cur == null) throw new Error(`Path не найден: ${path}`);
  cur[last as any] = value as any;
}

export function addAtPath(root: unknown, path: string, delta: number): void {
  const cur = getAtPath(root, path);
  if (typeof cur !== "number" || !Number.isFinite(cur)) {
    throw new Error(`add: path не число (${path})`);
  }
  setAtPath(root, path, cur + delta);
}

export function mulAtPath(root: unknown, path: string, mult: number): void {
  const cur = getAtPath(root, path);
  if (typeof cur !== "number" || !Number.isFinite(cur)) {
    throw new Error(`mul: path не число (${path})`);
  }
  setAtPath(root, path, cur * mult);
}

