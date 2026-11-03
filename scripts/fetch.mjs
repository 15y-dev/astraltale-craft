// 生産系7ページの wiki ソース(PukiWiki 記法)を raw/ に保存する。一度実行すれば足りる。
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRAFTS } from './lib/crafts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw');

const PAGES = CRAFTS.map((c) => [c.id, c.name]);

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429/5xx のときは待ってから再試行する(待ち時間は 30s, 60s, 90s, ...)。
async function fetchWithRetry(url, name, maxTry = 6) {
  for (let i = 1; i <= maxTry; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'astraltale-item-guide (personal fan tool)' } });
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`${name}: HTTP ${res.status}`);
    const wait = 30000 * i;
    console.log(`${name}: HTTP ${res.status}, retry ${i}/${maxTry} after ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`${name}: gave up after ${maxTry} tries`);
}

await mkdir(RAW_DIR, { recursive: true });

for (const [id, name] of PAGES) {
  const file = join(RAW_DIR, `${id}.txt`);
  if (existsSync(file) && !process.argv.includes('--force')) {
    console.log(`${id} (${name}): already saved, skip`);
    continue;
  }
  const url = `https://wikiwiki.jp/seikai/?cmd=source&page=${encodeURIComponent(`生産/${name}`)}`;
  const res = await fetchWithRetry(url, name);
  const html = await res.text();
  const m = html.match(/<pre[^>]*id="source"[^>]*>([\s\S]*?)<\/pre>/) ?? html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/);
  if (!m) throw new Error(`${name}: source <pre> not found`);
  const source = decodeEntities(m[1]);
  await writeFile(file, source, 'utf8');
  console.log(`${id} (${name}): ${source.split('\n').length} lines, ${source.length} chars`);
  await sleep(5000); // wiki への負荷を避ける
}
console.log('all done');
