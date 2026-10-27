// 起動と画面の操作 (コード表示・保存・取り消し・読み込みダイアログ・読み込みログ)
// ---------- 起動 ----------
const ws = Blockly.inject('blocks', {
  toolbox, renderer: 'zelos', media: 'https://unpkg.com/blockly@11.1.1/media/', trashcan: true, move: { scrollbars: true, drag: true, wheel: true },
  zoom: { controls: true, wheel: false, startScale: 0.75 }, grid: { spacing: 24, length: 2, colour: '#ddd', snap: true },
});
const KEY = 'unity-block-coder';
const load = data => { Blockly.Events.setGroup(true); ws.clear(); Blockly.serialization.workspaces.load(data, ws); Blockly.Events.setGroup(false); };
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
Blockly.Events.disable();
try { load(saved || sample); } catch (e) { load(sample); }
Blockly.Events.enable();

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

let code = '', fileName = 'Script.cs';
function update() {
  code = cs.workspaceToCode(ws);
  const mono = ws.getTopBlocks(true).find(b => b.type === 'class_def' && f(b, 'BASE').trim() === 'MonoBehaviour')
            || ws.getTopBlocks(true).find(b => b.type === 'class_def');
  fileName = (mono ? f(mono, 'NAME') : 'Script') + '.cs';
  document.getElementById('fname').textContent = fileName;
  const issues = [...syntaxErrors(code), ...check()];
  const errLines = new Set(issues.filter(x => x.line).map(x => x.line));
  document.getElementById('code').innerHTML = hl(code).split('\n').map((l, i) => `<span class="ln${errLines.has(i + 1) ? ' err' : ''}" data-l="${i + 1}">${l}</span>`).join('');
  const nE = issues.filter(x => x.level === 'error').length, nW = issues.length - nE;
  const st = document.getElementById('status');
  st.textContent = nE || nW ? `✖ ${nE}  ⚠ ${nW}` : '✔ OK';
  st.style.color = nE ? '#ff6b6b' : nW ? '#f5c04a' : '#7bd88f';
  const box = document.getElementById('issues');
  box.innerHTML = (issues.length ? issues.map((x, i) => `<div class="issue ${x.level}" data-i="${i}"><b>${x.level === 'error' ? '✖' : '⚠'}</b> ${esc(x.msg)}<small>${x.line ? '行 ' + x.line : esc(x.block.toString(28))}</small></div>`).join('')
    : '<div class="ok">✔ エラーはありません</div>') + (tsState ? `<div><small>${tsState}</small></div>` : '');
  box.onclick = e => {
    const d = e.target.closest('.issue'); if (!d) return;
    const x = issues[+d.dataset.i];
    if (x.block) { ws.centerOnBlock(x.block.id); x.block.select(); }
    else document.querySelector(`.ln[data-l="${x.line}"]`)?.scrollIntoView({ block: 'center' });
  };
  document.getElementById('undo').disabled = !ws.getUndoStack().length;
  document.getElementById('redo').disabled = !ws.getRedoStack().length;
  try { localStorage.setItem(KEY, JSON.stringify(Blockly.serialization.workspaces.save(ws))); } catch (e) {}
}
ws.addChangeListener(e => { if (!e.isUiEvent) update(); });
update();

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
  try { await navigator.clipboard.writeText(code); e.target.textContent = 'コピー済'; }
  catch (err) { e.target.textContent = 'コピー失敗'; }
  setTimeout(() => e.target.textContent = 'コピー', 1500);
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
document.getElementById('import').onclick = () => { msg.textContent = ''; dlg.showModal(); };
document.getElementById('importCancel').onclick = () => dlg.close();
document.getElementById('importFile').onchange = async e => {
  const file = e.target.files[0];
  if (file) { document.getElementById('importSrc').value = await file.text(); srcName = file.name; }
};
let srcName = '貼り付けたコード';
document.getElementById('importSrc').addEventListener('input', () => srcName = '貼り付けたコード');
document.getElementById('importGo').onclick = () => {
  const src = document.getElementById('importSrc').value;
  if (!src.trim()) { msg.textContent = 'C# コードを入力してください'; return; }
  try {
    const r = importCs(src, document.getElementById('importAppend').checked);
    dlg.close();
    const kinds = renderLog(r);
    collect(r, srcName);
    toast.textContent = `${r.count} 個のブロックに変換しました` + (r.log.length ? `\n足りないブロック ${kinds} 種類 / ${r.log.length} か所 → 右の「読み込みログ」の「依頼文を作成」でまとめられます` : '')
      + '\n(取り消しで元に戻せます)';
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.hidden = true, 8000);
  } catch (err) { msg.textContent = '変換できませんでした: ' + err.message; }
};
toast.onclick = () => toast.hidden = true;

