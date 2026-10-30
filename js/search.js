// ブロック検索: ブロックの表示文字・カテゴリ名・説明・別名から探して、フライアウトに一覧表示する
const SEARCH_ALIASES = {
  'クラス': 'class メソッド 関数 function フィールド 変数 プロパティ', 'Unity': 'イベント 移動 入力 キー マウス 回転 ベクトル vector input',
  'オブジェクト': '生成 削除 作る 消す コンポーネント component prefab プレハブ', 'コルーチン': '待つ 待機 遅延 時間 wait 秒 timer',
  '変数': 'variable 代入 値', 'ロジック': '条件 もし 比較 分岐 if else switch', 'ループ': '繰り返し くりかえし 反復 loop',
  '数値・文字': '計算 数学 math 文字列 string テキスト 乱数 random', 'リスト': '配列 array list 一覧', '辞書': 'dictionary マップ キー',
  'Raycast': 'レイ 光線 当たり判定 ray hit', 'UI': 'ボタン テキスト 文字 表示 スライダー 画像 button text', 'サウンド・アニメ': '音 おと 効果音 オーディオ sound audio アニメーション animation',
  'セーブ・アプリ': '保存 セーブ ロード 読み込み save load 終了', '2D物理': '物理 physics 2d 当たり判定 ジャンプ 力', 'Gizmos・デバッグ': 'デバッグ debug ギズモ 線 表示',
  'ラムダ式': 'lambda 無名関数 =>', 'コメント・属性': 'コメント メモ 属性 attribute header インスペクター inspector', 'その他': 'C# 直接 コード',
};
let searchIndex = null;
function buildSearchIndex() {
  const tmp = new Blockly.Workspace(), out = [];
  // しまったカテゴリ (フォルダの中のカテゴリ) も探す
  const cats = activeToolbox.contents.flatMap(c => (c.contents || []).some(x => x.kind === 'category') ? c.contents.filter(x => x.kind === 'category') : [c]);
  for (const c of cats) for (const item of c.contents) {
    let text = '';
    try {
      const b = Blockly.serialization.blocks.append({ type: item.type, fields: item.fields, inputs: item.inputs }, tmp);
      text = b.toString() + ' ' + (typeof b.tooltip === 'string' ? b.tooltip : '');
    } catch (e) {}
    out.push({ item, text: `${item.type} ${c.name} ${SEARCH_ALIASES[CAT_JA.get(c.name)] || ''} ${text}`.toLowerCase() });
  }
  tmp.dispose();
  return out;
}
function searchBlocks(q) {
  const box = ws.getToolbox(), flyout = box.getFlyout();
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) { flyout.hide(); return; }
  searchIndex = searchIndex || buildSearchIndex();
  const hits = searchIndex.filter(x => words.every(w => x.text.includes(w))).map(x => x.item);
  box.clearSelection();
  flyout.show(hits.length ? [{ kind: 'label', text: tr('「{0}」の検索結果: {1} 件', q.trim(), hits.length) }, ...hits.slice(0, 50)]
    : [{ kind: 'label', text: tr('「{0}」に合うブロックはありません', q.trim()) }]);
}
const searchInput = document.getElementById('search');
let searchTimer;
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => searchBlocks(searchInput.value), 150); });
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { searchInput.value = ''; searchBlocks(''); searchInput.blur(); } });
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
});
