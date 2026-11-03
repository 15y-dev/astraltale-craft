// 生産系の定義(取得・解析・画面で共通)。char は図や一覧に出す判子風の一文字
export const CRAFTS = [
  { id: 'fishing', name: '釣り', char: '釣' },
  { id: 'gathering', name: '採集', char: '採' },
  { id: 'farming', name: '栽培', char: '栽' },
  { id: 'alchemy', name: '錬金', char: '錬' },
  { id: 'cooking', name: '料理', char: '料' },
  { id: 'sewing', name: '裁縫', char: '縫' },
  { id: 'synthesis', name: '合成', char: '合' },
];

// wiki のページ名
export const wikiPage = (craft) => `生産/${craft.name}`;
