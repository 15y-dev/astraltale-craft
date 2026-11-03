import { useMemo, useState } from 'react';
import { originOf, type Db } from '../lib/db.ts';
import { totalMaterials, type Total } from '../lib/totals.ts';
import { ItemLink } from './Links.tsx';

const fmt = (n: number) => n.toLocaleString('ja-JP');

function TotalTable({ db, rows, caption }: { db: Db; rows: Total[]; caption: string }) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>アイテム</th>
          <th className="num">必要数</th>
          <th>入手元</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <ItemLink db={db} id={r.id} />
              {r.alternatives > 0 && <span className="mini">(ほかのレシピ {r.alternatives}件)</span>}
            </td>
            <td className="num">
              {r.approximate && '約 '}
              {fmt(r.qty)}
            </td>
            <td className="sub">{originOf(db, r.id) || '表になし'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 個数を入れると、元の素材と途中の加工品の必要数を出す */
export function TotalsPanel({ db, id }: { db: Db; id: string }) {
  const [count, setCount] = useState(1);
  const totals = useMemo(() => totalMaterials(db, id, count), [db, id, count]);
  const empty = totals.raw.length === 0 || (totals.raw.length === 1 && totals.raw[0].id === id);

  if (!db.madeBy.has(id)) return <p className="empty">このアイテムは作り方が表にないので、素材の合計は出せません。</p>;
  if (empty) return null;

  return (
    <div>
      <label className="count-input">
        作る個数
        <input
          type="number"
          min={1}
          max={9999}
          value={count}
          onChange={(e) => setCount(Math.min(9999, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
        />
      </label>
      <p className="note">
        レシピが複数ある場合は、wikiの表で最初に出てくるものだけで数えています。「約」は、個数の書かれていない関係を1個として数えた値です。
      </p>
      <TotalTable db={db} rows={totals.raw} caption="元の素材(これ以上さかのぼれないもの)" />
      {totals.crafted.length > 0 && <TotalTable db={db} rows={totals.crafted} caption="途中で作るもの" />}
      {totals.cycles.length > 0 && <p className="note">循環しているレシピがあったため、途中で展開をやめました。</p>}
    </div>
  );
}
