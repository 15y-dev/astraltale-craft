import { expect, test } from 'vitest';
import { buildData } from '../scripts/lib/pipeline.mjs';

const nameOf = (data: any) => new Map<string, string>(data.items.map((i: any) => [i.id, i.name]));

/** 結果を「成果物 <- 材料×個数」の文字列にして比べやすくする */
function lines(data: any): string[] {
  const n = nameOf(data);
  return data.recipes
    .map((r: any) => `${r.craft}:${n.get(r.out)} <- ${r.in.map((i: any) => `${n.get(i.item)}×${i.qty}`).join(', ')}`)
    .sort();
}

const page = (...rows: string[]) => `<code>${rows.join('\n')}</code>`;

test('料理: 「材料×個数」が1セルに並ぶ形式。未鑑定の接頭辞と自己参照を取り除く', () => {
  const { data } = buildData({
    pages: {
      cooking: page(
        '* 料理一覧/効果/合成詳細 [#a]',
        '** ランク1～8 [#b]',
        '|CENTER:|LEFT:140|c',
        '|~ |CENTER:~名称|CENTER:~費用|CENTER:~材料|>|CENTER:~入手先|CENTER:~効果|h',
        '|&attachref(a.jpg);|未鑑定の魚肉ハンバーグ|~|魚肉ハンバーグ×1&br;パタパタの切り身×3|アビスパタパタ|~|攻撃力増加|',
      ),
    },
  });
  expect(lines(data)).toEqual(['cooking:魚肉ハンバーグ <- パタパタの切り身×3']);
  expect(data.recipes[0].group).toBe('ランク1～8');
});

test('裁縫: 成果物が複数並ぶ行は、同じ材料を共有する', () => {
  const { data } = buildData({
    pages: {
      sewing: page(
        '* 裁縫 [#a]',
        '** 衣装アバター [#b]',
        '|CENTER:~名称|CENTER:~費用|>|CENTER:~必要素材|~個数|CENTER:~素材入手先|h',
        '|帽子A&br;帽子B|10s|&attachref(x);|コットン|2|アルサッド|',
        '|~|~|&attachref(x);|金具|1|購入|',
      ),
    },
  });
  expect(lines(data)).toEqual(['sewing:帽子A <- コットン×2, 金具×1', 'sewing:帽子B <- コットン×2, 金具×1']);
});

test('合成: 成果物と材料が同数並ぶ行は、順に1対1で対応させる', () => {
  const { data } = buildData({
    pages: {
      synthesis: page(
        '* 家具 [#a]',
        '|~ |CENTER:~名称|CENTER:~費用|>|CENTER:~必要素材|~個数|CENTER:~素材入手先|h',
        '|&attachref(x);|竿A&br;竿B|1g|&attachref(x);|レシピ：竿A&br;レシピ：竿B|1||',
        '|~|~|~|&attachref(x);|海の雫|10|魚群|',
      ),
    },
  });
  expect(lines(data)).toEqual(['synthesis:竿A <- レシピ：竿A×1, 海の雫×10', 'synthesis:竿B <- レシピ：竿B×1, 海の雫×10']);
  expect(data.recipes.every((r: any) => r.group === '家具')).toBe(true);
});

test('裁縫のカード: 「必要材料の材料」を、材料自身のレシピとして取り出す', () => {
  const { data } = buildData({
    pages: {
      sewing: page(
        '* 裁縫 [#a]',
        '** エンチャントカード [#b]',
        '*** 初級カード [#c]',
        '|CENTER:~アイテム名|CENTER:~必要材料|~個数|CENTER:~必要材料の材料|~個数|CENTER:~入手方法|CENTER:~合成費用|h',
        '|未鑑定の初級武器カード|コットン|2|糸巻き|1|アルサッド|32s|',
        '|~|~|~|レーヨンフラワー|2|栽培|~|',
        '|~|アンバーストーン|5|アンバーストーンの原石|1|採集|~|',
      ),
    },
  });
  expect(lines(data)).toEqual([
    'sewing:アンバーストーン <- アンバーストーンの原石×1',
    'sewing:コットン <- 糸巻き×1, レーヨンフラワー×2',
    'sewing:初級武器カード <- コットン×2, アンバーストーン×5',
  ]);
  expect(data.recipes.every((r: any) => r.group === 'エンチャントカード / 初級カード')).toBe(true);
});

