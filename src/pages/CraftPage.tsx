import { useMemo, useRef, useState } from 'react';
import { ItemLink, Materials, NotFound } from '../components/Links.tsx';
import { VirtualList, type VirtualListHandle } from '../components/VirtualList.tsx';
import { craftName, fold, sectionsOfCraft, usesOf, type CraftRow, type Db } from '../lib/db.ts';

/** 区分の見出し行と、アイテム行を、1本のリストに並べる */
type Line = { kind: 'title'; title: string; count: number } | { kind: 'row'; row: CraftRow };

function UsedBy({ db, item }: { db: Db; item: string }) {
  const uses = usesOf(db, item);
  if (uses.length === 0) return <span className="empty">—</span>;
  return (
    <ul className="inline">
      {uses.map((u) => (
        <li key={`${u.out}|${u.craft}`}>
          <ItemLink db={db} id={u.out} />
          <span className="mini">{craftName(db, u.craft)}</span>
        </li>
      ))}
    </ul>
  );
}

function Row({ db, row }: { db: Db; row: CraftRow }) {
  return (
    <div className="vrow" role="row">
      <div className="vcell" role="cell">
        <span className="vlabel">アイテム</span>
        <ItemLink db={db} id={row.item} />
      </div>
      <div className="vcell" role="cell">
        <span className="vlabel">材料・入手元</span>
        {row.recipe ? (
          <Materials db={db} recipe={row.recipe} />
        ) : row.via ? (
          <>
            <ItemLink db={db} id={row.via} />
            <span className="mini">から</span>
          </>
        ) : (
          <span className="empty">—</span>
        )}
      </div>
      <div className="vcell" role="cell">
        <span className="vlabel">使われる先</span>
        <UsedBy db={db} item={row.item} />
      </div>
    </div>
  );
}

/** 行の高さの見積り。材料や使い道が多いほど折り返して高くなる(実際の高さは描画後に測る) */
function estimateOf(db: Db, line: Line): number {
  if (line.kind === 'title') return 64;
  const mats = line.row.recipe?.in.length ?? 1;
  const uses = db.usedCount.get(line.row.item) ?? 0;
  return 40 + Math.max(0, Math.ceil(mats / 3) - 1) * 24 + Math.max(0, Math.ceil(uses / 3) - 1) * 24;
}

export function CraftPage({ db, id }: { db: Db; id: string }) {
  const name = db.craft.get(id)?.name;
  const [query, setQuery] = useState('');
  const [onlyUsed, setOnlyUsed] = useState(false);
  const list = useRef<VirtualListHandle>(null);

  const sections = useMemo(() => sectionsOfCraft(db, id), [db, id]);
  const visible = useMemo(() => {
    const q = fold(query);
    return sections
      .map((s) => ({
        title: s.title,
        rows: s.rows.filter((r) => (!onlyUsed || db.usedIn.has(r.item)) && (!q || (db.searchKey.get(r.item) ?? '').includes(q))),
      }))
      .filter((s) => s.rows.length > 0);
  }, [db, sections, query, onlyUsed]);

  // 見出し行とアイテム行を並べ、目次から飛ぶための見出し行の位置を控える
  const { lines, starts } = useMemo(() => {
    const lines: Line[] = [];
    const starts: number[] = [];
    for (const s of visible) {
      starts.push(lines.length);
      lines.push({ kind: 'title', title: s.title || 'その他', count: s.rows.length });
      for (const row of s.rows) lines.push({ kind: 'row', row });
    }
    return { lines, starts };
  }, [visible]);

  if (!name) return <NotFound message="生産系が見つかりません。" />;

  const total = lines.length - visible.length;

  return (
    <section>
      <p className="back">
        <a href="#/">← 検索に戻る</a>
      </p>
      <h1>{name}</h1>
      <p className="lead">
        {name}で作る・得られるアイテムを、wikiの見出し順に並べています。右の列が「そのアイテムが材料になる成果物」です。
      </p>

      <div className="toolbar">
        <input
          type="search"
          value={query}
          placeholder="この一覧を絞り込む"
          aria-label="この一覧を絞り込む"
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} />
          使い道があるものだけ
        </label>
      </div>
      <p className="count">{total}件</p>

      {visible.length > 1 && (
        <nav className="toc" aria-label="区分">
          {visible.map((s, i) => (
            <button key={i} type="button" onClick={() => list.current?.scrollToIndex(starts[i])}>
              {s.title || 'その他'}
              <span className="mini">{s.rows.length}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="vrow head" aria-hidden="true">
        <div>アイテム</div>
        <div>材料・入手元</div>
        <div>使われる先</div>
      </div>
      <VirtualList
        handle={list}
        label={`${name}の一覧`}
        items={lines}
        estimate={(line) => estimateOf(db, line)}
        keyOf={(line, i) => (line.kind === 'title' ? `t|${line.title}` : `r|${line.row.item}|${line.row.via}|${i}`)}
        render={(line) =>
          line.kind === 'title' ? (
            <h2 className="vrow title">
              {line.title}
              <small>{line.count}件</small>
            </h2>
          ) : (
            <Row db={db} row={line.row} />
          )
        }
      />
    </section>
  );
}
