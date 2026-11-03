// 生成済みの実データ(npm run build:data の後に public/data/data.json ができる)に対する整合性チェック
import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { buildDb, usesOf } from '../src/lib/db.ts';
import { totalMaterials } from '../src/lib/totals.ts';
import type { RawData } from '../src/lib/types.ts';

const file = new URL('../public/data/data.json', import.meta.url);
const real = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as RawData) : null;

test.skipIf(!real)('参照が全てアイテムを指し、ID が重複しない', () => {
  const ids = new Set(real!.items.map((i) => i.id));
  expect(ids.size).toBe(real!.items.length);
  for (const r of real!.recipes) {
    expect(ids.has(r.out)).toBe(true);
    expect(r.in.length).toBeGreaterThan(0);
    for (const i of r.in) {
      expect(ids.has(i.item)).toBe(true);
      expect(i.item).not.toBe(r.out);
    }
  }
  for (const s of real!.sources) {
    expect(ids.has(s.item)).toBe(true);
    if (s.via) expect(ids.has(s.via)).toBe(true);
  }
});

test.skipIf(!real)('例に挙げた代表的なつながりが取れている', () => {
  const db = buildDb(real!);
  const id = (name: string) => {
    const hit = db.items.find((i) => i.name === name);
    if (!hit) throw new Error(`アイテムがありません: ${name}`);
    return hit.id;
  };
  const outs = (name: string) => usesOf(db, id(name)).map((u) => db.item.get(u.out)!.name);
  expect(outs('パタパタの切り身')).toContain('魚肉ハンバーグ');
  expect(outs('レーヨンフラワー')).toContain('コットン');
  expect(outs('コットン')).toContain('初級武器カード');
  expect(db.sourcesOf.get(id('パタパタの切り身'))?.[0].via).toBe(id('アビスパタパタ'));
  // 「未鑑定の」は同じアイテムとして1つにまとまる
  expect(db.items.some((i) => i.name.includes('未鑑定の'))).toBe(false);
  // 手入力のレシピ
  expect(outs('レッドローズ')).toContain('鉱山ライトヘルメット');
});

test.skipIf(!real)('上流素材の合計が、全アイテムで有限の正の個数になる', () => {
  const db = buildDb(real!);
  for (const item of db.items) {
    if (!db.madeBy.has(item.id)) continue;
    const t = totalMaterials(db, item.id, 1);
    expect(t.raw.every((r) => Number.isFinite(r.qty) && r.qty > 0)).toBe(true);
  }
});
