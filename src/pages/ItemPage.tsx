import { CraftTag, CraftTags, ItemLink, Materials, NotFound } from '../components/Links.tsx';
import { Flow } from '../components/Flow.tsx';
import { TotalsPanel } from '../components/TotalsPanel.tsx';
import { craftName, usesOf, type Db } from '../lib/db.ts';
import type { Source } from '../lib/types.ts';

function SourceRow({ db, s }: { db: Db; s: Source }) {
  return (
    <tr>
      <td>
        <CraftTag db={db} id={s.craft} />
      </td>
      <td>{s.via ? <ItemLink db={db} id={s.via} /> : '—'}</td>
      <td>{s.place}</td>
      <td className="num">{s.qty > 1 ? `×${s.qty}` : ''}</td>
      <td>{s.note ?? ''}</td>
    </tr>
  );
}

export function ItemPage({ db, id }: { db: Db; id: string }) {
  const item = db.item.get(id);
  if (!item) return <NotFound message="アイテムが見つかりません。" />;

  const uses = usesOf(db, id);
  const sources = db.sourcesOf.get(id) ?? [];
  const recipes = db.madeBy.get(id) ?? [];

  return (
    <article>
      <p className="back">
        <a href="#/">← 検索に戻る</a>
      </p>
      <h1>{item.name}</h1>
      <p className="tags">
        <CraftTags db={db} ids={db.craftsOf.get(id) ?? []} />
      </p>

      <section className="block">
        <h2>
          つながり図 <small>材料 → このアイテム → 成果物</small>
        </h2>
        <Flow db={db} id={id} />
      </section>

      <details className="block" open={uses.length > 0 && uses.length <= 8}>
        <summary>
          使い道の一覧 <small>({uses.length}件)</small>
        </summary>
        {uses.length === 0 ? (
          <p className="empty">このアイテムを材料にするレシピは見つかりませんでした。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>成果物</th>
                <th>生産系</th>
                <th>区分</th>
                <th className="num">必要数</th>
              </tr>
            </thead>
            <tbody>
              {uses.map((u) => (
                <tr key={`${u.out}|${u.craft}`}>
                  <td>
                    <ItemLink db={db} id={u.out} />
                  </td>
                  <td>
                    <CraftTag db={db} id={u.craft} />
                  </td>
                  <td className="sub">{u.group}</td>
                  <td className="num">{u.kind === 'use' ? '(個数不明)' : `×${u.qty}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>

      <details className="block" open={sources.length > 0 && sources.length <= 6}>
        <summary>
          入手元 <small>({sources.length}件)</small>
        </summary>
        {sources.length === 0 ? (
          <p className="empty">釣り・採集・栽培の表には載っていません(モンスタードロップや購入などの可能性があります)。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>生産系</th>
                <th>入手元</th>
                <th>場所・ランク</th>
                <th className="num">個数</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <SourceRow key={i} db={db} s={s} />
              ))}
            </tbody>
          </table>
        )}
      </details>

      <details className="block" open>
        <summary>作り方</summary>
        {recipes.length === 0 ? (
          <p className="empty">このアイテムのレシピは見つかりませんでした。</p>
        ) : (
          recipes.map((r, i) => (
            <div className="recipe" key={i}>
              <p className="recipe-head">
                <CraftTag db={db} id={r.craft} />
                {r.group && <span className="mini">{r.group}</span>}
                {r.cost && <span className="cost">費用 {r.cost}</span>}
              </p>
              <Materials db={db} recipe={r} />
              {r.note && <p className="note">{r.note}</p>}
              {r.in.some((m) => m.src) && (
                <p className="note">
                  材料の入手先: {[...new Set(r.in.map((m) => m.src).filter(Boolean))].join(' / ')}
                </p>
              )}
            </div>
          ))
        )}
      </details>

      {recipes.length > 0 && (
        <details className="block">
          <summary>
            素材の合計 <small>({recipes.map((r) => craftName(db, r.craft)).join('・')}で作るものを、元の素材まで展開)</small>
          </summary>
          <TotalsPanel db={db} id={id} />
        </details>
      )}
    </article>
  );
}
