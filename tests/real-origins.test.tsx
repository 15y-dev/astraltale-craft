// 生成済みの実データ(npm run astraldb の後に public/data/origins.json ができる)に対する整合性チェック。
// ファイルがなければ飛ばす。ブラウザでの見た目までは確認できない。
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Page } from '../src/App.tsx';
import { buildDb } from '../src/lib/db.ts';
import type { Origin, RawData } from '../src/lib/types.ts';

const read = <T,>(name: string): T | null => {
  const file = new URL(`../public/data/${name}`, import.meta.url);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
};
const real = read<RawData>('data.json');
const origins = read<Record<string, Origin>>('origins.json');
const ready = Boolean(real && origins);

test.skipIf(!ready)('補完データ: 全てが実在のアイテムを指し、売り手か入手元が1件以上ある', () => {
  const ids = new Set(real!.items.map((i) => i.id));
  const entries = Object.entries(origins!);
  expect(entries.length).toBeGreaterThan(0);
  for (const [id, o] of entries) {
    expect(ids.has(id)).toBe(true);
    expect(Number.isInteger(o.site)).toBe(true);
    expect(o.buy.length + o.drop.length).toBeGreaterThan(0);
    for (const p of [...o.buy, ...o.drop]) expect(p.npc.length).toBeGreaterThan(0);
  }
});

test.skipIf(!ready)('補完データ: 補ったアイテムの詳細ページが、出典リンク付きで描画できる', () => {
  const db = buildDb(real!, {}, origins!);
  for (const id of Object.keys(origins!)) {
    const html = renderToStaticMarkup(<Page db={db} route={{ page: 'item', id }} />);
    expect(html).toContain(`astraltaledb.com/jp/item/${origins![id].site}`);
    expect(html).not.toContain('モンスタードロップや購入などの可能性');
  }
});

test.skipIf(!ready)('補完データ: 蒸留水は秘密基地とセイルーン王城の商人で売っている', () => {
  const db = buildDb(real!, {}, origins!);
  const id = db.items.find((i) => i.name === '蒸留水')!.id;
  const zones = db.origins.get(id)!.buy.map((p) => p.zone);
  expect(zones).toContain('秘密基地');
  expect(zones).toContain('セイルーン王城');
});
