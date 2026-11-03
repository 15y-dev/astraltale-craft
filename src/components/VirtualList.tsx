import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void;
}

interface Props<T> {
  items: T[];
  /** 行の高さの見積り(実際の高さは描画後に測り直す) */
  estimate: (item: T, index: number) => number;
  /** 項目の安定したキー */
  keyOf: (item: T, index: number) => string;
  render: (item: T, index: number) => ReactNode;
  /** 画面に収まる行数ぶんの描画を、サーバー側の描画やテストで確認するための初期の表示領域 */
  initialHeight?: number;
  className?: string;
  /** 目次などから、指定した項目へスクロールするためのハンドル */
  handle?: Ref<VirtualListHandle>;
  /** 表全体の説明(スクリーンリーダー用) */
  label: string;
}

/**
 * ページ全体のスクロールに合わせて、画面に見える範囲の行だけを描画する縦のリスト。
 * 件数は省略せず、スクロールすれば全件に届く。
 */
export function VirtualList<T>({ items, estimate, keyOf, render, initialHeight = 900, className, handle, label }: Props<T>) {
  const root = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);

  // リストがページの上から何px目にあるか(ヘッダーや見出しの分)
  useLayoutEffect(() => {
    const update = () => {
      if (root.current) setMargin(root.current.getBoundingClientRect().top + window.scrollY);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [items.length]);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: items.length,
    estimateSize: (i) => estimate(items[i], i),
    getItemKey: (i) => keyOf(items[i], i),
    overscan: 8,
    scrollMargin: margin,
    initialRect: { width: 800, height: initialHeight },
  });

  useImperativeHandle(handle, () => ({ scrollToIndex: (index) => virtualizer.scrollToIndex(index, { align: 'start' }) }), [virtualizer]);

  return (
    <div ref={root} className={className} role="table" aria-label={label} aria-rowcount={items.length}>
      <div className="vl-body" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            ref={virtualizer.measureElement}
            data-index={v.index}
            className="vl-item"
            style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
          >
            {render(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