// 足りないブロックの累計 (複数回の読み込みをまとめて依頼文にする)
const MISSING_KEY = 'unity-block-coder-missing';
const KIND_ROLE = { raw_stmt: '文として使う', raw_expr: '値 (式) として使う', raw_member: 'クラスのメンバーとして使う' };
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
  bar.innerHTML = `<span>累計: 足りないブロック ${items.length} 種類 / ${items.reduce((n, x) => n + x.count, 0)} か所</span>`
    + '<span><button id="makeReq" class="primary">依頼文を作成</button> <button id="resetReq">リセット</button></span>';
}
function buildRequest() {
  const items = [...collected.items.values()].sort((a, b) => b.count - a.count), total = items.reduce((n, x) => n + x.count, 0);
  const lines = ['# Unity Block Coder: ブロック追加の依頼', '',
    `C# を読み込んだとき、専用ブロックがなく代用ブロック (C# 文 / 式 / メンバー) になった構文が ${items.length} 種類・計 ${total} か所ありました。`,
    'これらを専用ブロックとして index.html に追加してください。',
    '追加するときは C# 生成・C# 読み込み (Imp)・エラーチェック・Tab 補完・ツールボックスにも対応させ、下のコード例が「読み込み → C# 生成」で元と同じになることを確認してください。',
    '', '## 足りないブロック (多い順)'];
  items.forEach((x, i) => lines.push('', `### ${i + 1}. ${x.need}`, `- 出現数: ${x.count} か所 (${x.sources.join(', ')})`,
    `- 代用されたブロック: 「${KIND[x.type]}」(${KIND_ROLE[x.type]})`, '- コード例:', '```csharp', ...x.examples, '```'));
  if (collected.notes.length) lines.push('', '## 読み込み時に省略されたもの', ...collected.notes.map(n => `- ${n}`));
  lines.push('', `(${new Date().toLocaleString()} Unity Block Coder で作成)`);
  return lines.join('\n');
}
const reqDlg = document.getElementById('reqDlg');
document.getElementById('collectBar').onclick = e => {
  if (e.target.id === 'makeReq') { document.getElementById('reqText').value = buildRequest(); reqDlg.showModal(); }
  if (e.target.id === 'resetReq') { collected = { items: new Map(), notes: [] }; saveCollected(); renderCollected(); }
};
document.getElementById('reqClose').onclick = () => reqDlg.close();
document.getElementById('reqCopy').onclick = async e => {
  try { await navigator.clipboard.writeText(document.getElementById('reqText').value); e.target.textContent = 'コピー済'; }
  catch (err) { document.getElementById('reqText').select(); e.target.textContent = '選択しました (Ctrl+C でコピー)'; }
  setTimeout(() => e.target.textContent = 'コピー', 2000);
};
document.getElementById('reqSave').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([document.getElementById('reqText').value], { type: 'text/markdown' }));
  a.download = 'block-request.md'; a.click(); URL.revokeObjectURL(a.href);
};
renderCollected();

// 問題 / 読み込みログ タブ
const showTab = log => {
  document.getElementById('issues').hidden = log; document.getElementById('importLog').hidden = !log;
  document.getElementById('tabIssues').classList.toggle('on', !log); document.getElementById('tabLog').classList.toggle('on', log);
};
document.getElementById('tabIssues').onclick = () => showTab(false);
document.getElementById('tabLog').onclick = () => showTab(true);
const KIND = { raw_stmt: 'C# 文', raw_expr: 'C# 式', raw_member: 'C# メンバー' };
function renderLog(r) {
  const groups = new Map();
  r.log.forEach(e => groups.set(e.need, (groups.get(e.need) || 0) + 1));
  const sorted = [...groups].sort((a, b) => b[1] - a[1]);
  const text = [`読み込み ${new Date().toLocaleTimeString()} / ブロック ${r.count} 個 / 代用 ${r.log.length} か所`,
    ...sorted.map(([k, c]) => `[足りないブロック] ${k} ×${c}`), ...r.log.map(e => `行 ${e.line}: ${e.need} → ${KIND[e.type]} で代用: ${e.code}`),
    ...r.notes.map(n => `[情報] ${n}`)].join('\n');
  const box = document.getElementById('logBody');
  box.innerHTML = `<div class="log-head"><span>${new Date().toLocaleTimeString()} 読み込み: ブロック ${r.count} 個 / 代用 ${r.log.length} か所</span><button id="copyLog">ログをコピー</button></div>`
    + (sorted.length ? '<div class="log-sec">足りないブロック</div>' + sorted.map(([k, c]) => `<div class="log-need">■ ${esc(k)}<small>×${c}</small></div>`).join('')
      : '<div class="ok">✔ すべて専用ブロックに変換できました</div>')
    + (r.log.length ? '<div class="log-sec">詳細 (クリックでブロックへ移動)</div>' + r.log.map((e, i) =>
      `<div class="issue" data-i="${i}"><b style="color:#f5c04a">行 ${e.line}</b> ${esc(e.need)} → 「${KIND[e.type]}」で代用<code>${esc(e.code)}</code></div>`).join('') : '')
    + (r.notes.length ? '<div class="log-sec">その他</div>' + r.notes.map(n => `<div>ℹ ${esc(n)}</div>`).join('') : '');
  box.onclick = async e => {
    if (e.target.id === 'copyLog') {
      try { await navigator.clipboard.writeText(text); e.target.textContent = 'コピー済'; } catch (err) { e.target.textContent = 'コピー失敗'; }
      return;
    }
    const d = e.target.closest('.issue');
    const blk = d && ws.getBlockById(r.log[+d.dataset.i].id);
    if (blk) { ws.centerOnBlock(blk.id); blk.select(); }
  };
  document.getElementById('tabLog').textContent = `読み込みログ${r.log.length ? ` (${r.log.length})` : ''}`;
  console.log(text);
  showTab(true);
  return groups.size;
}
