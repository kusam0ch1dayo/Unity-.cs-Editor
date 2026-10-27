// 起動と画面の操作 (コード表示・保存・取り消し・読み込みダイアログ・読み込みログ)
// ---------- 起動 ----------
const ws = Blockly.inject('blocks', {
  toolbox, renderer: 'zelos', comments: true, media: 'vendor/blockly/media/', trashcan: true, move: { scrollbars: true, drag: true, wheel: true },
  zoom: { controls: true, wheel: false, startScale: 0.75 }, grid: { spacing: 24, length: 2, colour: '#ddd', snap: true },
});
const load = data => { Blockly.Events.setGroup(true); ws.clear(); Blockly.serialization.workspaces.load(data, ws); Blockly.Events.setGroup(false); };

const KW = new Set('using public private protected internal static class void int float bool string var new return if else for foreach in while break continue true false null this base default'.split(' '));
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function hl(code) {
  const re = /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*")|\b(\d+(?:\.\d+)?f?)\b|\b([A-Za-z_]\w*)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index)); last = re.lastIndex;
    if (m[1]) out += `<span class="c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="n">${m[3]}</span>`;
    else out += KW.has(m[4]) ? `<span class="k">${m[4]}</span>` : /^[A-Z]/.test(m[4]) ? `<span class="t">${m[4]}</span>` : m[4];
  }
  return out + esc(code.slice(last));
}

let code = '', fileName = 'Script.cs', blockRanges = new Map(), issues = [], selectedId = null;
function update() {
  const g = generate(ws);
  code = g.code; blockRanges = g.ranges;
  fileName = scriptName(ws);
  document.getElementById('fname').textContent = fileName;
  issues = [...syntaxErrors(code), ...check()];
  const errLines = new Set(issues.filter(x => x.line).map(x => x.line));
  document.getElementById('code').innerHTML = hl(code).split('\n').map((l, i) => `<span class="ln${errLines.has(i + 1) ? ' err' : ''}" data-l="${i + 1}">${l}</span>`).join('');
  const nE = issues.filter(x => x.level === 'error').length, nW = issues.length - nE;
  const st = document.getElementById('status');
  st.textContent = nE || nW ? `✖ ${nE}  ⚠ ${nW}` : '✔ OK';
  st.style.color = nE ? '#ff6b6b' : nW ? '#f5c04a' : '#7bd88f';
  document.getElementById('issues').innerHTML = (issues.length ? issues.map((x, i) => `<div class="issue ${x.level}" data-i="${i}" title="${esc(typeof explainError === 'function' ? explainError(x.msg) : '')}"><b>${x.level === 'error' ? '✖' : '⚠'}</b> ${esc(tr(x.msg))}`
      + `<small>${x.line ? tr('行 {0}', x.line) : esc(x.block.toString(28))}</small>`
      + (x.fixes || []).map((fx, j) => `<button class="fix" data-f="${i}:${j}" title="${tr('クリックで修正')}">${esc(tr(fx.label))}</button>`).join('') + '</div>').join('')
    : `<div class="ok">${tr('✔ エラーはありません')}</div>`) + (tsState ? `<div><small>${tr(tsState)}</small></div>` : '');
  document.getElementById('undo').disabled = !ws.getUndoStack().length;
  document.getElementById('redo').disabled = !ws.getRedoStack().length;
  highlightBlock(selectedId);
  if (typeof saveProject === 'function') saveProject();
}
document.getElementById('issues').onclick = e => {
  const fx = e.target.closest('.fix');
  if (fx) {
    const [i, j] = fx.dataset.f.split(':').map(Number);
    Blockly.Events.setGroup(true);
    try { issues[i].fixes[j].run(); } finally { Blockly.Events.setGroup(false); }
    return;
  }
  const d = e.target.closest('.issue'); if (!d) return;
  const x = issues[+d.dataset.i];
  if (x.block) { ws.centerOnBlock(x.block.id); Blockly.common.setSelected(x.block); }
  else document.querySelector(`.ln[data-l="${x.line}"]`)?.scrollIntoView({ block: 'center' });
};
ws.addChangeListener(e => { if (!e.isUiEvent) update(); });

