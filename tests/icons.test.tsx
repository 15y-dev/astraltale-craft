// アイコンの表示: 対応表があるアイテムだけ <img> が出て、なくても例外なく描画できることを確認する。
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Page } from '../src/App.tsx';
import { ItemIcon } from '../src/components/Links.tsx';
import { buildDb } from '../src/lib/db.ts';
import type { RawData } from '../src/lib/types.ts';
import { sample } from './fixture.ts';

const raw: RawData = {
  crafts: [{ id: 'sewing', name: '裁縫', char: '縫' }],
  items: ['花', '糸', 'コットン'].map((name) => ({ id: name, name })),
  recipes: [{ craft: 'sewing', out: 'コットン', in: [{ item: '花', qty: 2 }, { item: '糸', qty: 1 }], kind: 'recipe', group: '素材' }],
  sources: [],
};

test('対応表にあるアイテムだけ img が出る', () => {
  const db = buildDb(raw, { 花: 'I00001.png' });
  expect(renderToStaticMarkup(<ItemIcon db={db} id="花" />)).toContain('icons/I00001.png');
  expect(renderToStaticMarkup(<ItemIcon db={db} id="糸" />)).toBe('');
});

test('詳細ページ: 見出し・材料リンク・つながり図にアイコンが出て、ないものは出ない', () => {
  const db = buildDb(raw, { コットン: 'W10101.png', 花: 'I00001.png' });
  const html = renderToStaticMarkup(<Page db={db} route={{ page: 'item', id: 'コットン' }} />);
  expect(html).toContain('<h1><img');
  expect(html).toContain('icons/W10101.png');
  expect(html).toContain('icons/I00001.png');
  expect(html).not.toContain('undefined');
});

test('対応表がなくても(未ダウンロードでも)描画できる', () => {
  const db = sample();
  expect(db.icons.size).toBe(0);
  const html = renderToStaticMarkup(<Page db={db} route={{ page: 'item', id: 'コットン' }} />);
  expect(html).toContain('<h1>コットン</h1>');
  expect(html).not.toContain('<img');
});
