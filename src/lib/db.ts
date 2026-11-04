import type { Craft, Item, Origin, RawData, Recipe, Source } from './types.ts';

export interface Use {
  recipe: Recipe;
  qty: number;
}

export interface Db {
  crafts: Craft[];
  items: Item[];
  /** wiki の表の出現順のまま */
  recipes: Recipe[];
  sources: Source[];
  item: Map<string, Item>;
  craft: Map<string, Craft>;
  /** アイテム → それを材料にするレシピ */
  usedIn: Map<string, Use[]>;
  /** アイテム → それを作るレシピ */
  madeBy: Map<string, Recipe[]>;
  sourcesOf: Map<string, Source[]>;
  /** 魚・植物・鉱脈(via)→ そこから得られるアイテムの入手情報 */
  sourcesVia: Map<string, Source[]>;
  /** アイテムが登場する生産系 */
  craftsOf: Map<string, Set<string>>;
  /** アイテム → 使い道(重複を除いた成果物の数) */
  usedCount: Map<string, number>;
  searchKey: Map<string, string>;
  /** アイテム → アイコンのファイル名(public/icons/ の中)。画像がないアイテムは含まれない */
  icons: Map<string, string>;
  /** アイテム → アストラルテイルDBで補った入手元(売り手・ドロップなど)。なければ含まれない */
  origins: Map<string, Origin>;
}

/** 検索用: 全角半角・大文字小文字・ひらがなカタカナの違いを無視する */
export function fold(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/\s+/g, '');
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

function mark(m: Map<string, Set<string>>, id: string, craft: string) {
  const s = m.get(id);
  if (s) s.add(craft);
  else m.set(id, new Set([craft]));
}

export function buildDb(raw: RawData, icons: Record<string, string> = {}, origins: Record<string, Origin> = {}): Db {
  const usedIn = new Map<string, Use[]>();
  const madeBy = new Map<string, Recipe[]>();
  const sourcesOf = new Map<string, Source[]>();
  const sourcesVia = new Map<string, Source[]>();
  const craftsOf = new Map<string, Set<string>>();

  for (const r of raw.recipes) {
    push(madeBy, r.out, r);
    mark(craftsOf, r.out, r.craft);
    for (const i of r.in) {
      push(usedIn, i.item, { recipe: r, qty: i.qty });
      mark(craftsOf, i.item, r.craft);
    }
  }
  for (const s of raw.sources) {
    push(sourcesOf, s.item, s);
    if (s.via) push(sourcesVia, s.via, s);
    mark(craftsOf, s.item, s.craft);
  }

  // 使い道 = 材料にする成果物 + (魚・植物・鉱脈なら)そこから得られるアイテム
  const usedCount = new Map<string, number>();
  const leadsTo = new Set([...usedIn.keys(), ...sourcesVia.keys()]);
  for (const id of leadsTo) {
    const outs = new Set((usedIn.get(id) ?? []).map((u) => u.recipe.out));
    for (const s of sourcesVia.get(id) ?? []) outs.add(s.item);
    usedCount.set(id, outs.size);
  }

  return {
    crafts: raw.crafts,
    items: raw.items,
    recipes: raw.recipes,
    sources: raw.sources,
    item: new Map(raw.items.map((i) => [i.id, i])),
    craft: new Map(raw.crafts.map((c) => [c.id, c])),
    usedIn,
    madeBy,
    sourcesOf,
    sourcesVia,
    craftsOf,
    usedCount,
    searchKey: new Map(raw.items.map((i) => [i.id, fold(i.name)])),
    icons: new Map(Object.entries(icons)),
    origins: new Map(Object.entries(origins)),
  };
}

export const itemName = (db: Db, id: string): string => db.item.get(id)?.name ?? id;
export const craftName = (db: Db, id: string): string => db.craft.get(id)?.name ?? id;

const unique = <T>(xs: Iterable<T>): T[] => [...new Set(xs)];
const joinCraftNames = (db: Db, ids: Iterable<string>): string => unique([...ids].map((c) => craftName(db, c))).join('・');

