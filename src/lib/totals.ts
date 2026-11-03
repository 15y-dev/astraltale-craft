// 「上流素材の合計」: 成果物を N 個作るのに必要な、元の素材と途中の加工品の個数を求める。
// 同じ成果物のレシピが複数あるときは、wiki の表で最初に出てくるものを使う(alternatives に他の数を残す)。
import type { Db } from './db.ts';
import type { Recipe } from './types.ts';

export interface Total {
  id: string;
  qty: number;
  /** 他にもレシピがある場合、その数(使わなかったもの) */
  alternatives: number;
  /** 栽培の「用途」から作った関係で、個数が不明なまま 1 として数えた */
  approximate: boolean;
}

export interface Totals {
  /** これ以上さかのぼれない素材(入手元・レシピが表にないものも含む) */
  raw: Total[];
  /** 途中で作るもの(レシピがあるもの)。作る順(最終品に近い方が先) */
  crafted: Total[];
  /** 循環していて展開をやめたアイテム */
  cycles: string[];
}

const MAX_QTY = Number.MAX_SAFE_INTEGER;

/** 使うレシピを選ぶ。個数の分かるレシピを優先する */
export function pickRecipe(recipes: Recipe[] | undefined): { recipe: Recipe; alternatives: number } | null {
  if (!recipes || recipes.length === 0) return null;
  const recipe = recipes.find((r) => r.kind === 'recipe') ?? recipes[0];
  return { recipe, alternatives: recipes.length - 1 };
}

export function totalMaterials(db: Db, id: string, count: number): Totals {
  const raw = new Map<string, Total>();
  const crafted = new Map<string, Total>();
  const cycles = new Set<string>();
  const order: string[] = [];

  const add = (m: Map<string, Total>, item: string, qty: number, extra: Omit<Total, 'id' | 'qty'>) => {
    const prev = m.get(item);
    if (prev) {
      prev.qty = Math.min(MAX_QTY, prev.qty + qty);
      prev.approximate ||= extra.approximate;
    } else m.set(item, { id: item, qty: Math.min(MAX_QTY, qty), ...extra });
  };

  const walk = (item: string, qty: number, stack: string[], approximate: boolean) => {
    const pick = pickRecipe(db.madeBy.get(item));
    if (!pick) {
      add(raw, item, qty, { alternatives: 0, approximate });
      return;
    }
    if (stack.includes(item)) {
      cycles.add(item);
      add(raw, item, qty, { alternatives: 0, approximate });
      return;
    }
    if (item !== id) {
      if (!crafted.has(item)) order.push(item);
      add(crafted, item, qty, { alternatives: pick.alternatives, approximate });
    }
    const approx = approximate || pick.recipe.kind === 'use';
    for (const i of pick.recipe.in) walk(i.item, qty * i.qty, [...stack, item], approx);
  };

  walk(id, count, [], false);
  return {
    raw: [...raw.values()].sort((a, b) => b.qty - a.qty),
    crafted: order.map((k) => crafted.get(k)!),
    cycles: [...cycles],
  };
}
