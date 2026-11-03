// 実データで全ページをサーバー側で描画し、例外が出ないことと、主要な文言が出ることを確認する。
// ブラウザでの見た目(レイアウト)までは確認できない。
import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Page } from '../src/App.tsx';
import { buildDb, sectionsOfCraft } from '../src/lib/db.ts';
import type { RawData } from '../src/lib/types.ts';

const file = new URL('../public/data/data.json', import.meta.url);
const real = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RawData) : null;

const render = (db: ReturnType<typeof buildDb>, route: Parameters<typeof Page>[0]['route']) =>
  renderToStaticMarkup(<Page db={db} route={route} />);

test.skipIf(!real)('トップ・生産系7ページ・使い道なし一覧が描画できる', () => {
  const db = buildDb(real!);
  expect(render(db, { page: 'home' })).toContain('使い方');
  for (const c of db.crafts) {
    const html = render(db, { page: 'craft', id: c.id });
    expect(html).toContain(`<h1>${c.name}</h1>`);
    expect(html).toContain('vl-body');
  }
  expect(render(db, { page: 'unused' })).toContain('どこにも使われないアイテム');
  expect(render(db, { page: 'item', id: 'missing' })).toContain('見つかりません');
});

test.skipIf(!real)('全アイテムの詳細ページが、例外なく描画できる', () => {
  const db = buildDb(real!);
  for (const item of db.items) {
    const html = render(db, { page: 'item', id: item.id });
    expect(html).toContain(`<h1>${item.name.replace(/&/g, '&amp;')}</h1>`);
  }
});

const rowCount = (html: string) => (html.match(/class="vl-item"/g) ?? []).length;

test.skipIf(!real)('仮想スクロール: 描画する行は全件より少なく、件数の表示は全件のまま', () => {
  const db = buildDb(real!);

  const sewing = render(db, { page: 'craft', id: 'sewing' });
  const sewingTotal = db.recipes.length ? sectionTotal(db, 'sewing') : 0;
  expect(sewingTotal).toBeGreaterThan(300);
  expect(sewing).toContain(`<p class="count">${sewingTotal}件</p>`);
  expect(rowCount(sewing)).toBeGreaterThan(0);
  expect(rowCount(sewing)).toBeLessThan(sewingTotal / 2);

  const unused = render(db, { page: 'unused' });
  const unusedTotal = db.items.filter((i) => !db.usedCount.has(i.id)).length;
  expect(unused).toContain(`<p class="count">${unusedTotal}件</p>`);
  expect(rowCount(unused)).toBeLessThan(unusedTotal / 2);
});

function sectionTotal(db: ReturnType<typeof buildDb>, craft: string): number {
  return sectionsOfCraft(db, craft).reduce((n, s) => n + s.rows.length, 0);
}

test.skipIf(!real)('パタパタの切り身の詳細に、材料・成果物・入手元が出る', () => {
  const db = buildDb(real!);
  const id = db.items.find((i) => i.name === 'パタパタの切り身')!.id;
  const html = render(db, { page: 'item', id });
  expect(html).toContain('アビスパタパタ');
  expect(html).toContain('魚肉ハンバーグ');
  expect(html).toContain('×3');
});
