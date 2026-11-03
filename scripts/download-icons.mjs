// astraltaledb.com (日本語版) のアイテム一覧を巡回し、アイテムアイコンを icons/ に保存する。
// 使い方:
//   npm run icons -- --used        このプロジェクトのアイテム(public/data/data.json)だけ → public/icons/
//   npm run icons                  サイトの全アイテム → icons/
//   npm run icons -- --pages 1-3   ページ範囲を指定(動作確認用)
//   npm run icons -- --force       保存済みの画像も再取得
//   npm run icons -- --refresh     --used でサイト一覧のキャッシュを使わず再取得
// 保存済みの画像はスキップするので、中断しても再実行すれば続きから取得できる。
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, stripUnidentified } from './lib/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www.astraltaledb.com/jp/items';
const UA = 'astraltale-item-guide (personal fan tool)';
const PAGE_DELAY_MS = 700; // 一覧ページ取得の間隔(サイトへの負荷を避ける)
const IMAGE_CONCURRENCY = 6; // 画像は CDN から並列で取得する
const SITE_CACHE = join(ROOT, 'data', 'tmp-site-items.json'); // サイト全アイテムのキャッシュ(.gitignore 済み)

const args = process.argv.slice(2);
const force = args.includes('--force');
const used = args.includes('--used');
const refresh = args.includes('--refresh');
const pagesArg = args.includes('--pages') ? args[args.indexOf('--pages') + 1] : null;
const OUT_DIR = used ? join(ROOT, 'public', 'icons') : join(ROOT, 'icons');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

// 429/5xx のときは待ってから再試行する(待ち時間は 10s, 20s, 30s, ...)。
async function fetchWithRetry(url, maxTry = 6) {
  for (let i = 1; i <= maxTry; i++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA } });
    } catch (e) {
      if (i === maxTry) throw e;
      console.log(`${url}: ${e.message}, retry ${i}/${maxTry}`);
      await sleep(10000 * i);
      continue;
    }
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) throw new Error(`${url}: HTTP ${res.status}`);
    const wait = 10000 * i;
    console.log(`${url}: HTTP ${res.status}, retry ${i}/${maxTry} after ${wait / 1000}s`);
    await sleep(wait);
  }
  throw new Error(`${url}: gave up after ${maxTry} tries`);
}

const pageUrl = (n) => (n === 1 ? BASE : `${BASE}/page/${n}`);

