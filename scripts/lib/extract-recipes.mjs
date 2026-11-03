// 「成果物 / 材料 / 個数 / 費用」の表(錬金・裁縫・合成・料理)から、レシピを取り出す。
// アイテム名は ctx.ref(name) でIDにして、ctx.recipes へ追加する。
//  - 成果物セルに &br; で複数並ぶ行は、同じ材料を共有する。
//    材料セルも同じ数だけ並ぶ場合(合成の「レシピ：〜」)は、順に1対1で対応させる。
//  - 「必要材料の材料」の列がある表(裁縫のカード)は、材料自身のレシピとしても取り出す。
import { clean, parseQty, segments, withInherit } from './wiki.mjs';
import { MAT_RE, SUB_MAT_RE, groupOf, idxOf, nonEmpty, toQty } from './table-utils.mjs';

const joinSeg = (cell) => segments(cell).join(' / ');

/** 表を「成果物の並び + 材料の並び」のかたまりに読み替える */
function readBlocks(t, cols) {
  const blocks = [];
  let block = null;
  for (const { cur: c, raw } of withInherit(t.rows)) {
    if (!block || (raw[cols.name] ?? '').trim() !== '~') {
      block = {
        outs: segments(c[cols.name]),
        cost: cols.cost !== undefined ? nonEmpty(clean(c[cols.cost] ?? '')) : '',
        note: cols.note !== undefined ? joinSeg(c[cols.note]) : '',
        mats: [],
      };
      blocks.push(block);
    }

    if (cols.qty === undefined) {
      // 「材料×個数」が1セルに並ぶ形式(料理)
      for (const seg of segments(c[cols.mat])) {
        const { name, qty } = parseQty(seg);
        if (name) block.mats.push({ name, qty, subs: [] });
      }
      continue;
    }

    const qty = toQty(c[cols.qty]);
    const src = cols.src !== undefined ? joinSeg(c[cols.src]) : '';
    const names = segments(c[cols.mat]);
    const paired = names.length > 1 && names.length === block.outs.length;
    names.forEach((name, i) => {
      const only = paired ? i : undefined;
      let m = block.mats.find((x) => x.name === name && x.only === only);
      if (!m) {
        m = { name, qty, only, subs: [] };
        block.mats.push(m);
      }
      if (cols.sub !== undefined) {
        const subQty = cols.subQty !== undefined ? toQty(c[cols.subQty]) : 1;
        for (const sub of segments(c[cols.sub])) m.subs.push({ name: sub, qty: subQty, src });
      } else if (src && !m.src) {
        m.src = src;
      }
    });
  }
  return blocks;
}

export function extractRecipes(t, craft, ctx) {
  const h = t.header;
  const name = idxOf(h, /^(名称|アイテム名)$/)[0];
  const mat = idxOf(h, MAT_RE).at(-1);
  if (name === undefined || mat === undefined) return false;

  const qtyCols = idxOf(h, /個数/);
  const sub = idxOf(h, SUB_MAT_RE)[0];
  const cols = {
    name,
    mat,
    qty: qtyCols[0],
    sub,
    subQty: sub !== undefined ? qtyCols.find((i) => i > sub) : undefined,
    cost: idxOf(h, /費用/)[0],
    src: idxOf(h, /入手(先|方法|場所)/)[0],
    note: idxOf(h, /^効果$/)[0],
  };
  const group = groupOf(craft, t.path);
  const input = (m) => ({ item: ctx.ref(m.name), qty: m.qty, ...(m.src ? { src: m.src } : {}) });

  for (const b of readBlocks(t, cols)) {
    b.outs.forEach((outName, i) => {
      const mats = b.mats.filter((m) => m.only === undefined || m.only === i);
      const r = { craft, out: ctx.ref(outName), in: mats.map(input), kind: 'recipe', group };
      if (b.cost) r.cost = b.cost;
      if (b.note) r.note = b.note;
      ctx.recipes.push(r);
    });
    // 「必要材料の材料」は、材料1個あたりの作り方(裁縫の「素材」表のコットン = 糸巻き1 + レーヨンフラワー2 と一致する)
    for (const m of b.mats) {
      if (m.subs.length === 0) continue;
      ctx.recipes.push({ craft, out: ctx.ref(m.name), in: m.subs.map(input), kind: 'recipe', group });
    }
  }
  return true;
}
