import { useMemo, useState } from 'react';
import { CraftTags, ItemLink } from '../components/Links.tsx';
import { VirtualList } from '../components/VirtualList.tsx';
import { fold, unusedItems, type Db } from '../lib/db.ts';

/** どのレシピの材料にもならないアイテム。最終品のほか、名前の表記ゆれで材料とつながっていないものも混ざる */
export function UnusedPage({ db }: { db: Db }) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => unusedItems(db), [db]);
  const rows = useMemo(() => {
    const q = fold(query);
    return q ? all.filter((i) => (db.searchKey.get(i.id) ?? '').includes(q)) : all;
  }, [db, all, query]);

  return (
    <section>
      <p className="back">
        <a href="#/">← 検索に戻る</a>
      </p>
      <h1>どこにも使われないアイテム</h1>
      <p className="lead">
        wikiのレシピ表で、他のアイテムの材料として書かれていないものです。装備や料理などの最終品が大半ですが、
        名前の表記ゆれで材料とつながっていないものも混ざります。
      </p>
      <div className="toolbar">
        <input
          type="search"
          value={query}
          placeholder="絞り込む"
          aria-label="絞り込む"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="count">{rows.length}件</p>
      <div className="vrow two head" aria-hidden="true">
        <div>アイテム</div>
        <div>生産系</div>
      </div>
      <VirtualList
        label="どこにも使われないアイテム"
        items={rows}
        estimate={() => 40}
        keyOf={(i) => i.id}
        render={(i) => (
          <div className="vrow two" role="row">
            <div className="vcell" role="cell">
              <ItemLink db={db} id={i.id} />
            </div>
            <div className="vcell" role="cell">
              <CraftTags db={db} ids={db.craftsOf.get(i.id) ?? []} />
            </div>
          </div>
        )}
      />
    </section>
  );
}
