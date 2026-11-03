// raw/*.txt (PukiWiki ソース) を解析し、public/data/data.json と data/report.txt を生成する。
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRAFTS } from './lib/crafts.mjs';
import { buildData } from './lib/pipeline.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);

const pages = {};
for (const craft of CRAFTS) {
  const file = join(ROOT, 'raw', `${craft.id}.txt`);
  if (existsSync(file)) pages[craft.id] = await readFile(file, 'utf8');
}
const aliases = await readJson(join(ROOT, 'data', 'aliases.json'), {});
const manual = await readJson(join(ROOT, 'data', 'manual-recipes.json'), { recipes: [] });

const { data, report } = buildData({ pages, aliases, manual });

await mkdir(join(ROOT, 'public', 'data'), { recursive: true });
await writeFile(join(ROOT, 'public', 'data', 'data.json'), JSON.stringify(data), 'utf8');
await writeFile(join(ROOT, 'data', 'report.txt'), report.text, 'utf8');
console.log(report.text.split('\n').slice(0, 14).join('\n'));
