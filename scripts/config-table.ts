import { existsSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Field, Section } from '../src/config/types.ts';

const SECTION_ORDER = ['theme', 'cloud', 'chalk', 'glitter', 'cursor'] as const;

const SOURCE_MODULES = [
  '../src/index.ts',
  '../src/effects/index.ts',
  '../src/cursor/index.ts',
  '../src/core/theme.ts',
  '../src/config/theme.ts',
];

const OUTPUT = new URL('../docs/reference/configuration.generated.md', import.meta.url);

const HEADER = [
  '<!-- The script scripts/config-table.ts writes this file. Do not edit it. -->',
  '',
].join('\n');

function registerSourceResolver(): void {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const isRelative = specifier.startsWith('./') || specifier.startsWith('../');
      if (!isRelative || !context.parentURL || /\.[cm]?[jt]sx?$/.test(specifier)) {
        return nextResolve(specifier, context);
      }
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        const url = new URL(candidate, context.parentURL);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      }
      return nextResolve(specifier, context);
    },
  });
}

function isSection(value: unknown): value is Section {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Section>;
  return typeof candidate.name === 'string' && typeof candidate.schema === 'object';
}

function sectionsFrom(exports: Record<string, unknown>): Section[] {
  const found: Section[] = [];
  for (const [name, value] of Object.entries(exports)) {
    if (isSection(value)) {
      found.push(value);
      continue;
    }
    const isFactory =
      typeof value === 'function' && value.length === 0 && /(Effect|Plugin|Section)$/.test(name);
    if (!isFactory) continue;
    try {
      const created: unknown = value();
      if (isSection(created)) found.push(created);
    } catch {
      // A stub factory throws. The section is then absent from the table.
    }
  }
  return found;
}

async function loadSections(): Promise<Map<string, Section>> {
  const sections = new Map<string, Section>();
  for (const path of SOURCE_MODULES) {
    const url = new URL(path, import.meta.url);
    if (!existsSync(fileURLToPath(url))) continue;
    const exports = (await import(url.href)) as Record<string, unknown>;
    for (const section of sectionsFrom(exports)) {
      if (!sections.has(section.name)) sections.set(section.name, section);
    }
  }
  return sections;
}

function code(value: unknown): string {
  return `\`${value === null ? 'null' : String(value)}\``;
}

function describeType(field: Field): string {
  switch (field.kind) {
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'enum':
      return field.options.map(code).join(', ');
    case 'color':
      return field.nullable ? 'Color or `null`' : 'Color';
  }
}

function describeRange(field: Field): string {
  if (field.kind === 'number') {
    return `${code(field.min)} to ${code(field.max)}, step ${code(field.step)}`;
  }
  if (field.kind === 'color') return '`#rrggbb`';
  return '';
}

function describeDefault(field: Field): string {
  if (field.kind === 'color' && field.default === null) return '`null` (uses `theme.color`)';
  return code(field.default);
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * Makes a Markdown table for the fields of one configuration section.
 *
 * @param section - The section to document.
 * @returns The Markdown text for the section.
 */
export function renderSection(section: Section): string {
  const rows = Object.entries(section.schema).map(([key, field]) =>
    [
      code(`${section.name}.${key}`),
      describeType(field),
      describeDefault(field),
      describeRange(field),
      escapeCell(field.description),
    ].join(' | '),
  );
  if (section.name !== 'theme' && !('enabled' in section.schema)) {
    rows.push(
      [
        code(`${section.name}.enabled`),
        'Boolean',
        code(true),
        '',
        'The section operates only when this value is `true`.',
      ].join(' | '),
    );
  }
  return [
    `## \`${section.name}\``,
    '',
    '| Path | Type | Default | Range | Description |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
    '',
  ].join('\n');
}

/**
 * Makes the Markdown page body for a list of configuration sections.
 *
 * @param sections - The sections in the order of the page.
 * @returns The Markdown text for the page.
 */
export function renderTables(sections: readonly Section[]): string {
  return [HEADER, ...sections.map(renderSection)].join('\n');
}

async function main(): Promise<void> {
  registerSourceResolver();
  const available = await loadSections();
  const missing = SECTION_ORDER.filter((name) => !available.has(name));
  if (missing.length > 0) {
    process.stderr.write(`The script cannot find these sections: ${missing.join(', ')}.\n`);
    process.exitCode = 1;
    return;
  }
  const ordered = SECTION_ORDER.map((name) => available.get(name) as Section);
  writeFileSync(OUTPUT, renderTables(ordered));
  process.stdout.write(`The script wrote ${fileURLToPath(OUTPUT)}.\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