// ブロックを選ぶと対応する C# の行をハイライト。行をクリックするとブロックを選ぶ
function highlightBlock(id) {
  selectedId = id;
  document.querySelectorAll('#code .ln.hl').forEach(l => l.classList.remove('hl'));
  let b = id && ws.getBlockById(id);
  while (b && !blockRanges.has(b.id)) b = b.getParent();
  if (!b) return 0;
  const [s, e] = blockRanges.get(b.id);
  for (let l = s; l <= e; l++) document.querySelector(`#code .ln[data-l="${l}"]`)?.classList.add('hl');
  return s;
}
ws.addChangeListener(e => {
  if (e.type !== Blockly.Events.SELECTED) return;
  const s = highlightBlock(e.newElementId);
  if (s) document.querySelector(`#code .ln[data-l="${s}"]`)?.scrollIntoView({ block: 'nearest' });
});
document.getElementById('code').onclick = e => {
  const ln = e.target.closest('.ln');
  if (!ln) return;
  const line = +ln.dataset.l;
  let best = null, size = Infinity;
  blockRanges.forEach(([s, en], id) => { if (s <= line && line <= en && en - s < size) { size = en - s; best = id; } });
  const b = best && ws.getBlockById(best);
  if (b) { ws.centerOnBlock(b.id); Blockly.common.setSelected(b); }
};
// ブロックのメモを C# のコメントとして出力するか
const MEMO_KEY = 'unity-block-coder-memo';
try { cs.exportMemo = localStorage.getItem(MEMO_KEY) === '1'; } catch (e) {}
document.getElementById('memoOut').checked = !!cs.exportMemo;
document.getElementById('memoOut').onchange = e => {
  cs.exportMemo = e.target.checked;
  try { localStorage.setItem(MEMO_KEY, e.target.checked ? '1' : '0'); } catch (err) {}
  update();
};

document.getElementById('sample').onclick = () => load(sample);
document.getElementById('clear').onclick = () => { Blockly.Events.setGroup(true); ws.clear(); Blockly.Events.setGroup(false); };
const history = redo => { AC.close(); Blockly.hideChaff(); ws.undo(redo); };
document.getElementById('undo').onclick = () => history(false);
document.getElementById('redo').onclick = () => history(true);
// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z (文字入力中はブラウザ標準の取り消しを使う)
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!(e.ctrlKey || e.metaKey) || (k !== 'z' && k !== 'y') || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  history(k === 'y' || e.shiftKey);
}, true);
document.getElementById('copy').onclick = async e => {
  try { await navigator.clipboard.writeText(code); e.target.textContent = tr('コピー済'); }
  catch (err) { e.target.textContent = tr('コピー失敗'); }
  setTimeout(() => e.target.textContent = tr('コピー'), 1500);
};
document.getElementById('dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
  a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
};
window.addEventListener('resize', () => Blockly.svgResize(ws));

// C# 読込ダイアログ
const dlg = document.getElementById('importDlg'), msg = document.getElementById('importMsg'), toast = document.getElementById('toast');
let toastTimer;
function showToast(text, ms = 8000) {
  toast.textContent = text; toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.hidden = true, ms);
}
document.getElementById('import').onclick = () => { msg.textContent = ''; dlg.showModal(); };
document.getElementById('importCancel').onclick = () => dlg.close();
const importSrc = document.getElementById('importSrc'), importFile = document.getElementById('importFile'), SRC_PLACEHOLDER = importSrc.placeholder;
let srcName = tr('貼り付けたコード'), srcFiles = [];
importFile.onchange = async e => {
  srcFiles = [...e.target.files];
  if (srcFiles.length === 1) { importSrc.value = await srcFiles[0].text(); srcName = srcFiles[0].name; srcFiles = []; }
  else if (srcFiles.length > 1) { importSrc.value = ''; importSrc.placeholder = tr('{0} 個のファイルを選びました。それぞれ新しいタブで開きます', srcFiles.length); }
};
importSrc.addEventListener('input', () => { srcName = tr('貼り付けたコード'); srcFiles = []; importSrc.placeholder = SRC_PLACEHOLDER; });
document.getElementById('importGo').onclick = async () => {
  const toNewTab = document.getElementById('importNewTab').checked, append = document.getElementById('importAppend').checked;
  if (!srcFiles.length && !importSrc.value.trim()) { msg.textContent = tr('C# コードを入力してください'); return; }
  try {
    let r;
    if (srcFiles.length) {
      // 複数ファイル: それぞれ新しいタブに
      r = { count: 0, log: [], notes: [] };
      for (const file of srcFiles) {
        newTab({});
        const x = importCs(await file.text(), false);
        ws.clearUndo();
        collect(x, file.name);
        r.count += x.count; r.log.push(...x.log); x.notes.forEach(n => r.notes.includes(n) || r.notes.push(n));
      }
    } else {
      if (toNewTab && !append) newTab({});
      r = importCs(importSrc.value, append);
      if (toNewTab && !append) ws.clearUndo();
      collect(r, srcName);
    }
    const files = srcFiles.length;
    dlg.close();
    srcFiles = []; importFile.value = ''; importSrc.placeholder = SRC_PLACEHOLDER;
    const kinds = renderLog(r);
    showToast(tr('{0} 個のブロックに変換しました', r.count) + (files ? ' ' + tr('({0} ファイル)', files) : '')
      + (r.log.length ? '\n' + tr('足りないブロック {0} 種類 / {1} か所 → 右の「読み込みログ」の「依頼文を作成」でまとめられます', kinds, r.log.length) : '')
      + '\n' + tr(toNewTab || files ? '(新しいタブで開きました)' : '(取り消しで元に戻せます)'));
  } catch (err) { msg.textContent = tr('変換できませんでした: {0}', tr(err.message)); }
};
toast.onclick = () => toast.hidden = true;

