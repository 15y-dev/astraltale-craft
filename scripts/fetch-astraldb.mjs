// アストラルテイルDB(astraltaledb.com)で、wiki の表に入手元・レシピがないアイテムを補完する。
// 「材料として使われるのに、作り方も入手元も表にないアイテム」のページを取得し、
// 売り手(NPC販売)と「入手元のアイテム」(ドロップ・鉱脈など)を public/data/origins.json に保存する。
//
// 事前に: npm run build:data (data.json) と npm run icons -- --used (data/tmp-site-items.json: サイトの一覧)
// 使い方:
//   npm run astraldb                 補完対象をすべて取得(取得済みはスキップ。中断しても続きから)
//   npm run astraldb -- --limit 20   先頭から20件だけ(動作確認用)
//   npm run astraldb -- --force      取得済みも再取得
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseItemPage } from './lib/astraldb.mjs';
import { norm, stripUnidentified } from './lib/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = join(ROOT, 'public', 'data', 'data.json');
const SITE_LIST = join(ROOT, 'data', 'tmp-site-items.json');
const CACHE_FILE = join(ROOT, 'data', 'astraldb-cache.json');
const OUT_FILE = join(ROOT, 'public', 'data', 'origins.json');
const REPORT_FILE = join(ROOT, 'data', 'report-astraldb.txt');
const UA = 'astraltale-item-guide (personal fan tool)';
const DELAY_MS = 700; // サイトへの負荷を避ける
const MAX_CANDIDATES = 6; // 同名アイテムが多いときに調べる上限

const args = process.argv.slice(2);
const force = args.includes('--force');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429/5xx のときは待ってから再試行する(待ち時間は 10s, 20s, 30s, ...)。
async function fetchText(url, maxTry = 6) {
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
    if (res.ok) return res.text();
    if (res.status !== 429 && res.status < 500) throw new Error(`${url}: HTTP ${res.status}`);
    console.log(`${url}: HTTP ${res.status}, retry ${i}/${maxTry} after ${10 * i}s`);
    await sleep(10000 * i);
  }
  throw new Error(`${url}: gave up after ${maxTry} tries`);
}

const readJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);

if (!existsSync(DATA_FILE)) throw new Error('public/data/data.json がありません。先に npm run build:data を実行してください');
if (!existsSync(SITE_LIST)) throw new Error('data/tmp-site-items.json がありません。先に npm run icons -- --used を実行してください');

const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const site = JSON.parse(await readFile(SITE_LIST, 'utf8')); // [{ id, name, icon }] ID 昇順
const cache = await readJson(CACHE_FILE, {}); // サイトのアイテムID -> 解析結果

// 1) 補完の対象: 材料として使われるのに、作り方も入手元もないアイテム
const produced = new Set([...data.recipes.map((r) => r.out), ...data.sources.map((s) => s.item)]);
const used = new Set(data.recipes.flatMap((r) => r.in.map((i) => i.item)));
const targets = data.items.filter((i) => used.has(i.id) && !produced.has(i.id)).slice(0, limit);

const siteByName = new Map();
for (const s of site) {
  const k = norm(stripUnidentified(s.name));
  if (!siteByName.has(k)) siteByName.set(k, []);
  siteByName.get(k).push(s);
}
console.log(`targets=${targets.length} (data.json items=${data.items.length}), cached pages=${Object.keys(cache).length}`);

// 2) サイトのページを取得して解析する(同名が複数あれば、売り手かドロップが載っているものが見つかるまで)
const hasOrigin = (p) => p.buy.length > 0 || p.drop.length > 0;
const origins = {};
const report = { unmatched: [], noData: [], ambiguous: [], withRecipe: [], failed: [] };
let fetched = 0;

async function pageOf(siteId) {
  if (cache[siteId] && !force) return cache[siteId];
  const html = await fetchText(`https://www.astraltaledb.com/jp/item/${siteId}`);
  const parsed = parseItemPage(html);
  if (!parsed) throw new Error(`item ${siteId}: ページを解析できませんでした`);
  cache[siteId] = parsed;
  fetched++;
  await sleep(DELAY_MS);
  return parsed;
}

for (const [n, item] of targets.entries()) {
  const candidates = siteByName.get(norm(item.name)) ?? [];
  if (candidates.length === 0) {
    report.unmatched.push(item.name);
    continue;
  }
  if (candidates.length > 1) report.ambiguous.push(`${item.name}\t候補ID: ${candidates.map((c) => c.id).join(',')}`);
  let chosen = null;
  try {
    for (const c of candidates.slice(0, MAX_CANDIDATES)) {
      const p = await pageOf(c.id);
      if (!chosen) chosen = p; // どれも載っていなければ最初の候補
      if (hasOrigin(p)) {
        chosen = p;
        break;
      }
    }
  } catch (e) {
    report.failed.push(`${item.name}\t${e.message}`);
    console.log(`failed: ${item.name} (${e.message})`);
    continue;
  }
  if (chosen.made.length > 0) report.withRecipe.push(`${item.name}\tサイトのID ${chosen.id}\tレシピ${chosen.made.length}件`);
  if (!hasOrigin(chosen)) {
    report.noData.push(item.name);
  } else {
    origins[item.id] = { site: chosen.id, buy: chosen.buy, drop: chosen.drop };
  }
  if ((n + 1) % 50 === 0) {
    console.log(`${n + 1}/${targets.length} (fetched=${fetched})`);
    await writeFile(CACHE_FILE, JSON.stringify(cache), 'utf8'); // 途中経過を保存する
  }
}
// 3) 保存
await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(CACHE_FILE, JSON.stringify(cache), 'utf8');
await writeFile(OUT_FILE, JSON.stringify(origins), 'utf8');
const section = (title, rows) => `## ${title}: ${rows.length}件\n${rows.join('\n')}`;
await writeFile(
  REPORT_FILE,
  [
    `対象 ${targets.length}件 / 補完できた ${Object.keys(origins).length}件`,
    '',
    section('サイトに同名のアイテムがない', report.unmatched),
    '',
    section('サイトにあるが、売り手・入手元の記載がない', report.noData),
    '',
    section('サイトに同名が複数ある(売り手・入手元が載っている最初のIDを採用)', report.ambiguous),
    '',
    section('サイトにレシピ(作成者)が載っている(今回は取り込んでいない)', report.withRecipe),
    '',
    section('取得に失敗', report.failed),
    '',
  ].join('\n'),
  'utf8',
);
console.log(`origins.json: ${Object.keys(origins).length}件 / 未一致 ${report.unmatched.length} / 記載なし ${report.noData.length} / 失敗 ${report.failed.length}`);
console.log('all done');
if (report.failed.length > 0) process.exitCode = 1;


