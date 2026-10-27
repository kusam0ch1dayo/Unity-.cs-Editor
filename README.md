# Unity-.cs-Editor

ブロックを組み合わせて、Unity 用の C# スクリプトを作れるブラウザアプリです。
C# を読み込んでブロックに戻すこともできます。

## 使い方

`index.html` をブラウザで開くだけで動きます (インストール不要)。
ライブラリを CDN (unpkg.com) から読み込むため、インターネット接続が必要です。

1. 左のカテゴリからブロックをドラッグして組み立てる
2. 右側にリアルタイムで C# が表示される
3. 「コピー」または「.cs 保存」で Unity の Assets に入れる

## 主な機能

- **ブロック → C#**: クラス・フィールド・メソッド・Unity イベント・コルーチン・リスト・辞書・Raycast・UI・サウンド・アニメ・PlayerPrefs など
- **エラーチェック**: C# 文法チェック (tree-sitter) と、未定義の変数・型の不一致などの意味チェック。エラーのあるブロックには警告アイコンが付きます
- **Tab 補完**: 入力欄で変数名・型・メンバーの候補を表示し、Tab で確定
- **取り消し / やり直し**: ボタン、Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z)
- **C# → ブロック**: 「C# 読込」で既存の .cs をブロックに変換。専用ブロックがない構文は「C# 文 / 式 / メンバー」ブロックで残します
- **読み込みログ**: 足りないブロックを一覧表示し、追加依頼の文章 (Markdown) にまとめられます

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | 画面の HTML。各ファイルを読み込む |
| `css/style.css` | 見た目 (ライト / ダークモード対応) |
| `js/blocks.js` | ブロックの見た目と入出力の定義 |
| `js/generator.js` | ブロック → C# コード生成 |
| `js/toolbox.js` | ツールボックスとサンプルプログラム |
| `js/types.js` | 型情報 (Unity API・メンバー・スコープ・型推論) |
| `js/checker.js` | エラーチェック (意味チェック・構文チェック) |
| `js/autocomplete.js` | Tab 補完 |
| `js/importer.js` | C# → ブロックの読み込みと読み込みログ |
| `js/app.js` | 起動と画面操作 (保存・取り消し・ダイアログなど) |

ビルドは不要です。JS は通常の `<script>` で上から順に読み込み、グローバルの定数・関数を共有しています。

## 制限

- 本物の C# コンパイラではありません。Unity API は主要なものだけ確認します
- 読み込み時、namespace・クラスの属性・コメントは省略されます

## 使用ライブラリ

- [Blockly](https://github.com/google/blockly) (Apache-2.0)
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter) / [tree-sitter-c-sharp](https://github.com/tree-sitter/tree-sitter-c-sharp) (MIT)

## 捕捉
- このエディター等は全てAIが作成した物です。
