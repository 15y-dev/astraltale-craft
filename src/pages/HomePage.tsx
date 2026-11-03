import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CraftTags, ItemIcon } from '../components/Links.tsx';
import { VirtualList } from '../components/VirtualList.tsx';
import { popularItems, search, type Db } from '../lib/db.ts';
import { craftHref, itemHref, unusedHref } from '../lib/route.ts';

const EXAMPLES = ['パタパタの切り身', 'コットン', 'レーヨンフラワー', '命の実', 'Lv48 星石の欠片'];

export function HomePage({ db }: { db: Db }) {
  const [query, setQuery] = useState('');
  const [craft, setCraft] = useState('');
  const deferred = useDeferredValue(query);
  const input = useRef<HTMLInputElement>(null);

  // 「/」キーで検索ボックスへ移動
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = Boolean(deferred.trim() || craft);
  const results = useMemo(() => (active ? search(db, deferred, craft) : []), [db, deferred, craft, active]);
  const popular = useMemo(() => popularItems(db, 12), [db]);
  const examples = useMemo(() => EXAMPLES.map((name) => search(db, name, '')[0]).filter(Boolean), [db]);

  return (
    <section>
      <label className="search">
        <span className="sr-only">アイテム名で検索</span>
        <input
          ref={input}
          type="search"
          value={query}
          placeholder="アイテム名で検索(例: パタパタの切り身)"
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </label>

      <div className="filters" role="group" aria-label="生産系で絞り込み">
        <button type="button" className="filter" aria-pressed={craft === ''} onClick={() => setCraft('')}>
          すべて
        </button>
        {db.crafts.map((c) => (
          <button
            key={c.id}
            type="button"
            className="filter"
            aria-pressed={craft === c.id}
            onClick={() => setCraft(craft === c.id ? '' : c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {active ? (
        <>
          <p className="count">{results.length}件</p>
          <VirtualList
            className="results"
            label="検索結果"
            items={results}
            estimate={() => 48}
            keyOf={(item) => item.id}
            render={(item) => {
              const uses = db.usedCount.get(item.id) ?? 0;
              return (
                <div className="result-row" role="row">
                  <a className="result-name" href={itemHref(item.id)}>
                    <ItemIcon db={db} id={item.id} size={28} />
                    {item.name}
                  </a>
                  <span className="result-meta">{uses > 0 ? `使い道 ${uses}件` : '使い道なし'}</span>
                  <span className="result-tags">
                    <CraftTags db={db} ids={db.craftsOf.get(item.id) ?? []} />
                  </span>
                </div>
              );
            }}
          />
        </>
      ) : (
        <div className="guide">
          <h2 className="section-title">使い方</h2>
          <ol className="steps">
            <li>アイテム名を入力して、開きます。</li>
            <li>一番上の図に、材料(左)と、それで作れるもの(右)が並びます。</li>
            <li>図の名前を押すと、そのアイテムへ移動します。</li>
          </ol>

          <h2 className="section-title">試しに開く</h2>
          <ul className="chips">
            {examples.map((item) => (
              <li key={item.id}>
                <a href={itemHref(item.id)}>
                  <ItemIcon db={db} id={item.id} />
                  {item.name}
                </a>
              </li>
            ))}
          </ul>

          <h2 className="section-title">使い道の多いアイテム</h2>
          <ul className="chips">
            {popular.map((item) => (
              <li key={item.id}>
                <a href={itemHref(item.id)}>
                  <ItemIcon db={db} id={item.id} />
                  {item.name}
                  <span className="mini">{db.usedCount.get(item.id)}</span>
                </a>
              </li>
            ))}
          </ul>

          <h2 className="section-title">生産系ごとに一覧を見る</h2>
          <ul className="index">
            {db.crafts.map((c) => (
              <li key={c.id}>
                <a href={craftHref(c.id)}>
                  <span className="big">{c.char}</span>
                  <span className="small">{c.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="more-link">
            <a href={unusedHref()}>どこにも使われないアイテムの一覧</a>
          </p>
        </div>
      )}
    </section>
  );
}