// 足りないブロックの累計 (複数回の読み込みをまとめて依頼文にする)
const MISSING_KEY = 'unity-block-coder-missing';
const KIND_ROLE = { raw_stmt: tr('文として使う'), raw_expr: tr('値 (式) として使う'), raw_member: tr('クラスのメンバーとして使う') };
let collected = { items: new Map(), notes: [] };
try {
  const d = JSON.parse(localStorage.getItem(MISSING_KEY));
  if (d) collected = { items: new Map(d.items), notes: d.notes };
} catch (e) {}
const saveCollected = () => {
  try { localStorage.setItem(MISSING_KEY, JSON.stringify({ items: [...collected.items], notes: collected.notes })); } catch (e) {}
};
function collect(r, source) {
  for (const e of r.log) {
    const it = collected.items.get(e.need) || { need: e.need, type: e.type, count: 0, examples: [], sources: [], seen: [] };
    const key = `${source}:${e.line}:${e.full}`;
    if (it.seen.includes(key)) continue;
    it.seen.push(key); it.count++;
    if (it.examples.length < 3 && !it.examples.includes(e.full)) it.examples.push(e.full);
    if (!it.sources.includes(source)) it.sources.push(source);
    collected.items.set(e.need, it);
  }
  r.notes.forEach(n => collected.notes.includes(n) || collected.notes.push(n));
  saveCollected();
  renderCollected();
}
function renderCollected() {
  const bar = document.getElementById('collectBar'), items = [...collected.items.values()];
  bar.hidden = !items.length;
  bar.innerHTML = `<span>${tr('累計: 足りないブロック {0} 種類 / {1} か所', items.length, items.reduce((n, x) => n + x.count, 0))}</span>`
    + `<span><button id="makeReq" class="primary">${tr('依頼文を作成')}</button> <button id="resetReq">${tr('リセット')}</button></span>`;
}
function buildRequest() {
  const items = [...collected.items.values()].sort((a, b) => b.count - a.count), total = items.reduce((n, x) => n + x.count, 0);
  const lines = [tr('# Unity Block Coder: ブロック追加の依頼'), '',
    tr('C# を読み込んだとき、専用ブロックがなく代用ブロック (C# 文 / 式 / メンバー) になった構文が {0} 種類・計 {1} か所ありました。', items.length, total),
    tr('これらを専用ブロックとして index.html に追加してください。'),
    tr('追加するときは C# 生成・C# 読み込み (Imp)・エラーチェック・Tab 補完・ツールボックスにも対応させ、下のコード例が「読み込み → C# 生成」で元と同じになることを確認してください。'),
    '', tr('## 足りないブロック (多い順)')];
  items.forEach((x, i) => lines.push('', `### ${i + 1}. ${tr(x.need)}`, tr('- 出現数: {0} か所 ({1})', x.count, x.sources.join(', ')),
    tr('- 代用されたブロック: 「{0}」({1})', KIND[x.type], KIND_ROLE[x.type]), tr('- コード例:'), '```csharp', ...x.examples, '```'));
  if (collected.notes.length) lines.push('', tr('## 読み込み時に省略されたもの'), ...collected.notes.map(n => `- ${tr(n)}`));
  lines.push('', tr('({0} Unity Block Coder で作成)', new Date().toLocaleString()));
  return lines.join('\n');
}
const reqDlg = document.getElementById('reqDlg');
document.getElementById('collectBar').onclick = e => {
  if (e.target.id === 'makeReq') { document.getElementById('reqText').value = buildRequest(); reqDlg.showModal(); }
  if (e.target.id === 'resetReq') { collected = { items: new Map(), notes: [] }; saveCollected(); renderCollected(); }
};
document.getElementById('reqClose').onclick = () => reqDlg.close();
document.getElementById('reqCopy').onclick = async e => {
  try { await navigator.clipboard.writeText(document.getElementById('reqText').value); e.target.textContent = tr('コピー済'); }
  catch (err) { document.getElementById('reqText').select(); e.target.textContent = tr('選択しました (Ctrl+C でコピー)'); }
  setTimeout(() => e.target.textContent = tr('コピー'), 2000);
};
document.getElementById('reqSave').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([document.getElementById('reqText').value], { type: 'text/markdown' }));
  a.download = 'block-request.md'; a.click(); URL.revokeObjectURL(a.href);
};
renderCollected();

