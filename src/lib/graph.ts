// アイテム詳細の「つながり図」用に、材料側2段・成果物側2段のグラフを作る。件数の上限は設けない。
import { mainCraftOf, originOf, type Db } from './db.ts';

export interface FlowNode {
  id: string;
  /** 0=このアイテム、負=材料側、正=成果物側 */
  depth: number;
  sub: string;
  /** 主な生産系(作る/得る場所)。分からなければ空 */
  craft: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const UP = 2;
const DOWN = 2;

interface Link {
  id: string;
  label: string;
}

const qtyLabel = (qty: number, show: boolean) => (show && qty > 1 ? `×${qty}` : '');

/** id の材料(作り方がなければ、釣り・採集で得られる元の魚や植物) */
function parentsOf(db: Db, id: string): Link[] {
  const found = new Map<string, Link>();
  for (const r of db.madeBy.get(id) ?? []) {
    for (const i of r.in) if (!found.has(i.item)) found.set(i.item, { id: i.item, label: r.kind === 'recipe' ? `×${i.qty}` : '' });
  }
  if (found.size === 0) {
    for (const s of db.sourcesOf.get(id) ?? []) {
      if (s.via && !found.has(s.via)) found.set(s.via, { id: s.via, label: qtyLabel(s.qty, true) });
    }
  }
  return [...found.values()];
}

/** id を材料にする成果物(魚・植物・鉱脈なら、そこから得られるアイテムも含む) */
function childrenOf(db: Db, id: string): Link[] {
  const found = new Map<string, Link>();
  for (const s of db.sourcesVia.get(id) ?? []) {
    if (!found.has(s.item)) found.set(s.item, { id: s.item, label: qtyLabel(s.qty, true) });
  }
  for (const u of db.usedIn.get(id) ?? []) {
    const out = u.recipe.out;
    if (!found.has(out)) found.set(out, { id: out, label: u.recipe.kind === 'recipe' ? `×${u.qty}` : '' });
  }
  return [...found.values()];
}

export function buildFlow(db: Db, id: string): Flow {
  const depthOf = new Map<string, number>([[id, 0]]);
  const edges: FlowEdge[] = [];
  const edgeKeys = new Set<string>();

  const link = (from: string, to: string, label: string) => {
    const key = `${from}>${to}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ from, to, label });
  };

  /** dir=+1: 成果物側へ、dir=-1: 材料側へ広げる */
  const expand = (dir: 1 | -1, levels: number) => {
    let frontier = [id];
    for (let step = 1; step <= levels; step++) {
      const depth = dir * step;
      const cand = new Map<string, { base: string; label: string }[]>();
      for (const base of frontier) {
        for (const l of dir === 1 ? childrenOf(db, base) : parentsOf(db, base)) {
          const have = depthOf.get(l.id);
          if (have !== undefined && have !== depth) continue;
          const arr = cand.get(l.id) ?? [];
          arr.push({ base, label: l.label });
          cand.set(l.id, arr);
        }
      }
      const keys = [...cand.keys()];
      for (const k of keys) {
        depthOf.set(k, depth);
        for (const c of cand.get(k)!) {
          if (dir === 1) link(c.base, k, c.label);
          else link(k, c.base, c.label);
        }
      }
      frontier = keys;
      if (frontier.length === 0) break;
    }
  };

  expand(1, DOWN);
  expand(-1, UP);

  const nodes: FlowNode[] = [...depthOf].map(([nodeId, depth]) => ({
    id: nodeId,
    depth,
    sub: originOf(db, nodeId),
    craft: mainCraftOf(db, nodeId),
  }));
  return { nodes, edges };
}
