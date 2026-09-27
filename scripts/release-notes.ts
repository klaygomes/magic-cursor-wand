import { readFileSync } from 'node:fs';

const version = process.argv[2];
if (!version) throw new Error('Give the version as the first argument.');

const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const heading = `## ${version}\n`;
const start = changelog.indexOf(heading);
if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}.`);

const body = changelog.slice(start + heading.length);
const next = body.search(/^## /m);
process.stdout.write(`${(next < 0 ? body : body.slice(0, next)).trim()}\n`);
