export interface Craft {
  id: string;
  name: string;
  /** 図や一覧に出す判子風の一文字 */
  char: string;
}

export interface Item {
  id: string;
  name: string;
}

export interface Input {
  item: string;
  qty: number;
  /** 材料の入手先(wikiの表の記載) */
  src?: string;
}

/** 材料 → 成果物。kind='use' は栽培ページの「用途」列から作った関係(個数は不明) */
export interface Recipe {
  craft: string;
  out: string;
  in: Input[];
  kind: 'recipe' | 'use';
  /** wikiの見出しから求めた区分(例: 「装備 / 武器」) */
  group: string;
  cost?: string;
  note?: string;
}

/** 釣り・採集・栽培で得られるアイテム。via は魚・植物・鉱脈などの入手元アイテム */
export interface Source {
  item: string;
  craft: string;
  via: string | null;
  /** wikiの見出しから求めた場所・ランク(例: 「中央大陸 / ランク1～8」) */
  place: string;
  qty: number;
  note?: string;
}

export interface RawData {
  crafts: Craft[];
  items: Item[];
  recipes: Recipe[];
  sources: Source[];
}