// 問題 / 読み込みログ タブ
const PANELS = { issues: 'tabIssues', help: 'tabHelp', hints: 'tabHints', importLog: 'tabLog' };
function showPanel(name) {
  for (const [panel, tab] of Object.entries(PANELS)) {
    document.getElementById(panel).hidden = panel !== name;
    document.getElementById(tab).classList.toggle('on', panel === name);
  }
}
const showTab = log => showPanel(log ? 'importLog' : 'issues');
Object.entries(PANELS).forEach(([panel, tab]) => document.getElementById(tab).onclick = () => showPanel(panel));
const KIND = { raw_stmt: tr('C# 文'), raw_expr: tr('C# 式'), raw_member: tr('C# メンバー') };
function renderLog(r) {
  const groups = new Map();
  r.log.forEach(e => groups.set(e.need, (groups.get(e.need) || 0) + 1));
  const sorted = [...groups].sort((a, b) => b[1] - a[1]);
  const text = [tr('読み込み {0} / ブロック {1} 個 / 代用 {2} か所', new Date().toLocaleTimeString(), r.count, r.log.length),
    ...sorted.map(([k, c]) => tr('[足りないブロック] {0} ×{1}', tr(k), c)), ...r.log.map(e => tr('行 {0}: {1} → {2} で代用: {3}', e.line, tr(e.need), KIND[e.type], e.code)),
    ...r.notes.map(n => tr('[情報] {0}', tr(n)))].join('\n');
  const box = document.getElementById('logBody');
  box.innerHTML = `<div class="log-head"><span>${esc(tr('{0} 読み込み: ブロック {1} 個 / 代用 {2} か所', new Date().toLocaleTimeString(), r.count, r.log.length))}</span><button id="copyLog">${tr('ログをコピー')}</button></div>`
    + (sorted.length ? `<div class="log-sec">${tr('足りないブロック')}</div>` + sorted.map(([k, c]) => `<div class="log-need">■ ${esc(tr(k))}<small>×${c}</small></div>`).join('')
      : `<div class="ok">${tr('✔ すべて専用ブロックに変換できました')}</div>`)
    + (r.log.length ? `<div class="log-sec">${tr('詳細 (クリックでブロックへ移動)')}</div>` + r.log.map((e, i) =>
      `<div class="issue" data-i="${i}"><b style="color:#f5c04a">${tr('行 {0}', e.line)}</b> ${esc(tr(e.need))} ${esc(tr('→ 「{0}」で代用', KIND[e.type]))}<code>${esc(e.code)}</code></div>`).join('') : '')
    + (r.notes.length ? `<div class="log-sec">${tr('その他')}</div>` + r.notes.map(n => `<div>ℹ ${esc(tr(n))}</div>`).join('') : '');
  box.onclick = async e => {
    if (e.target.id === 'copyLog') {
      try { await navigator.clipboard.writeText(text); e.target.textContent = tr('コピー済'); } catch (err) { e.target.textContent = tr('コピー失敗'); }
      return;
    }
    const d = e.target.closest('.issue');
    const blk = d && ws.getBlockById(r.log[+d.dataset.i].id);
    if (blk) { ws.centerOnBlock(blk.id); Blockly.common.setSelected(blk); }
  };
  document.getElementById('tabLog').textContent = tr('読み込みログ') + (r.log.length ? ` (${r.log.length})` : '');
  console.log(text);
  showTab(true);
  return groups.size;
}

// オフライン対応 (http(s) で開いたときだけ。file:// ではサービスワーカーは使えない)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
