// PukiWiki ソースの表パーサー(wikiwiki.jp 星界神話 wiki 用)

const PREFIX = /^(?:(?:LEFT|CENTER|RIGHT|BOLD|SIZE\([^)]*\)|COLOR\([^)]*\)|BGCOLOR\([^)]*\)):)+/;
export const stripPrefix = (c) => c.replace(PREFIX, '');

function stripLinks(s) {
  // [[表示名>リンク先]] → 表示名。 [[名前]] → 名前
  return s.replace(/\[\[(.*?)\]\]/g, (_, inner) => {
    const i = inner.lastIndexOf('>');
    return i >= 0 ? inner.slice(0, i) : inner;
  });
}

export function clean(s) {
  let t = s ?? '';
  t = t.replace(/&attachref\((?:[^()]|\([^()]*\))*\);?/g, '');
  t = stripLinks(t);
  for (let i = 0; i < 3; i++) t = t.replace(/&(?:color|size)\([^)]*\)\{([^{}]*)\};?/g, '$1');
  t = t.replace(/&br;/g, ' ');
  t = t.replace(/&[a-z]+\((?:[^()]|\([^()]*\))*\);?/g, '');
  t = t.replace(/''+/g, '');
  return t.replace(/[\s\u3000]+/g, ' ').trim();
}

// セルを &br; で分割し、整形して空と '~' を除く
export const segments = (cell) =>
  (cell ?? '')
    .split('&br;')
    .map(clean)
    .filter((x) => x && x !== '~');

// 「名前×3」→ { name, qty }。個数がなければ 1
export function parseQty(seg) {
  const m = seg.match(/^(.*?)\s*[×x]\s*(\d[\d,]*)$/);
  if (m) return { name: m[1].trim(), qty: Number(m[2].replace(/,/g, '')) };
  return { name: seg.trim(), qty: 1 };
}

const rowKind = (line) => (line.match(/\|([hfc])\s*$/i)?.[1] ?? '').toLowerCase();

function splitRow(line) {
  let s = line.trim().replace(/\|[hfc]$/i, '|');
  s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|');
}

// '>' は「右のセルと結合」。結合された列数ぶん同じ値を複製して列番号をそろえる
function expand(cells, mapper) {
  const out = [];
  let span = false;
  for (const raw of cells) {
    const c = mapper(raw);
    if (c.trim() === '>') {
      span = true;
      continue;
    }
    out.push(c);
    if (span) {
      out.push(c);
      span = false;
    }
  }
  return out;
}

const headerCell = (raw) => stripPrefix(raw).replace(/^~/, '').trim();

// 見出し(*, **, ***)を追跡しながら、全ての表を { path, header, rows } で返す
// path は見出しの階層(例: ['裁縫', '装備', '武器'])。大陸の見出しは、ランクの見出しの手前に入る
export function parseTables(text) {
  const lines = text
    .replace(/^<code>/, '')
    .replace(/<\/code>\s*$/, '')
    .split(/\r?\n/);
  const tables = [];
  const ctx = { h1: '', continent: '', h2: '', h3: '' };
  const pathOf = () => [ctx.h1, ctx.continent, ctx.h2, ctx.h3].filter(Boolean);
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('|')) {
      if (!cur) {
        cur = { path: pathOf(), header: null, rows: [] };
        tables.push(cur);
      }
      const kind = rowKind(line);
      if (kind === 'c' || kind === 'f') continue;
      const cells = splitRow(line);
      if (kind === 'h') {
        if (!cur.header) cur.header = expand(cells, headerCell);
        continue;
      }
      cur.rows.push(expand(cells, stripPrefix));
      continue;
    }
    cur = null;
    const m = line.match(/^(\*{1,3})\s*(.*)$/);
    if (!m) continue;
    const title = m[2].replace(/\s*\[#[^\]]*\]\s*$/, '').trim();
    if (m[1].length === 1) {
      ctx.h1 = title;
      ctx.continent = '';
      ctx.h2 = '';
      ctx.h3 = '';
    } else if (m[1].length === 2) {
      if (/大陸$/.test(title)) {
        ctx.continent = title;
        ctx.h2 = '';
      } else {
        ctx.h2 = title;
      }
      ctx.h3 = '';
    } else if (m[1].length === 3) {
      ctx.h3 = title;
    }
  }
  return tables;
}

// '~' のセルは上のセルと同じ値(rowspan)。cur は継承後、raw は継承前の値。
export function withInherit(rows) {
  let prev = [];
  return rows.map((raw) => {
    const cur = raw.map((c, i) => (c.trim() === '~' ? (prev[i] ?? '') : c));
    prev = cur;
    return { cur, raw };
  });
}
