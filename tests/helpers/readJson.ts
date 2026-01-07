import { readFile } from "node:fs/promises";

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path);
  const text = stripUtf8Bom(raw.toString("utf8"));
  return JSON.parse(text) as T;
}

function stripUtf8Bom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

