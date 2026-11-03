// 名前から短く安定したIDを作る(cyrb53 ハッシュを36進数にしたもの)
export function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** キーの一覧から ID の対応表を作る。衝突したら例外 */
export function assignIds(keys) {
  const idOf = new Map();
  const seen = new Map();
  for (const key of keys) {
    const id = cyrb53(key).toString(36);
    if (seen.has(id)) throw new Error(`ID collision: ${key} / ${seen.get(id)}`);
    seen.set(id, key);
    idOf.set(key, id);
  }
  return idOf;
}