// 一覧ページから { id, name, icon } を取り出す。
function parseRows(html) {
  const items = [];
  for (const row of html.split('<tr>').slice(1)) {
    const icon = row.match(/\/images\/icons\/([^"'\s/]+\.png)/);
    const link = row.match(/href="\/jp\/item\/(\d+)-[^"]*">([^<]*)<\/a>/);
    if (!icon || !link) continue;
    items.push({ id: Number(link[1]), name: decodeEntities(link[2]), icon: icon[1] });
  }
  return items;
}

const lastPageOf = (html) =>
  Math.max(1, ...[...html.matchAll(/\/jp\/items\/page\/(\d+)/g)].map((m) => Number(m[1])));

/** サイトの一覧ページを巡回して { id, name, icon }[] を返す */
async function crawlSite(from, to, first) {
  const items = new Map();
  for (let n = from; n <= to; n++) {
    const html = n === 1 ? first : await (await fetchWithRetry(pageUrl(n))).text();
    const rows = parseRows(html);
    for (const it of rows) items.set(it.id, it);
    if (rows.length === 0) console.log(`page ${n}: no items found (HTML 構造が変わった可能性)`);
    if (n % 25 === 0 || n === to) console.log(`page ${n}/${to}: items=${items.size}`);
    if (n < to) await sleep(PAGE_DELAY_MS);
  }
  return [...items.values()].sort((a, b) => a.id - b.id);
}

await mkdir(OUT_DIR, { recursive: true });

// 1) サイトのアイテム一覧を用意する(--used ではキャッシュがあれば再利用)
let siteItems;
if (used && !refresh && !pagesArg && existsSync(SITE_CACHE)) {
  siteItems = JSON.parse(await readFile(SITE_CACHE, 'utf8'));
  console.log(`site items: ${siteItems.length} (cache: ${SITE_CACHE})`);
} else {
  const first = await (await fetchWithRetry(pageUrl(1))).text();
  const totalPages = lastPageOf(first);
  let [from, to] = [1, totalPages];
  if (pagesArg) {
    const m = pagesArg.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`--pages の形式が不正です: ${pagesArg} (例: 1-3)`);
    from = Number(m[1]);
    to = Math.min(Number(m[2] ?? m[1]), totalPages);
  }
  console.log(`list pages: ${totalPages} total, fetching ${from}-${to}`);
  siteItems = await crawlSite(from, to, first);
  console.log(`site items=${siteItems.length}`);
  if (!pagesArg) await writeFile(SITE_CACHE, JSON.stringify(siteItems), 'utf8');
}

/** アイコン画像を CDN から OUT_DIR に保存する。保存済みはスキップ */
async function downloadIcons(icons) {
  let done = 0;
  let saved = 0;
  let skipped = 0;
  const failed = [];
  const queue = [...icons];
  async function worker() {
    while (queue.length > 0) {
      const icon = queue.shift();
      const file = join(OUT_DIR, icon);
      try {
        if (existsSync(file) && !force) {
          skipped++;
        } else {
          const res = await fetchWithRetry(`https://cdn.astraltaledb.com/images/icons/${icon}`);
          await writeFile(file, Buffer.from(await res.arrayBuffer()));
          saved++;
        }
      } catch (e) {
        failed.push(icon);
        console.log(`failed: ${icon} (${e.message})`);
      }
      done++;
      if (done % 200 === 0 || done === icons.length) {
        console.log(`images ${done}/${icons.length} (saved=${saved} skipped=${skipped} failed=${failed.length})`);
      }
    }
  }
  await Promise.all(Array.from({ length: IMAGE_CONCURRENCY }, worker));
  return { saved, skipped, failed };
}

const finish = ({ saved, skipped, failed }) => {
  console.log(`all done: saved=${saved} skipped=${skipped} failed=${failed.length}`);
  if (failed.length > 0) process.exitCode = 1;
};

if (!used) {
  // 全アイテムモード: 全アイコンを icons/ に保存し、対応表を index.json に残す
  const icons = [...new Set(siteItems.map((it) => it.icon))].sort();
  console.log(`unique icons=${icons.length}`);
  const result = await downloadIcons(icons);
  if (!pagesArg) await writeFile(join(OUT_DIR, 'index.json'), JSON.stringify(siteItems, null, 1), 'utf8');
  finish(result);
} else {
  // 2) プロジェクトのアイテム名とサイトのアイテム名を突き合わせる
  const dataFile = join(ROOT, 'public', 'data', 'data.json');
  if (!existsSync(dataFile)) throw new Error('public/data/data.json がありません。先に npm run build:data を実行してください');
  const projectItems = JSON.parse(await readFile(dataFile, 'utf8')).items;

  // 同名のアイテムが複数あるときは ID が最小のものを採用する(siteItems は ID 昇順)
  const siteByName = new Map();
  let dupNames = 0;
  for (const it of siteItems) {
    const key = norm(stripUnidentified(it.name));
    if (siteByName.has(key)) dupNames++;
    else siteByName.set(key, it);
  }

  const iconOf = {}; // プロジェクトのアイテムID -> アイコンのファイル名
  const missing = [];
  for (const p of projectItems) {
    const hit = siteByName.get(norm(p.name));
    if (hit) iconOf[p.id] = hit.icon;
    else missing.push(p.name);
  }
  const icons = [...new Set(Object.values(iconOf))].sort();
  console.log(`project items=${projectItems.length} matched=${Object.keys(iconOf).length} unmatched=${missing.length} (site duplicate names=${dupNames})`);
  console.log(`unique icons=${icons.length}`);

  // 3) 一致したものだけダウンロードし、対応表と未一致リストを保存する
  const result = await downloadIcons(icons);
  await writeFile(join(ROOT, 'public', 'data', 'icons.json'), JSON.stringify(iconOf), 'utf8');
  await writeFile(join(ROOT, 'data', 'report-icons.txt'), `未一致 ${missing.length}件\n${missing.join('\n')}\n`, 'utf8');
  console.log(`public/data/icons.json: ${Object.keys(iconOf).length} items`);
  console.log(`data/report-icons.txt: unmatched ${missing.length}`);
  finish(result);
}
