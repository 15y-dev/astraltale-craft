// アストラルテイルDB(astraltaledb.com)のアイテムページ(HTML)から、入手元などを取り出す。
// ファイルは読み書きしない純粋な処理。

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** タグを外し、<br> は空白にして、実体参照を戻す */
const text = (html) =>
  decode(
    html
      .replace(/<br\s*\/?>/g, ' ')
      .replace(/<sup>[\s\S]*?<\/sup>/g, '')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();

const SECTION_RE = /<div class="card-header nested-card-header">([^<]*)<\/div>/g;

/** 「必要な材料」「売り手」などの見出しごとに、本文を切り出す */
function sectionsOf(html) {
  const marks = [...html.matchAll(SECTION_RE)].map((m) => ({ title: text(m[1]), at: m.index, start: m.index + m[0].length }));
  return marks.map((m, i) => ({ title: m.title, body: html.slice(m.start, i + 1 < marks.length ? marks[i + 1].at : html.length) }));
}

/** 「NPC / エリア」の表の行を { npc, zone, pos? } にする */
function locationRows(body) {
  const rows = [];
  for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const npc = tr[1].match(/<a[^>]*href="\/jp\/npc\/[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    if (!npc) continue;
    const zones = [...tr[1].matchAll(/<a[^>]*href="\/jp\/zone\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].map((z) => text(z[1])).filter(Boolean);
    const pos = tr[1].match(/<sup>\(([^)]*)\)<\/sup>/)?.[1].trim();
    const row = { npc: text(npc[1]), zone: [...new Set(zones)].join('・') };
    if (pos) row.pos = pos;
    rows.push(row);
  }
  return rows;
}

/** 「作成者」の表: このアイテムを作るレシピ(材料と個数、費用) */
function madeRecipes(html) {
  const at = html.indexOf('<caption>作成者</caption>');
  if (at < 0) return [];
  const next = html.indexOf('<div class="card-header nested-card-header">', at);
  const range = html.slice(at, next < 0 ? html.length : next);
  const recipes = [];
  for (const chunk of range.split('<div class="item-icons">').slice(1)) {
    const items = [...chunk.matchAll(/<a title="([^"]*)" href="\/jp\/item\/(\d+)-[^"]*">([\s\S]*?)<\/a>/g)].map((m) => ({
      id: Number(m[2]),
      name: decode(m[1]),
      qty: Number((m[3].match(/class="item-count">×([\d,]+)</)?.[1] ?? '1').replace(/,/g, '')),
    }));
    const cost = [...chunk.matchAll(/([\d,]+)\s*<div class="currency-icon"><span class="icon[^"]*" data-tippy-content="([^"]+)"/g)]
      .map((m) => `${m[1]}${decode(m[2])}`)
      .join(' ');
    if (items.length > 0) recipes.push({ in: items, ...(cost ? { cost } : {}) });
  }
  return recipes;
}

/**
 * アイテムページを読む。
 * buy=売り手(NPC販売)、drop=「入手元のアイテム」(モンスターのドロップや魚群など)、made=作成者(レシピ)
 * @returns {{ id: number, name: string, buy: object[], drop: object[], made: object[] } | null} ID・名前が読めなければ null
 */
export function parseItemPage(html) {
  // 装備品のページは、ID の後ろに強化の入力欄が付き、名前の見出しの中にも <span> が入る
  const id = html.match(/tooltip-id">ID:\s*(\d+)\s*</)?.[1];
  const nameHtml = html.match(/<h1 class="tooltip-name[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  if (!id || nameHtml === undefined) return null;
  const name = text(nameHtml);
  const sections = sectionsOf(html);
  const find = (title) => sections.find((s) => s.title === title);
  return {
    id: Number(id),
    name,
    buy: locationRows(find('売り手')?.body ?? ''),
    drop: locationRows(find('入手元のアイテム')?.body ?? ''),
    made: madeRecipes(html),
  };
}
