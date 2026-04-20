import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = fileURLToPath(new globalThis.URL("..", import.meta.url));
const allowedTokens = new Set(["Magnet", "Caravan"]);
const latinTokenRe = /[A-Za-z][A-Za-z0-9_./:-]*/g;

function rootPath(...parts) {
  return join(rootDir, ...parts);
}

function collectText(node) {
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
  const filePath = rootPath("src", "i18n", "localization.ts");
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings = [];

  function visitRuProperty(prop, prefix = "") {
    if (!ts.isPropertyAssignment(prop)) return;

    const name =
      ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name) ? prop.name.text : null;
    if (!name) return;

    const key = prefix ? `${prefix}.${name}` : name;
    const text = collectText(prop.initializer);
    if (text !== null) {
      const tokens = [...text.matchAll(latinTokenRe)].map((match) => match[0]).filter((token) => !allowedTokens.has(token));
      if (tokens.length > 0) findings.push({ file: "src/i18n/localization.ts", key, tokens: [...new Set(tokens)] });
      return;
    }

    if (ts.isArrowFunction(prop.initializer) || ts.isFunctionExpression(prop.initializer)) {
      if (ts.isBlock(prop.initializer.body)) return;
      const bodyText = collectText(prop.initializer.body);
      if (bodyText === null) return;
      const tokens = [...bodyText.matchAll(latinTokenRe)]
        .map((match) => match[0])
        .filter((token) => !allowedTokens.has(token));
      if (tokens.length > 0) findings.push({ file: "src/i18n/localization.ts", key, tokens: [...new Set(tokens)] });
      return;
    }

    if (ts.isObjectLiteralExpression(prop.initializer)) {
      for (const child of prop.initializer.properties) visitRuProperty(child, key);
    }
  }

  function findRuSections(node) {
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

function scanFiles(relativePaths) {
  return relativePaths.flatMap((relativePath) => {
    const absolutePath = rootPath(...relativePath.split("/"));
    if (!existsSync(absolutePath)) return [];
    const text = readFileSync(absolutePath, "utf8");
    const tokens = [...text.matchAll(latinTokenRe)].map((match) => match[0]).filter((token) => !allowedTokens.has(token));
    if (tokens.length === 0) return [];
    return [{ file: relativePath, tokens: [...new Set(tokens)] }];
  });
}

const sourceDocs = [
  "docs/platform_texts/yandex_ru.md",
  "docs/platform_texts/generic_ru.md",
  "docs/platform_texts/vk_ru.md",
  "docs/platform_texts/poki_ru.md",
  "docs/platform_texts/crazygames_ru.md",
  "docs/YANDEX_PUBLISH.md",
  "docs/promo/yandex/README.md",
];

const generatedDocs = [
  "dist/upload_ready/yandex/README.md",
  "dist/upload_ready/yandex/instructions/UPLOAD_CHECKLIST.md",
  "dist/upload_ready/yandex/instructions/MODERATION_EVIDENCE.md",
  "dist/upload_ready/yandex/instructions/YANDEX_PUBLISH.md",
  "dist/upload_ready/yandex/media/README.md",
  "dist/upload_ready/yandex/texts/console_fields_ru.md",
  "dist/upload_ready/yandex/texts/full_description_ru.txt",
  "dist/upload_ready/yandex/texts/how_to_play_ru.txt",
  "dist/upload_ready/yandex/texts/keywords_ru.txt",
  "dist/upload_ready/yandex/texts/short_description_ru.txt",
  "dist/upload_ready/yandex/texts/source/yandex_ru.md",
];

const findings = [...scanLocalizationRuStrings(), ...scanFiles(sourceDocs), ...scanFiles(generatedDocs)];

if (findings.length > 0) {
  console.error("Проверка русских текстов нашла латиницу вне названия игры:");
  for (const finding of findings) {
    console.error(`- ${finding.file}${finding.key ? ` (${finding.key})` : ""}: ${finding.tokens.join(", ")}`);
  }
  process.exit(1);
}

console.log("Проверка русских текстов пройдена.");
