// 釣り・採集・栽培の表から、アイテムの入手元を取り出す。
import { clean, parseQty } from './wiki.mjs';
import { groupOf, nonEmpty } from './table-utils.mjs';

/**
 * 釣り・採集: 魚群・植物・鉱脈(via)から得られるアイテム。
 * ctx.greens には、経験値・ポイント用の緑アイテムを入れる(材料として使われる場合だけ、後で入手元に加える)。
 */
export function extractDrops(t, craft, ctx) {
  const h = t.header;
  const nameCol = h.indexOf('名称');
  const descCol = h.indexOf('説明');
  const noteCol = h.indexOf('備考');
  if (nameCol < 0 || descCol < 0) return false;
  const place = groupOf(craft, t.path);

  for (const raw of t.rows) {
    const rawName = raw[nameCol] ?? '';
    const color = rawName.match(/&color\((\w+)\)/)?.[1] ?? '';
    const name = clean(rawName);
    if (!name || name === '~') continue;

    if (color === 'Green') {
      ctx.greens.push({ name, craft, place });
      continue;
    }
    if (!color) {
      const note = nonEmpty(clean(raw[noteCol] ?? ''));
      const s = { item: ctx.ref(name), craft, via: null, place, qty: 1 };
      if (note) s.note = note;
      ctx.sources.push(s);
      continue;
    }

    const via = ctx.ref(name);
    // 説明欄のうち &color(...) で囲まれたものだけが入手アイテム。色なしの文章(「錬金材料」など)は注記
    const parts = (raw[descCol] ?? '').split('&br;').filter((p) => /&color\(/.test(p));
    let found = 0;
    for (const seg of parts.map(clean).filter(Boolean)) {
      if (/^(熟練)?EXP辞典/.test(seg) || /^星界チケット/.test(seg)) continue;
      const { name: n, qty } = parseQty(seg);
      if (!n) continue;
      const item = ctx.ref(n);
      ctx.sources.push({ item, craft, via: item === via ? null : via, place, qty });
      found++;
    }
    if (found === 0) {
      // 注記しかない行は、その魚・植物・鉱脈そのものが入手アイテム
      const note = nonEmpty(clean(raw[descCol] ?? ''));
      const s = { item: via, craft, via: null, place, qty: 1 };
      if (note) s.note = note;
      ctx.sources.push(s);
    }
  }
  return true;
}

/**
 * 栽培: 「用途」列(作物 → 用途のアイテム)。個数は書かれていないので kind='use' にする。
 * 作物そのものは、栽培で得られるアイテムとして sources にも記録する。
 */
export function extractUses(t, craft, ctx) {
  const h = t.header;
  const nameCol = h.indexOf('名称');
  const useCol = h.indexOf('用途');
  const costCol = h.indexOf('費用');
  if (nameCol < 0 || useCol < 0) return false;
  const group = groupOf(craft, t.path);

  for (const raw of t.rows) {
    const crop = clean(raw[nameCol] ?? '');
    const use = clean(raw[useCol] ?? '');
    if (!nonEmpty(crop) || !nonEmpty(use)) continue;
    ctx.sources.push({ item: ctx.ref(crop), craft, via: null, place: group, qty: 1 });
    const r = { craft, out: ctx.ref(use), in: [{ item: ctx.ref(crop), qty: 1 }], kind: 'use', group };
    const cost = costCol >= 0 ? nonEmpty(clean(raw[costCol] ?? '')) : '';
    if (cost) r.cost = cost;
    ctx.recipes.push(r);
  }
  return true;
}
