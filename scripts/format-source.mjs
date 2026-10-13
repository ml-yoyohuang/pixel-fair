import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
const files = [...walk('src'), ...walk('e2e'), 'vite.config.ts', 'playwright.config.ts'];
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  writeFileSync(file, printer.printFile(source));
}
console.log(`Formatted ${files.length} TypeScript files.`);
