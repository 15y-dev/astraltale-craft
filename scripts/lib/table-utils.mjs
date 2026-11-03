// 表の列の探索など、抽出処理で共通の補助関数
import { clean } from './wiki.mjs';

export const MAT_RE = /^(必要(素材|材料)|材料)$/;
export const SUB_MAT_RE = /^必要(素材|材料)の(素材|材料)$/;

export const isRecipeHeader = (h) => h.some((l) => MAT_RE.test(l));

/** 見出し行から、正規表現に合う列番号を全て返す */
export const idxOf = (h, re) => h.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);

/** セルの個数表記(「1,000」など)を数にする。読めなければ 1 */
export const toQty = (cell) => parseInt(clean(cell ?? '').replace(/,/g, ''), 10) || 1;

/** '~' や空を、空文字にそろえる */
export const nonEmpty = (s) => (s && s !== '~' ? s : '');

// ページ名と同じ総称の見出しは、区分の名前に含めない
const ROOT_TITLES = {
  alchemy: ['錬金'],
  sewing: ['裁縫'],
  cooking: ['料理一覧/効果/合成詳細'],
  farming: ['作物'],
};

/** 見出しの階層から、表の区分(例: '装備 / 武器')を求める */
export function groupOf(craft, path) {
  const drop = ROOT_TITLES[craft] ?? [];
  const rest = path.length > 0 && drop.includes(path[0]) ? path.slice(1) : path;
  return rest.join(' / ');
}
