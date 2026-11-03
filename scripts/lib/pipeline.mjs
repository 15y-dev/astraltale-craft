// wiki のソース(PukiWiki 記法)から、画面用のデータを作る。ファイルは読み書きしない純粋な処理。
import { CRAFTS } from './crafts.mjs';
import { extractRecipes } from './extract-recipes.mjs';
import { extractDrops, extractUses } from './extract-sources.mjs';
import { assignIds } from './ids.mjs';
import { createRegistry } from './names.mjs';
import { isRecipeHeader } from './table-utils.mjs';
import { parseTables } from './wiki.mjs';

const IGNORED_TABLE = /^(ランク|~)?$|必要経験値|称号/;

/** 1つの表を、種類に応じて読む。読めたら true */
function readTable(t, craft, ctx) {
  if (t.header.includes('用途')) return craft === 'farming' && extractUses(t, craft, ctx);
  if (isRecipeHeader(t.header)) return extractRecipes(t, craft, ctx);
  if (t.header.includes('名称') && t.header.includes('説明')) {
    return (craft === 'fishing' || craft === 'gathering') && extractDrops(t, craft, ctx);
  }
  return false;
}

/** 同じ生産系・成果物・材料のレシピを1つにまとめる(先に出てきたものを残す) */
function dedupe(recipes) {
  const seen = new Set();
  return recipes.filter((r) => {
    const key = JSON.stringify([r.craft, r.out, r.kind, r.in.map((i) => [i.item, i.qty]).sort()]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {{ pages: Record<string,string>, aliases?: Record<string,string>, manual?: { recipes: any[] } }} input
 */
export function buildData({ pages, aliases = {}, manual = { recipes: [] } }) {
  const reg = createRegistry(aliases);
  const ctx = { ref: reg.ref, recipes: [], sources: [], greens: [] };
  const stats = [];
  const skipped = [];

  for (const craft of CRAFTS) {
    const text = pages[craft.id];
    if (text === undefined) {
      stats.push(`${craft.id}: ソースがありません`);
      continue;
    }
    const tables = parseTables(text);
    let used = 0;
    for (const t of tables) {
      if (!t.header) continue;
      if (readTable(t, craft.id, ctx)) used++;
      else if (!IGNORED_TABLE.test(t.header.join('')) && t.rows.length > 0) {
        skipped.push(`${craft.id} [${t.path.join(' / ')}] 列=${t.header.join(' / ')} (${t.rows.length}行)`);
      }
    }
    stats.push(`${craft.id}: tables=${tables.length} parsed=${used}`);
  }

  for (const m of manual.recipes) {
    ctx.recipes.push({
      craft: m.craft,
      out: reg.ref(m.out),
      in: m.in.map((i) => ({ item: reg.ref(i.item), qty: i.qty })),
      kind: 'recipe',
      group: m.group ?? '',
      ...(m.cost ? { cost: m.cost } : {}),
      ...(m.note ? { note: m.note } : {}),
    });
  }

  // 自分自身を材料にする行(料理の「鮮魚鍋×1」など、未鑑定の同一アイテム)を取り除く
  for (const r of ctx.recipes) r.in = r.in.filter((i) => i.item !== r.out);
  const cleaned = dedupe(ctx.recipes.filter((r) => r.in.length > 0));

  // 栽培の「用途」は、他の生産系に同じ材料関係のレシピがあれば重複なので捨てる
  const realEdges = new Set();
  for (const r of cleaned) if (r.kind === 'recipe') for (const i of r.in) realEdges.add(`${r.out}|${i.item}`);
  const recipes = cleaned.filter((r) => r.kind === 'recipe' || !realEdges.has(`${r.out}|${r.in[0].item}`));

  // 緑アイテムのうち、材料として使われるものだけを入手元に加える(新規アイテムは作らない)
  const usedAsInput = new Set(recipes.flatMap((r) => r.in.map((i) => i.item)));
  const sources = [...ctx.sources];
  for (const g of ctx.greens) {
    const key = reg.keyOf(g.name);
    if (reg.items.has(key) && usedAsInput.has(key)) sources.push({ item: key, craft: g.craft, via: null, place: g.place, qty: 1 });
  }

  const idOf = assignIds(reg.items.keys());
  const data = {
    crafts: CRAFTS.map(({ id, name, char }) => ({ id, name, char })),
    items: [...reg.items].map(([key, v]) => ({ id: idOf.get(key), name: v.name })),
    recipes: recipes.map((r) => ({ ...r, out: idOf.get(r.out), in: r.in.map((i) => ({ ...i, item: idOf.get(i.item) })) })),
    sources: dedupeSources(sources).map((s) => ({ ...s, item: idOf.get(s.item), via: s.via ? idOf.get(s.via) : null })),
  };
  return { data, report: makeReport({ reg, recipes, sources: data.sources, idOf, stats, skipped, dropped: ctx.recipes.length - recipes.length }) };
}

function dedupeSources(sources) {
  const seen = new Set();
  return sources.filter((s) => {
    const key = [s.item, s.craft, s.via, s.place, s.note].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeReport({ reg, recipes, sources, idOf, stats, skipped, dropped }) {
  const nameOfId = new Map([...reg.items].map(([k, v]) => [idOf.get(k), v.name]));
  const produced = new Set([...recipes.map((r) => idOf.get(r.out)), ...sources.map((s) => s.item)]);
  const useCount = new Map();
  for (const r of recipes) for (const i of r.in) useCount.set(idOf.get(i.item), (useCount.get(idOf.get(i.item)) ?? 0) + 1);
  const noOrigin = [...useCount].filter(([k]) => !produced.has(k)).sort((a, b) => b[1] - a[1]);
  const unused = [...nameOfId.keys()].filter((k) => !useCount.has(k));
  const perCraft = CRAFTS.map(
    (c) => `${c.id}: recipes=${recipes.filter((r) => r.craft === c.id).length} sources=${sources.filter((s) => s.craft === c.id).length}`,
  );
  return {
    summary: { items: reg.items.size, recipes: recipes.length, sources: sources.length, droppedDuplicates: dropped, noOrigin: noOrigin.length, skipped: skipped.length, unused: unused.length },
    text: [
      `items=${reg.items.size} recipes=${recipes.length} (dropped=${dropped}) sources=${sources.length}`,
      ...stats,
      ...perCraft,
      '',
      `## 材料として使われるが、入手元・レシピが見つからないアイテム (${noOrigin.length}件) — 表記ゆれなら data/aliases.json に追加`,
      ...noOrigin.map(([k, n]) => `${nameOfId.get(k)}\t使用${n}件`),
      '',
      `## 読み取れなかった表: ${skipped.length}件(ランク表・経験値表を除く)`,
      ...skipped,
      '',
      `## どのレシピの材料にもならないアイテム: ${unused.length}件`,
      ...unused.map((k) => nameOfId.get(k)),
    ].join('\n'),
  };
}
