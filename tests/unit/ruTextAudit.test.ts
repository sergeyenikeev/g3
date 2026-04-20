import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LATIN_TOKEN_RE = /[A-Za-z][A-Za-z0-9_-]*/g;

function collectText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) text += "${...}" + span.literal.text;
    return text;
  }
  return null;
}

function scanLocalizationRuStrings() {
  const filePath = join(ROOT, "src", "i18n", "localization.ts");
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: Array<{ key: string; tokens: string[]; text: string }> = [];
  const allowedTokens = new Set(["Magnet", "Caravan"]);

  function visitRuProperty(prop: ts.ObjectLiteralElementLike, prefix = ""): void {
    if (!ts.isPropertyAssignment(prop)) return;

    const name =
      ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : null;
    if (!name) return;

    const key = prefix ? `${prefix}.${name}` : name;
    const text = collectText(prop.initializer);
    if (text !== null) {
      const tokens = [...text.matchAll(LATIN_TOKEN_RE)].map((match) => match[0]).filter((token) => !allowedTokens.has(token));
      if (tokens.length > 0) findings.push({ key, tokens: [...new Set(tokens)], text });
      return;
    }

    if (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer)) {
      if (ts.isBlock(prop.initializer.body)) return;
      const bodyText = collectText(prop.initializer.body);
      if (bodyText === null) return;
      const tokens = [...bodyText.matchAll(LATIN_TOKEN_RE)]
        .map((match) => match[0])
        .filter((token) => !allowedTokens.has(token));
      if (tokens.length > 0) findings.push({ key, tokens: [...new Set(tokens)], text: bodyText });
      return;
    }

    if (ts.isObjectLiteralExpression(prop.initializer)) {
      for (const child of prop.initializer.properties) visitRuProperty(child, key);
    }
  }

  function findRuSections(node: ts.Node): void {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (name === "ru" && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) visitRuProperty(prop);
      }
    }
    ts.forEachChild(node, findRuSections);
  }

  findRuSections(sourceFile);
  return findings;
}

function scanRuDocs() {
  const allowedTokens = new Set(["Magnet", "Caravan"]);
  const ruDocs = [
    "docs/platform_texts/yandex_ru.md",
    "docs/platform_texts/generic_ru.md",
    "docs/platform_texts/vk_ru.md",
    "docs/platform_texts/poki_ru.md",
    "docs/platform_texts/crazygames_ru.md",
    "docs/YANDEX_PUBLISH.md",
    "docs/promo/yandex/README.md",
  ];

  return ruDocs.flatMap((relativePath) => {
    const text = readFileSync(join(ROOT, relativePath), "utf8");
    const tokens = [...text.matchAll(LATIN_TOKEN_RE)].map((match) => match[0]).filter((token) => !allowedTokens.has(token));
    if (tokens.length === 0) return [];
    return [{ relativePath, tokens: [...new Set(tokens)] }];
  });
}

describe("russian text audit", () => {
  it("keeps russian game strings free from english words outside the title", () => {
    expect(scanLocalizationRuStrings()).toEqual([]);
  });

  it("keeps russian docs and upload texts free from english words outside the title", () => {
    expect(scanRuDocs()).toEqual([]);
  });
});
