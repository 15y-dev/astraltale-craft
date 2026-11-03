import { useMemo } from 'react';
import { itemName, type Db } from '../lib/db.ts';
import { buildFlow, type FlowNode } from '../lib/graph.ts';
import { itemHref } from '../lib/route.ts';
import { Stamp } from './Links.tsx';

const NODE_W = 184;
const NODE_H = 54;
const COL_GAP = 56;
const ROW_GAP = 12;
const PAD = 8;
const HEAD = 24;

const COLUMN_TITLE: Record<number, string> = {
  [-2]: '元の材料',
  [-1]: '材料',
  0: 'このアイテム',
  1: 'これで作れる',
  2: 'さらに先',
};

function NodeBody({ db, n }: { db: Db; n: FlowNode }) {
  return (
    <>
      <span className="fn-top">
        <Stamp db={db} craft={n.craft} />
        <span className="fn-name">{itemName(db, n.id)}</span>
      </span>
      <span className="fn-sub">{n.sub}</span>
    </>
  );
}

export function Flow({ db, id }: { db: Db; id: string }) {
  const flow = useMemo(() => buildFlow(db, id), [db, id]);

  if (flow.nodes.length <= 1) {
    return <p className="empty">材料にも成果物にも、つながるアイテムが見つかりませんでした。</p>;
  }

  const depths = flow.nodes.map((n) => n.depth);
  const min = Math.min(...depths);
  const max = Math.max(...depths);

  const columns = new Map<number, FlowNode[]>();
  for (const n of flow.nodes) {
    const list = columns.get(n.depth) ?? [];
    list.push(n);
    columns.set(n.depth, list);
  }
  const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
  const colW = NODE_W + COL_GAP;
  const width = (max - min + 1) * colW - COL_GAP + PAD * 2;
  const height = HEAD + maxRows * (NODE_H + ROW_GAP) - ROW_GAP + PAD * 2;

  const pos = new Map<string, { x: number; y: number; depth: number }>();
  for (const [depth, list] of columns) {
    const offset = ((maxRows - list.length) * (NODE_H + ROW_GAP)) / 2;
    list.forEach((n, i) => {
      pos.set(n.id, { x: PAD + (depth - min) * colW, y: HEAD + PAD + offset + i * (NODE_H + ROW_GAP), depth });
    });
  }

  return (
    <figure className="flow">
      <div className="flow-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', maxWidth: width, minWidth: Math.min(width, 640) }}
          role="group"
          aria-label="材料から成果物へのつながりの図"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" className="flow-arrow" />
            </marker>
          </defs>

          {[...columns.keys()].map((depth) => (
            <text key={depth} className="flow-head" x={PAD + (depth - min) * colW + NODE_W / 2} y={16} textAnchor="middle">
              {COLUMN_TITLE[depth] ?? ''}
            </text>
          ))}

          {flow.edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            // 材料側(中心へ集まる線)は出発点の近く、成果物側(中心から広がる線)は到着点の近くに個数を置く
            const nearSource = b.depth <= 0;
            return (
              <g key={`${e.from}>${e.to}`}>
                <path className="flow-edge" d={`M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`} markerEnd="url(#arrow)" />
                {e.label && (
                  <text
                    className="flow-qty"
                    x={nearSource ? x1 + 20 : x2 - 20}
                    y={(nearSource ? y1 : y2) - 5}
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {flow.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const name = itemName(db, n.id);
            return (
              <foreignObject key={n.id} x={p.x} y={p.y} width={NODE_W} height={NODE_H}>
                {n.depth === 0 ? (
                  <div className="fn self" title={name}>
                    <NodeBody db={db} n={n} />
                  </div>
                ) : (
                  <a className="fn" href={itemHref(n.id)} title={name}>
                    <NodeBody db={db} n={n} />
                  </a>
                )}
              </foreignObject>
            );
          })}
        </svg>
      </div>
      <figcaption>
        左から右へ「材料 → 成果物」の向きです。線の数字は必要個数、名前をクリックするとそのアイテムに移動します。
        枠の左の一文字は、そのアイテムを作る・得る生産系です({db.crafts.map((c) => `${c.char}=${c.name}`).join('、')})。
      </figcaption>
    </figure>
  );
}
