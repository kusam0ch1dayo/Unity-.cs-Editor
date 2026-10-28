// アプリのバージョン (ここだけを書き換える)。画面の表示・オフライン用キャッシュの名前・リリースのタグ名の確認に使う
const APP_VERSION = '1.9.0';
// 新しくなった点 (更新したあとに 1 回だけ表示する)。新しい版を上に足していく
const CHANGES = {
  '1.9.0': [
    ['ブロックとツールボックスの色を鮮やかに', 'More vivid block and toolbox colors'],
    ['ツールボックスのカテゴリを、それぞれの色でうっすら色付け', 'Toolbox categories are tinted with their own color'],
    ['設定の「テーマ」タブで、ブロックの色の鮮やかさ (落ち着いた / 鮮やか / とても鮮やか) を選べます', 'Choose the block color intensity (Calm / Vivid / Very vivid) in the Theme tab'],
  ],
  '1.8.0': [
    ['ライトモードを明るく。C# の表示や下のパネルも明るい配色に', 'A brighter light mode, including the C# view and bottom panels'],
    ['設定をタブ (一般 / テーマ / ショートカット / 拡張) に整理', 'Settings are now organized in tabs (General / Theme / Shortcuts / Extensions)'],
    ['「テーマ」タブ: 明るさ・テーマカラー 8 色・コードの配色を選べます', 'Theme tab: choose the mode, one of 8 theme colors and the code colors'],
    ['アクセント・背景・パネル・文字・コードの背景の色を自分で変えられます (ライト / ダーク別)', 'Pick your own accent, background, panel, text and code background colors (separately for light / dark)'],
  ],
  '1.7.0': [
    ['Ctrl+S で Unity の Assets フォルダに直接保存 (Chrome / Edge)', 'Ctrl+S saves straight into your Unity Assets folder (Chrome / Edge)'],
    ['コピーした C# を Ctrl+V でブロックとして貼り付け。ブロックの Ctrl+C で C# もコピー', 'Paste C# as blocks with Ctrl+V. Ctrl+C on a block also copies its C#'],
    ['メソッドをまとめて折りたたむ・開く・整列 (編集メニュー)', 'Collapse / expand all methods and tidy up (Edit menu)'],
    ['対象の Unity バージョン (Unity 6 / 2022) を設定。古い API を警告してワンクリックで修正', 'Choose the target Unity version (6 / 2022). Old APIs are flagged with one-click fixes'],
    ['Update の中の GetComponent / Find を「Start で 1 回だけ取得」にワンクリックで書き換え', 'One click turns GetComponent / Find in Update into a field fetched once in Start'],
    ['編集履歴や C# 編集の変更点を色付きで比較', 'Compare changes in the history and the C# editor'],
    ['新しい版が出たらお知らせ。更新後にこの「新しくなった点」を表示', 'Update notice, and this "What\'s new" after updating'],
    ['タブの複製・ドラッグで並べ替え・閉じたタブを開き直す (Alt+Shift+T)・右クリックメニュー', 'Duplicate tabs, drag to reorder, reopen closed tabs (Alt+Shift+T), right-click menu'],
    ['設定で C# の文字サイズとブロックの大きさを変更', 'Change the C# font size and block size in Settings'],
    ['画面のデザインを改善', 'Refreshed design'],
  ],
};
