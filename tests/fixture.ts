import { buildDb, type Db } from '../src/lib/db.ts';
import type { RawData } from '../src/lib/types.ts';

export const crafts = [
  { id: 'fishing', name: '釣り', char: '釣' },
  { id: 'farming', name: '栽培', char: '栽' },
  { id: 'sewing', name: '裁縫', char: '縫' },
];

/** 小さな手作りのデータ: 魚 → 切り身(釣り) / 花 + 糸 → コットン(裁縫) → 服(コットンか切り身から) */
export function sample(): Db {
  const raw: RawData = {
    crafts,
    items: ['魚', '切り身', '花', '糸', 'コットン', '服', '無関係'].map((name) => ({ id: name, name })),
    recipes: [
      { craft: 'sewing', out: 'コットン', in: [{ item: '花', qty: 2 }, { item: '糸', qty: 1 }], kind: 'recipe', group: '素材' },
      { craft: 'sewing', out: '服', in: [{ item: 'コットン', qty: 3 }], kind: 'recipe', group: '衣装' },
      { craft: 'sewing', out: '服', in: [{ item: '切り身', qty: 1 }], kind: 'recipe', group: '衣装' },
    ],
    sources: [
      { item: '切り身', craft: 'fishing', via: '魚', place: '魚群 / ランク1～8', qty: 1 },
      { item: '花', craft: 'farming', via: null, place: '裁縫用', qty: 1 },
    ],
  };
  return buildDb(raw);
}

export function cyclic(): Db {
  return buildDb({
    crafts,
    items: [
      { id: 'A', name: 'A' },
      { id: 'B', name: 'B' },
    ],
    recipes: [
      { craft: 'sewing', out: 'A', in: [{ item: 'B', qty: 1 }], kind: 'recipe', group: '' },
      { craft: 'sewing', out: 'B', in: [{ item: 'A', qty: 1 }], kind: 'recipe', group: '' },
    ],
    sources: [],
  });
}
