import { craftName, itemName, type Db } from '../lib/db.ts';
import { craftHref, itemHref } from '../lib/route.ts';

export function ItemLink({ db, id }: { db: Db; id: string }) {
  return <a href={itemHref(id)}>{itemName(db, id)}</a>;
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
