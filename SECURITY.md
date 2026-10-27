# セキュリティ / Security

## 脆弱性の報告 / Reporting a vulnerability

脆弱性を見つけた場合は、**公開の Issue には書かず**、GitHub の非公開の報告機能から知らせてください。

1. このリポジトリの **Security** タブを開く
2. **Report a vulnerability** を押す
3. 内容・再現手順・影響を書いて送信する

Please do **not** open a public issue. Use **Security → Report a vulnerability** to report privately.

## 対象 / Scope

- 公開ページ: https://kusam0ch1dayo.github.io/Unity-.cs-Editor/
- このリポジトリのコード (`index.html`, `js/`, `css/`, `sw.js`, `.github/workflows/`)

このアプリはブラウザの中だけで動き、サーバーへデータを送りません。作ったスクリプト・履歴・マイブロック・拡張パックは、使っているブラウザの中 (localStorage) にだけ保存されます。
特に次のような問題は報告をお願いします。

- 共有リンク (`#share=`)・プロジェクトファイル (.json)・拡張パック (.json)・C# の読み込みで、ページ上のスクリプトが実行されてしまう (XSS など)
- 拡張パックや共有リンクを開いただけで、ほかのデータが消えたり書き換わったりする
- GitHub Actions のワークフローの権限に関する問題

## 同梱ライブラリ / Bundled libraries

`vendor/` のライブラリ (Blockly, web-tree-sitter, tree-sitter-c-sharp) そのものの脆弱性は、それぞれの開発元に報告してください。このリポジトリで更新が必要な場合は、こちらにも知らせてください。