/** 「どこで作る/得られるか」を短く説明する文(図の枠の下、合計の入手元欄に使う) */
export function originOf(db: Db, id: string): string {
  const made = db.madeBy.get(id);
  if (made?.length) return `${joinCraftNames(db, made.map((r) => r.craft))}で作る`;
  const src = db.sourcesOf.get(id);
  if (src?.length) return `${joinCraftNames(db, src.map((s) => s.craft))}で入手`;
  const via = db.sourcesVia.get(id)?.[0];
  if (via) return `${craftName(db, via.craft)} ${via.place}`.trim();
  const o = db.origins.get(id);
  if (o) return [o.buy.length > 0 ? 'NPC販売' : '', o.drop.length > 0 ? 'ドロップ・採取' : ''].filter(Boolean).join('・');
  return '';
}

/** そのアイテムを作る・得る主な生産系。分からなければ空 */
export function mainCraftOf(db: Db, id: string): string {
  return db.madeBy.get(id)?.[0]?.craft ?? db.sourcesOf.get(id)?.[0]?.craft ?? db.sourcesVia.get(id)?.[0]?.craft ?? '';
}

export interface UseRow {
  out: string;
  craft: string;
  group: string;
  qty: number;
  kind: Recipe['kind'];
}

/** id を材料にする成果物を、成果物×生産系ごとにまとめる(必要数は最大のもの) */
export function usesOf(db: Db, id: string): UseRow[] {
  const rows = new Map<string, UseRow>();
  for (const u of db.usedIn.get(id) ?? []) {
    const key = `${u.recipe.out}|${u.recipe.craft}`;
    const prev = rows.get(key);
    if (prev) prev.qty = Math.max(prev.qty, u.qty);
    else rows.set(key, { out: u.recipe.out, craft: u.recipe.craft, group: u.recipe.group, qty: u.qty, kind: u.recipe.kind });
  }
  return [...rows.values()];
}

/** 名前の検索。空白区切りは AND。前方一致を先に、同順位は名前の短い順。craft を指定するとその生産系に登場するものだけ */
export function search(db: Db, query: string, craft: string): Item[] {
  const terms = query
    .split(/[\s\u3000]+/)
    .map(fold)
    .filter(Boolean);
  const hits: { item: Item; rank: number }[] = [];
  for (const item of db.items) {
    if (craft && !db.craftsOf.get(item.id)?.has(craft)) continue;
    const key = db.searchKey.get(item.id) ?? '';
    if (!terms.every((t) => key.includes(t))) continue;
    const rank = terms.length > 0 && key.startsWith(terms[0]) ? 0 : 1;
    hits.push({ item, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.item.name.length - b.item.name.length);
  return hits.map((h) => h.item);
}

/** 使い道の多い順のアイテム(トップの「よく使われる素材」) */
export function popularItems(db: Db, limit: number): Item[] {
  return db.items
    .filter((i) => (db.usedCount.get(i.id) ?? 0) > 0 && (db.sourcesOf.has(i.id) || db.madeBy.has(i.id)))
    .sort((a, b) => (db.usedCount.get(b.id) ?? 0) - (db.usedCount.get(a.id) ?? 0))
    .slice(0, limit);
}

/** 使い道のないアイテム(どのレシピの材料にもならず、他のアイテムの入手元にもならない) */
export function unusedItems(db: Db): Item[] {
  return db.items.filter((i) => !db.usedCount.has(i.id));
}

export interface CraftRow {
  item: string;
  /** レシピの材料(個数付き)。入手元の表なら空 */
  recipe: Recipe | null;
  /** 魚・植物・鉱脈など、そこから得られる元のアイテム */
  via: string | null;
  note: string;
}

export interface CraftSection {
  title: string;
  rows: CraftRow[];
}

/** 生産系ページ用: wiki の見出しごとに、その生産系で作る・得るアイテムを並べる */
export function sectionsOfCraft(db: Db, craft: string): CraftSection[] {
  const sections = new Map<string, CraftSection>();
  const seen = new Set<string>();
  const section = (title: string) => {
    let s = sections.get(title);
    if (!s) {
      s = { title, rows: [] };
      sections.set(title, s);
    }
    return s;
  };
  for (const r of db.recipes) {
    if (r.craft !== craft) continue;
    const key = `${r.group}|${r.out}`;
    if (seen.has(key)) continue;
    seen.add(key);
    section(r.group).rows.push({ item: r.out, recipe: r, via: null, note: r.note ?? '' });
  }
  for (const s of db.sources) {
    if (s.craft !== craft) continue;
    const key = `${s.place}|${s.item}|${s.via}`;
    if (seen.has(key)) continue;
    seen.add(key);
    section(s.place).rows.push({ item: s.item, recipe: null, via: s.via, note: s.note ?? '' });
  }
  return [...sections.values()];
}
