import { craftName, itemName, type Db } from '../lib/db.ts';
import { craftHref, itemHref } from '../lib/route.ts';
import type { OriginPlace } from '../lib/types.ts';

export const iconSrc = (file: string) => `${import.meta.env.BASE_URL}icons/${file}`;

/** アイテムのアイコン。画像がない、または読み込めないときは何も出さない(装飾なので alt は空) */
export function ItemIcon({ db, id, size = 24 }: { db: Db; id: string; size?: number }) {
  const file = db.icons.get(id);
  if (!file) return null;
  return (
    <img
      className="item-icon"
      src={iconSrc(file)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

export function ItemLink({ db, id }: { db: Db; id: string }) {
  return (
    <a href={itemHref(id)}>
      <ItemIcon db={db} id={id} />
      {itemName(db, id)}
    </a>
  );
}

/** 判子風の一文字(生産系)。色は使わない */
export function Stamp({ db, craft }: { db: Db; craft: string }) {
  const char = db.craft.get(craft)?.char;
  if (!char) return null;
  return (
    <span className="stamp" aria-hidden="true">
      {char}
    </span>
  );
}

export function CraftTag({ db, id }: { db: Db; id: string }) {
  return (
    <a className="tag" href={craftHref(id)}>
      <Stamp db={db} craft={id} />
      {craftName(db, id)}
    </a>
  );
}

export function CraftTags({ db, ids }: { db: Db; ids: Iterable<string> }) {
  const set = new Set(ids);
  return (
    <>
      {db.crafts
        .filter((c) => set.has(c.id))
        .map((c) => (
          <CraftTag key={c.id} db={db} id={c.id} />
        ))}
    </>
  );
}

/** 「材料×個数」の並び。栽培の「用途」(個数不明)は個数を出さない */
export function Materials({ db, recipe }: { db: Db; recipe: { kind: string; in: { item: string; qty: number; src?: string }[] } }) {
  return (
    <ul className="inline">
      {recipe.in.map((m, i) => (
        <li key={i}>
          <ItemLink db={db} id={m.item} />
          {recipe.kind === 'recipe' && <span className="qty">×{m.qty}</span>}
        </li>
      ))}
    </ul>
  );
}

function PlaceTable({ caption, places }: { caption: string; places: OriginPlace[] }) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>NPC・場所の名前</th>
          <th>エリア</th>
          <th>座標</th>
        </tr>
      </thead>
      <tbody>
        {places.map((p, i) => (
          <tr key={i}>
            <td>{p.npc}</td>
            <td>{p.zone}</td>
            <td className="sub">{p.pos ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** wiki の表にない入手元(アストラルテイルDBで補ったもの)。補完がなければ何も出さない */
export function OriginTables({ db, id }: { db: Db; id: string }) {
  const o = db.origins.get(id);
  if (!o) return null;
  return (
    <div className="origin">
      {o.buy.length > 0 && <PlaceTable caption="売っている場所" places={o.buy} />}
      {o.drop.length > 0 && <PlaceTable caption="入手できる場所(ドロップ・採取など)" places={o.drop} />}
      <p className="note">
        出典:{' '}
        <a href={`https://www.astraltaledb.com/jp/item/${o.site}`} target="_blank" rel="noreferrer">
          アストラルテイルDB
        </a>
        (wikiの表にない入手元を補っています)
      </p>
    </div>
  );
}

export function NotFound({ message }: { message: string }) {
  return (
    <section>
      <p className="notice">{message}</p>
      <p>
        <a href="#/">検索に戻る</a>
      </p>
    </section>
  );
}
