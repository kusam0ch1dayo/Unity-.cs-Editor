# 運用メモ (更新するときにやること)

## 1. 変更を入れるたびに

| やること | どこで |
|---|---|
| 画面の文言を足したら、英語訳を `js/i18n.js` に足す (`tr('日本語')` のキー) | コード |
| ファイルを足したら `sw.js` の `FILES` に追加 | コード |
| ブロックを足したら、C# 生成・C# 読み込み・エラーチェック・説明・ツールボックスをそろえる | コード |
| `npm test` を実行 (手元で) | ターミナル |
| main にプッシュ → Actions の **Test** が緑になるのを確認 | GitHub の Actions タブ |
| 新機能なら README の「主な機能」「ファイル構成」を更新 | README.md |

プッシュすると GitHub Pages (https://kusam0ch1dayo.github.io/Unity-Block-Coder/) は 1〜2 分で自動的に更新される。

## 2. リリースを出すとき

1. **`js/version.js` の `APP_VERSION` を新しい番号に書き換え、同じファイルの `CHANGES` に新しくなった点を日本語・英語で書いてプッシュ** (番号は画面と設定画面に表示され、オフライン用のキャッシュもこれで作り直される。`CHANGES` は更新した人に 1 回だけ表示される)
2. リリースノートを `.github/release-notes/<タグ名>.md` に書いてプッシュ (なければ自動生成)
3. Actions → **Release** → **Run workflow** → タグ名を入力 (例 `v1.6.0`)。**`js/version.js` の番号と違うと止まる**
4. Releases にタグ・リリース・zip ができたことを確認

タグ名は **`v1.6.0` の形** (`v` の直後に数字) にそろえる。`v.1.5.1` のような形は並び順が崩れるので使わない。
番号の目安: 不具合の修正だけ → 3 つ目 (`v1.6.1`)、機能の追加 → 2 つ目 (`v1.7.0`)。

## 3. 定期的に (月 1 回くらい)

| やること | どこで |
|---|---|
| Dependabot のプルリクエストを確認し、**Test が緑ならマージ** | Pull requests タブ |
| Security タブで脆弱性の報告・Dependabot の警告がないか確認 | Security タブ |
| Issues (不具合・ブロック依頼) を確認 | Issues タブ |

Dependabot の対象はテスト用の Playwright と GitHub Actions だけ。アプリ本体のライブラリ (`vendor/`) は手動で更新する (手順は `vendor/README.md`)。

## 4. 一度だけやればよいこと (済んでいれば不要)

- Issues → Labels で `block request` ラベルを作る (ブロック依頼のフォームが自動で付ける)