test('釣り: 魚群の説明欄の色付きアイテムを、魚から得られるものとして入手元にする。緑(経験値)は捨てる', () => {
  const { data } = buildData({
    pages: {
      fishing: page(
        '* 魚群 [#a]',
        '**中央大陸 [#b]',
        '** ランク1～8 [#c]',
        '|~ |CENTER:~名称|CENTER:~説明|CENTER:~備考|h',
        '|&attachref(x);|&color(Olive){アビスパタパタ};|&color(Olive){パタパタの切り身};&br;&color(Green){EXP辞典×5,10};&br;星界チケット10||',
      ),
    },
  });
  const n = nameOf(data);
  expect(data.sources).toHaveLength(1);
  const s = data.sources[0];
  expect(n.get(s.item)).toBe('パタパタの切り身');
  expect(n.get(s.via)).toBe('アビスパタパタ');
  expect(s.place).toBe('魚群 / 中央大陸 / ランク1～8');
});

test('栽培の「用途」: 他の生産系に同じ材料関係があれば重複として捨てる', () => {
  const { data } = buildData({
    pages: {
      farming: page(
        '* 作物 [#a]',
        '** 裁縫用 [#b]',
        '|~ |CENTER:~名称|CENTER:~費用|CENTER:~用途|CENTER:~備考|h',
        '|&attachref(x);|レーヨンフラワー|30s|コットン||',
        '|&attachref(x);|アマフラワー|90s|麻布||',
      ),
      sewing: page(
        '* 裁縫 [#a]',
        '|CENTER:~アイテム名|>|CENTER:~必要材料|~個数|CENTER:~費用|h',
        '|コットン|&attachref(x);|レーヨンフラワー|2|32s|',
      ),
    },
  });
  expect(lines(data)).toEqual(['farming:麻布 <- アマフラワー×1', 'sewing:コットン <- レーヨンフラワー×2']);
});

test('別名表と手入力レシピを取り込む。表記ゆれは同じアイテムになる', () => {
  const { data } = buildData({
    pages: {
      cooking: page(
        '* 料理一覧/効果/合成詳細 [#a]',
        '|CENTER:~名称|CENTER:~材料|>|CENTER:~入手先|h',
        '|カップケーキ|小麦粉×1|',
        '|ケーキ|コップケーキ×2|',
      ),
    },
    aliases: { コップケーキ: 'カップケーキ' },
    manual: { recipes: [{ craft: 'sewing', out: '特殊帽', in: [{ item: '小麦粉', qty: 9 }], cost: '600s', group: '特殊' }] },
  });
  expect(lines(data)).toEqual(['cooking:カップケーキ <- 小麦粉×1', 'cooking:ケーキ <- カップケーキ×2', 'sewing:特殊帽 <- 小麦粉×9']);
  expect(data.items.filter((i: any) => i.name === 'カップケーキ')).toHaveLength(1);
});

test('同じレシピの重複を1つにまとめる', () => {
  const { data } = buildData({
    pages: {
      alchemy: page(
        '* 錬金 [#a]',
        '|CENTER:~アイテム名|>|CENTER:~必要材料|~個数|CENTER:~費用|h',
        '|薬|&attachref(x);|草|1|10s|',
        '|薬|&attachref(x);|草|1|10s|',
      ),
    },
  });
  expect(lines(data)).toEqual(['alchemy:薬 <- 草×1']);
});
