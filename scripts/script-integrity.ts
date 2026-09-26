import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const FILES = [
  '../README.md',
  '../docs/snippets/script-tag.html',
  '../examples/script-tag.html',
].map((path) => new URL(path, import.meta.url));

const SCRIPT_SOURCE =
  /(\s+)src="https:\/\/cdn\.jsdelivr\.net\/npm\/magic-cursor-wand(?:@[^/"]+)?\/dist\/magic-cursor-wand\.iife\.js"(?:\s+integrity="[^"]*")?(?:\s+crossorigin="[^"]*")?/g;

const ATTEMPTS = 10;
const RETRY_DELAY_MS = 15_000;

function packageVersion(): string {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return manifest.version as string;
}

function cdnUrl(version: string): string {
  return `https://cdn.jsdelivr.net/npm/magic-cursor-wand@${version}/dist/magic-cursor-wand.iife.js`;
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url);
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === ATTEMPTS)
      throw new Error(`The download of ${url} failed with status ${response.status}.`);
    await delay(RETRY_DELAY_MS);
  }
}

function sha384(content: Buffer): string {
  return `sha384-${createHash('sha384').update(content).digest('base64')}`;
}

function pinScripts(text: string, url: string, integrity: string): string {
  return text.replace(
    SCRIPT_SOURCE,
    (_match, separator: string) =>
      `${separator}src="${url}"${separator}integrity="${integrity}"${separator}crossorigin="anonymous"`,
  );
}

const url = cdnUrl(packageVersion());
const integrity = sha384(await download(url));

for (const file of FILES) {
  const text = readFileSync(file, 'utf8');
  const pinned = pinScripts(text, url, integrity);
  if (pinned !== text) writeFileSync(file, pinned);
}

console.log(`${url} ${integrity}`);
