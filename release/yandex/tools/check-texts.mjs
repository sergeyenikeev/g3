// Проверяет тексты карточки Яндекс Игр в release/yandex/texts/*.json.
// Запуск: node release/yandex/tools/check-texts.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { checklistsDir, releaseRoot, repoRoot } from "./paths.mjs";

const FILES = [
  { locale: "ru", path: join(releaseRoot, "texts", "yandex-draft-ru.json"), script: /^[Ѐ-ӿ\s\d.,!?:;()«»"\-—–/+*'’A-Za-z0-9]+$/u },
  { locale: "en", path: join(releaseRoot, "texts", "yandex-draft-en.json"), script: /^[\x20-\x7E‐-‟…—–]+$/u },
];

const issues = [];
const rows = [];

function check(locale, doc, isRu) {
  function row(field, value, ok, note) {
    rows.push({ locale, field, len: typeof value === "string" ? value.length : "-", status: ok ? "OK" : "FAIL", note });
    if (!ok) issues.push(`[${locale}] ${field}: ${note}`);
  }

  // title
  {
    const v = String(doc.title ?? "");
    const ok = v.length > 0 && v.length <= 50 && v[0] === v[0].toUpperCase() && v !== v.toUpperCase();
    row("title", v, ok, `len=${v.length}, value="${v}"`);
  }
  // shortDescription
  {
    const v = String(doc.shortDescription ?? "");
    const ok =
      v.length > 0 &&
      v.length <= 70 &&
      v[0] === v[0].toUpperCase() &&
      !/^"|"$/.test(v) &&
      !/бесплатно|free/i.test(v) &&
      v.toLowerCase() !== String(doc.title ?? "").toLowerCase();
    row("shortDescription", v, ok, `len=${v.length}`);
  }
  // seoDescription
  {
    const v = String(doc.seoDescription ?? "");
    const ok = v.length >= 50 && v.length <= 160 && /[.!]$/u.test(v);
    row("seoDescription", v, ok, `len=${v.length}`);
  }
  // fullDescription
  {
    const v = String(doc.fullDescription ?? "");
    const ok = v.length >= 100 && v.length <= 1000 && !/лучшая|№\s*1|100%|the best|#1/i.test(v);
    row("fullDescription", v, ok, `len=${v.length}`);
  }
  // howToPlay
  {
    const v = String(doc.howToPlay ?? "");
    const ok = v.length >= 100 && v.length <= 1000;
    row("howToPlay", v, ok, `len=${v.length}`);
  }
  // keywords
  {
    const v = String(doc.keywords ?? "");
    const ok = v.length > 0 && v.length <= 100 && v === v.toLowerCase() && v.split(",").every((p) => p.trim().length > 0);
    row("keywords", v, ok, `len=${v.length}`);
  }
  // tags
  {
    const tags = Array.isArray(doc.tags) ? doc.tags : [];
    const ok = tags.length > 0 && tags.length <= 20 && tags.every((t) => typeof t === "string" && t.length > 0);
    row("tags", tags.join(", "), ok, `count=${tags.length}`);
  }
  // categories
  {
    const cats = Array.isArray(doc.categories) ? doc.categories : [];
    const ok = cats.length > 0 && cats.length <= 2;
    row("categories", cats.join(", "), ok, `count=${cats.length}`);
  }
  // cloudSaves
  {
    const ok = typeof doc.cloudSaves === "boolean";
    row("cloudSaves", String(doc.cloudSaves), ok, `value=${doc.cloudSaves}`);
  }
  // language compliance — basic check
  {
    const blob = [doc.shortDescription, doc.seoDescription, doc.fullDescription, doc.howToPlay].join("\n");
    if (isRu) {
      const ok = /[А-Яа-яЁё]/.test(blob);
      row("ru-script-presence", "", ok, ok ? "contains Cyrillic" : "RU text without Cyrillic");
    } else {
      const ok = !/[А-Яа-яЁё]/.test(blob);
      row("en-script-clean", "", ok, ok ? "no Cyrillic" : "EN text contains Cyrillic — fix it");
    }
  }
}

for (const f of FILES) {
  let doc;
  try {
    doc = JSON.parse(readFileSync(f.path, "utf8"));
  } catch (err) {
    issues.push(`${f.locale}: cannot read JSON: ${err.message}`);
    continue;
  }
  check(f.locale, doc, f.locale === "ru");
}

const lines = [];
lines.push("# text-check-report.md");
lines.push("");
lines.push(`Сгенерировано: ${new Date().toISOString()}`);
lines.push("");
lines.push("| Локаль | Поле | Длина | Статус | Заметки |");
lines.push("|--------|------|-------|--------|---------|");
for (const r of rows) {
  lines.push(`| ${r.locale} | ${r.field} | ${r.len} | ${r.status} | ${r.note} |`);
}
lines.push("");
if (issues.length === 0) {
  lines.push("Проблем не найдено.");
} else {
  lines.push("## Проблемы");
  for (const it of issues) lines.push(`- ${it}`);
}

const outPath = join(checklistsDir, "text-check-report.md");
writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`[check-texts] report -> ${relative(repoRoot, outPath)}`);
console.log(`[check-texts] issues: ${issues.length}`);
process.exit(issues.length === 0 ? 0 : 1);
