import { useEffect, useState } from 'react';
import { CraftPage } from './pages/CraftPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ItemPage } from './pages/ItemPage.tsx';
import { UnusedPage } from './pages/UnusedPage.tsx';
import { buildDb, type Db } from './lib/db.ts';
import { homeHref, useRoute, type Route } from './lib/route.ts';
import type { RawData } from './lib/types.ts';

/** アイコンの対応表。なくても(未ダウンロードでも)アイコンなしで動く */
async function loadIcons(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/icons.json`);
    if (!res.ok) return {};
    const json: unknown = await res.json();
    return json && typeof json === 'object' ? (json as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function loadDb(): Promise<Db> {
  const [res, icons] = await Promise.all([fetch(`${import.meta.env.BASE_URL}data/data.json`), loadIcons()]);
  if (!res.ok) throw new Error(`データを読み込めませんでした (HTTP ${res.status})`);
  return buildDb((await res.json()) as RawData, icons);
}

const keyOf = (route: Route) => (route.page === 'item' || route.page === 'craft' ? `${route.page}/${route.id}` : route.page);

export function Page({ db, route }: { db: Db; route: Route }) {
  switch (route.page) {
    case 'item':
      return <ItemPage db={db} id={route.id} />;
    case 'craft':
      return <CraftPage db={db} id={route.id} />;
    case 'unused':
      return <UnusedPage db={db} />;
    default:
      return <HomePage db={db} />;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <a className="site-title" href={homeHref()}>
          星界神話 生産アイテム早見表
        </a>
        <span className="site-sub">アイテムが何の材料になるかを調べる(非公式)</span>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        非公式のファンツールです。データは星界神話 Wiki(wikiwiki.jp)の生産ページから作成しており、wikiの更新は反映されません。
      </footer>
    </>
  );
}

export function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState('');
  const route = useRoute();
  const key = keyOf(route);

  useEffect(() => {
    loadDb().then(setDb, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);

  return (
    <Layout>
      {error && <p className="notice">{error}</p>}
      {!db && !error && <p className="notice">読み込み中…</p>}
      {db && <Page key={key} db={db} route={route} />}
    </Layout>
  );
}
