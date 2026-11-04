// アストラルテイルDBで補った入手元: ページの解析と、詳細ページへの表示を確認する。
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { parseItemPage } from '../scripts/lib/astraldb.mjs';
import { Page } from '../src/App.tsx';
import { buildDb, originOf } from '../src/lib/db.ts';
import type { Origin, RawData } from '../src/lib/types.ts';

const place = (npc: string, zone: string, pos: string) => `
<tr>
  <td><a href="/jp/npc/1-x">${npc}</a></td>
  <td><a href="/jp/zone/1-x">${zone}</a> <a href="#"><sup>(${pos})</sup></a></td>
</tr>`;

const html = `
<span class="flex-fill tooltip-id">ID: 11575</span>
<h1 class="tooltip-name quality-1">蒸留水</h1>
<div class="card-header nested-card-header">売り手</div>
<table><tbody>${place('&lt;商人&gt;<br>アルサッド', 'セイルーン王城', 'X: 475, Y: 232')}</tbody></table>
<div class="card-header nested-card-header">入手元のアイテム</div>
<table><tbody>${place('ランク1～8<br>鉱脈', '中央大陸', 'X: 669, Y: 374')}</tbody></table>
<table><caption>作成者</caption><tbody><tr><td><div class="item-icons">
  <div class="item-icon"><a title="糸巻き" href="/jp/item/11567-x"><div class="icon"><div class="item-count">×1</div></div></a></div>
  <div class="item-icon"><a title="レーヨンフラワー" href="/jp/item/11123-x"><div class="icon"><div class="item-count">×2</div></div></a></div>
</div></td><td>160 <div class="currency-icon"><span class="icon c" data-tippy-content="シルバー"></span></div></td></tr></tbody></table>
<div class="card-header nested-card-header">図鑑</div>`;

test('parseItemPage: ID・名前・売り手・入手元・レシピを読む', () => {
  const p = parseItemPage(html)!;
  expect(p.id).toBe(11575);
  expect(p.name).toBe('蒸留水');
  expect(p.buy).toEqual([{ npc: '<商人> アルサッド', zone: 'セイルーン王城', pos: 'X: 475, Y: 232' }]);
  expect(p.drop).toEqual([{ npc: 'ランク1～8 鉱脈', zone: '中央大陸', pos: 'X: 669, Y: 374' }]);
  expect(p.made).toEqual([
    {
      in: [
        { id: 11567, name: '糸巻き', qty: 1 },
        { id: 11123, name: 'レーヨンフラワー', qty: 2 },
      ],
      cost: '160シルバー',
    },
  ]);
});

test('parseItemPage: 装備品のページ(IDの後ろに強化欄、名前に <span>)も読める', () => {
  const equip = `
<div class="d-flex mb-2"><span class="flex-fill tooltip-id">ID: 10008</span>強化：<input type="text" value="0"></div>
<h1 class="tooltip-name quality-3">荒ぶる獣の力<span id="itemStrength"></span></h1>`;
  expect(parseItemPage(equip)).toMatchObject({ id: 10008, name: '荒ぶる獣の力', buy: [], drop: [], made: [] });
});

test('parseItemPage: アイテムページでなければ null', () => {
  expect(parseItemPage('<html><body>not found</body></html>')).toBeNull();
});

const raw: RawData = {
  crafts: [{ id: 'alchemy', name: '錬金', char: '錬' }],
  items: ['蒸留水', '試験溶液', '無縁'].map((name) => ({ id: name, name })),
  recipes: [{ craft: 'alchemy', out: '試験溶液', in: [{ item: '蒸留水', qty: 1 }], kind: 'recipe', group: '素材' }],
  sources: [],
};
const origin: Origin = {
  site: 11575,
  buy: [{ npc: '<商人> アルサッド', zone: 'セイルーン王城', pos: 'X: 475, Y: 232' }],
  drop: [],
};

test('詳細ページ: 補った入手元の表と出典リンクが出る。補完がないアイテムには出ない', () => {
  const db = buildDb(raw, {}, { 蒸留水: origin });
  const withOrigin = renderToStaticMarkup(<Page db={db} route={{ page: 'item', id: '蒸留水' }} />);
  expect(withOrigin).toContain('売っている場所');
  expect(withOrigin).toContain('アルサッド');
  expect(withOrigin).toContain('astraltaledb.com/jp/item/11575');
  expect(withOrigin).not.toContain('入手できる場所');
  expect(withOrigin).not.toContain('モンスタードロップや購入などの可能性');

  const without = renderToStaticMarkup(<Page db={db} route={{ page: 'item', id: '無縁' }} />);
  expect(without).not.toContain('売っている場所');
  expect(without).toContain('モンスタードロップや購入などの可能性');
});

test('originOf: 表になくても、補った入手元があれば「NPC販売」などと出る', () => {
  const db = buildDb(raw, {}, { 蒸留水: origin, 無縁: { site: 1, buy: [], drop: [{ npc: 'x', zone: 'y' }] } });
  expect(originOf(db, '蒸留水')).toBe('NPC販売');
  expect(originOf(db, '無縁')).toBe('ドロップ・採取');
  expect(originOf(buildDb(raw), '蒸留水')).toBe('');
});
