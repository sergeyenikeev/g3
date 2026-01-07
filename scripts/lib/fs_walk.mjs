import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function* listFilesRecursive(rootDir) {
  let entries = [];
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = join(rootDir, ent.name);
    if (ent.isDirectory()) {
      yield* listFilesRecursive(full);
    } else if (ent.isFile()) {
      yield full;
    }
  }
}

