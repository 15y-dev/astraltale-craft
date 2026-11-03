import { expect, test } from 'vitest';
import { clean, parseQty, parseTables, segments, withInherit } from '../scripts/lib/wiki.mjs';

const assert = {
  equal: (a: unknown, b: unknown) => expect(a).toBe(b),
  deepEqual: (a: unknown, b: unknown) => expect(a).toEqual(b),
};

test('clean: 画像・リンク・色指定を取り除く', () => {
  assert.equal(clean('&attachref(./a.jpg,nolink);&color(Orange){レッドローズ};'), 'レッドローズ');
  assert.equal(clean('[[魚群 ランク1～8>生産/釣り#e85d67b6]]'), '魚群 ランク1～8');
  assert.equal(clean("''太字''"), '太字');
});

test('segments: &br; で分け、空と ~ を捨てる', () => {
  assert.deepEqual(segments('A&br;B&br;&br;~'), ['A', 'B']);
});

test('parseQty: 「名前×個数」を分ける。個数がなければ 1', () => {
  assert.deepEqual(parseQty('パタパタの切り身×3'), { name: 'パタパタの切り身', qty: 3 });
  assert.deepEqual(parseQty('魚肉ハンバーグ×1,000'), { name: '魚肉ハンバーグ', qty: 1000 });
  assert.deepEqual(parseQty('コットン'), { name: 'コットン', qty: 1 });
});

test('withInherit: ~ は上のセルと同じ値になる', () => {
  const rows = [
    ['A', 'x'],
    ['~', 'y'],
  ];
  const out = withInherit(rows);
  assert.deepEqual(out[1].cur, ['A', 'y']);
  assert.deepEqual(out[1].raw, ['~', 'y']);
});

const SAMPLE = [
  '<code>* 裁縫 [#a]',
  '** 装備 [#b]',
  '*** 武器 [#c]',
  '|LEFT:100|RIGHT:40|c',
  '|~ |CENTER:~名称|CENTER:~費用|>|CENTER:~必要素材|~個数|h',
  '|&attachref(x.jpg);|剣|500s|&attachref(y.jpg);|鉄|2|',
  '*** 防具 [#d]',
  '|CENTER:~名称|h',
  '|盾|',
  '** 大陸の見出し [#e]',
  '</code>',
].join('\n');

test('parseTables: 見出しの階層(3段目まで)を path に持つ', () => {
  const tables = parseTables(SAMPLE);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0].path, ['裁縫', '装備', '武器']);
  assert.deepEqual(tables[1].path, ['裁縫', '装備', '防具']);
});

test('parseTables: ">" の結合セルは列番号をそろえて複製する', () => {
  const [t] = parseTables(SAMPLE);
  assert.deepEqual(t.header, ['', '名称', '費用', '必要素材', '必要素材', '個数']);
  assert.equal(t.rows[0][4], '鉄');
  assert.equal(t.rows[0][5], '2');
});

test('parseTables: 大陸の見出しは、ランクの見出しの手前に入る', () => {
  const text = ['* 魚群', '**中央大陸 [#a]', '** ランク1～8 [#b]', '|CENTER:~名称|h', '|魚|'].join('\n');
  assert.deepEqual(parseTables(text)[0].path, ['魚群', '中央大陸', 'ランク1～8']);
});
