import { expect, test } from 'vitest';
import { fold, popularItems, search, sectionsOfCraft, unusedItems, usesOf } from '../src/lib/db.ts';
import { buildFlow } from '../src/lib/graph.ts';
import { parseHash } from '../src/lib/route.ts';
import { totalMaterials } from '../src/lib/totals.ts';
import { cyclic, sample } from './fixture.ts';

test('buildDb: 逆引き(使い道)と作り方を作る', () => {
  const db = sample();
  expect(usesOf(db, '花').map((u) => [u.out, u.qty])).toEqual([['コットン', 2]]);
  expect(db.madeBy.get('服')).toHaveLength(2);
  expect(db.usedCount.get('コットン')).toBe(1);
  expect(unusedItems(db).map((i) => i.id).sort()).toEqual(['服', '無関係'].sort());
});

test('search: 全角半角・かな/カナを無視し、空白区切りは AND', () => {
  const db = sample();
  expect(fold('ｺｯﾄﾝ')).toBe(fold('コットン'));
  expect(search(db, 'こっとん', '').map((i) => i.id)).toEqual(['コットン']);
  expect(search(db, '花 糸', '')).toEqual([]);
  expect(search(db, '', 'fishing').map((i) => i.id)).toEqual(['切り身']);
});

test('buildFlow: 材料側と成果物側を 2 段まで出す', () => {
  const db = sample();
  const flow = buildFlow(db, 'コットン');
  const depth = new Map(flow.nodes.map((n) => [n.id, n.depth]));
  expect(depth.get('コットン')).toBe(0);
  expect(depth.get('花')).toBe(-1);
  expect(depth.get('糸')).toBe(-1);
  expect(depth.get('服')).toBe(1);
  expect(flow.edges.find((e) => e.from === '花' && e.to === 'コットン')?.label).toBe('×2');
});

test('buildFlow: 釣りの魚(via)から、そこで得られるアイテムへ線が引ける', () => {
  const flow = buildFlow(sample(), '魚');
  expect(flow.nodes.map((n) => n.id).sort()).toEqual(['切り身', '服', '魚'].sort());
});

test('totalMaterials: 元の素材まで、個数を掛けて展開する', () => {
  const t = totalMaterials(sample(), '服', 2);
  // 服(先頭のレシピ)= コットン×3、コットン = 花×2 + 糸×1。これを 2 着分
  expect(Object.fromEntries(t.raw.map((r) => [r.id, r.qty]))).toEqual({ 花: 12, 糸: 6 });
  expect(t.crafted.map((c) => [c.id, c.qty])).toEqual([['コットン', 6]]);
});

test('totalMaterials: 他のレシピがあれば、その数を残す。作り方のないアイテムはそのまま素材', () => {
  const db = sample();
  expect(totalMaterials(db, '服', 1).crafted.length).toBe(1);
  expect(totalMaterials(db, '花', 5).raw).toEqual([{ id: '花', qty: 5, alternatives: 0, approximate: false }]);
});

test('totalMaterials: 循環していても止まる', () => {
  expect(totalMaterials(cyclic(), 'A', 1).cycles.length).toBeGreaterThan(0);
});

test('sectionsOfCraft: wikiの見出しごとに、表の順で並べる', () => {
  const db = sample();
  const sew = sectionsOfCraft(db, 'sewing');
  expect(sew.map((s) => s.title)).toEqual(['素材', '衣装']);
  expect(sew[1].rows).toHaveLength(1);
  expect(sectionsOfCraft(db, 'fishing')[0].rows[0]).toMatchObject({ item: '切り身', via: '魚' });
});

test('popularItems: 使い道の多い順', () => {
  expect(popularItems(sample(), 3)[0].id).toBe('切り身');
});

test('parseHash: ハッシュから画面を決める', () => {
  expect(parseHash('')).toEqual({ page: 'home' });
  expect(parseHash('#/item/abc')).toEqual({ page: 'item', id: 'abc' });
  expect(parseHash('#/craft/sewing')).toEqual({ page: 'craft', id: 'sewing' });
  expect(parseHash('#/unused')).toEqual({ page: 'unused' });
  expect(parseHash('#/item/%E3%81%82')).toEqual({ page: 'item', id: 'あ' });
});
