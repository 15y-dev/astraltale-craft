// アイテム名の正規化と登録。表記ゆれ(全角半角・空白・「未鑑定の」・別名)を同じアイテムとして扱う

export const norm = (s) => s.normalize('NFKC').replace(/[\s\u3000]+/g, '');

// 「未鑑定の〜」は鑑定前の同じアイテムなので、接頭辞を外して同一視する
export const stripUnidentified = (s) => s.replace(/未鑑定の/g, '').trim();

/**
 * @param {Record<string, string>} aliases キー=wikiでの別表記、値=統一したい名前。'_' で始まるキーは説明用
 */
export function createRegistry(aliases = {}) {
  const aliasMap = new Map();
  const preferred = new Map();
  for (const [from, to] of Object.entries(aliases)) {
    if (from.startsWith('_')) continue;
    aliasMap.set(norm(from), norm(to));
    preferred.set(norm(to), to);
  }

  /** @type {Map<string, { name: string }>} */
  const items = new Map();

  const keyOf = (displayName) => {
    const key = norm(stripUnidentified(displayName));
    return aliasMap.get(key) ?? key;
  };

  /** 名前からアイテムを登録し、そのキー(=アイテムID)を返す */
  const ref = (displayName) => {
    const key = keyOf(displayName);
    if (!items.has(key)) items.set(key, { name: preferred.get(key) ?? stripUnidentified(displayName) });
    return key;
  };

  return { ref, keyOf, items };
}
