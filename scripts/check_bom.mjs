import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { TextDecoder } from "node:util";
import { listFilesRecursive } from "./lib/fs_walk.mjs";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const roots = [
  join(process.cwd(), "docs"),
  join(process.cwd(), "docs", "platform_texts"),
  join(process.cwd(), "docs", "PLATFORMS"),
];

const decoder = new TextDecoder("utf-8", { fatal: true });
const problems = [];

for (const root of roots) {
  for await (const file of listFilesRecursive(root)) {
    if (extname(file).toLowerCase() !== ".md") continue;
    const buf = await readFile(file);

    const hasBom = buf.length >= 3 && buf.subarray(0, 3).equals(UTF8_BOM);
    if (!hasBom) {
      problems.push({ file, reason: "missing UTF-8 BOM" });
      continue;
    }

    try {
      decoder.decode(buf.subarray(3));
    } catch {
      problems.push({ file, reason: "invalid UTF-8 content" });
    }
  }
}

if (problems.length > 0) {
  console.error("BOM/UTF-8 check failed:");
  for (const p of problems) console.error(`- ${p.file}: ${p.reason}`);
  process.exit(1);
}

console.log("BOM/UTF-8 check OK");
