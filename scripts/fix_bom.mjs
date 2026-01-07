import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { TextDecoder } from "node:util";
import iconv from "iconv-lite";
import { listFilesRecursive } from "./lib/fs_walk.mjs";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const roots = [
  join(process.cwd(), "docs"),
  join(process.cwd(), "docs", "platform_texts"),
  join(process.cwd(), "docs", "PLATFORMS"),
];

const decoder = new TextDecoder("utf-8", { fatal: true });

let fixed = 0;

for (const root of roots) {
  for await (const file of listFilesRecursive(root)) {
    if (extname(file).toLowerCase() !== ".md") continue;
    const buf = await readFile(file);
    const hasBom = buf.length >= 3 && buf.subarray(0, 3).equals(UTF8_BOM);
    const payload = hasBom ? buf.subarray(3) : buf;

    let text;
    try {
      text = decoder.decode(payload);
    } catch {
      text = iconv.decode(payload, "windows-1251");
    }

    const next = Buffer.concat([UTF8_BOM, Buffer.from(text, "utf8")]);
    if (hasBom && buf.equals(next)) continue;
    await writeFile(file, next);
    fixed += 1;
  }
}

console.log(`fix-bom: updated ${fixed} file(s)`);

