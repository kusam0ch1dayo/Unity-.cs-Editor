# vendor

オフラインでも動くように、外部ライブラリをこのフォルダに同梱しています。
どのファイルも npm の公式パッケージから取り出したもので、パッケージのハッシュが npm レジストリの公開値と一致することを確認しています。

| フォルダ | パッケージ | ライセンス |
|---|---|---|
| `blockly/` | [blockly](https://www.npmjs.com/package/blockly) 11.1.1 (`blockly_compressed.js`, `blocks_compressed.js`, `msg/`, `media/`) | Apache-2.0 (各ファイル先頭の `@license` を参照) |
| `tree-sitter/tree-sitter.js` | [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter) 0.20.8 | MIT (`LICENSE-web-tree-sitter`) |
| `tree-sitter/tree-sitter-wasm.js` | web-tree-sitter 0.20.8 の `tree-sitter.wasm` を base64 化 | MIT |
| `tree-sitter/tree-sitter-c_sharp-wasm.js` | [tree-sitter-wasms](https://www.npmjs.com/package/tree-sitter-wasms) 0.1.11 の `tree-sitter-c_sharp.wasm` を base64 化 | MIT (`LICENSE-tree-sitter-wasms`) |

wasm を base64 の JS にしているのは、`index.html` を直接開いた場合 (file://) でも `<script>` で読み込めるようにするためです。
