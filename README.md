# 星界神話 生産アイテム早見表(非公式)

「このアイテムは、次の何の材料になるか」を、検索なしで調べるための静的サイトです。
星界神話 Wiki(wikiwiki.jp)の生産ページ(釣り・採集・栽培・錬金・料理・裁縫・合成)を一度取り込み、材料 → 成果物の関係を逆引きできるようにしています。

- 画面: 検索 / アイテム詳細(つながり図・使い道・入手元・作り方・素材の合計) / 生産系別の一覧 / 使い道のないアイテム
- 長い一覧(検索結果・生産系別・使い道のないアイテム)は、件数を省略せず、仮想スクロール(`@tanstack/react-virtual`)で見える範囲だけを描画します
- 構成: Vite + React + TypeScript。HTML は `index.html` の1枚で、ハッシュルーティング(`#/item/<id>`)。サーバー不要
- データ: ビルド前に `public/data/data.json` を生成し、初回に一度だけ読み込む
- 画像は転載していません(テキストのみ)

## コマンド

PowerShell の実行ポリシーで `npm` が使えない場合は `npm.cmd` を使います。

| 目的 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| データ生成(`raw/` → `public/data/data.json`、`data/report.txt`) | `npm run build:data` |
| テスト | `npm test` |
| 型チェック | `npm run typecheck` |
| ビルド(`dist/`) | `npm run build` |
| wiki の再取得(保存済みならスキップ。`--force` で上書き) | `npm run fetch` |

`public/data/data.json` は生成物なので、先に `npm run build:data` を実行してください(`raw/` に保存済み)。

## データの作り方

```
raw/*.txt  (wiki のソース)
  → scripts/lib/wiki.mjs            表のパーサー(見出しの階層・結合セル・~ の継承)
  → scripts/lib/extract-*.mjs       表の種類ごとにレシピ・入手元を取り出す
  → scripts/lib/pipeline.mjs        正規化(未鑑定の除去・別名)・重複の整理・ID付与
  → public/data/data.json, data/report.txt
```

- `data/aliases.json`: 表記ゆれの別名表(キー=wikiでの別表記、値=統一する名前)。`data/report.txt` の「入手元・レシピが見つからないアイテム」を見て足します。
- `data/manual-recipes.json`: 表ではなく説明文にだけ書かれているレシピの手入力(レッドローズ)。
- ID は名前のハッシュです。別名表を直すと ID が変わるので、公開後に URL を安定させたい場合は、最後に一度だけ固めてください。

## 既知の限界

- wiki に載っていない入手元(モンスタードロップ、購入、開封で出るもの)は、図の左端で止まります。
- 栽培ページの「用途」から作った関係は個数が分からず、画面では「個数不明」と出ます。
- 素材の合計は、レシピが複数あるアイテムでは、wikiの表で最初に出てくるものだけで数えます。
- 釣りの「大陸の主」(出現表)と、栽培の肥料の表は、材料の関係ではないので取り込んでいません。
- ブラウザでの見た目は、自動テストでは確認できません(HTML の描画と例外の有無までを確認しています)。
- 仮想スクロールの一覧は、ブラウザの「ページ内検索」(Ctrl+F)では、画面外の行が見つかりません。画面上の検索ボックスを使ってください。

## 公開

`.github/workflows/pages.yml` で GitHub Pages に公開できます(Settings > Pages の Source を「GitHub Actions」に)。
公開前に、wiki とゲーム運営側の利用規約を確認してください。本サイトは非公式のファンツールです。
