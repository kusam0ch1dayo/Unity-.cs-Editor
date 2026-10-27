// プロジェクトの保存・読み込み (.json)、URL での共有、編集履歴 (スナップショット)
const PROJECT_FORMAT = 'unity-block-coder-project';
const validProject = d => d && d.format === PROJECT_FORMAT && Array.isArray(d.files) && d.files.length > 0
  && d.files.every(x => x && typeof x.name === 'string' && x.state && typeof x.state === 'object');
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function pickFile(accept) {
  return new Promise(ok => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => ok(input.files[0] || null);
    input.click();
  });
}

// ---------- プロジェクトファイル (.json) ----------
function projectData() {
  saveProject();
  return { format: PROJECT_FORMAT, version: 1, savedAt: new Date().toISOString(), active: project.active, files: project.files.map(({ name, state }) => ({ name, state })) };
}
function saveProjectFile() {
  downloadBlob(new Blob([JSON.stringify(projectData(), null, 1)], { type: 'application/json' }), 'UnityBlockProject.json');
  showToast(pick(['プロジェクト (全タブ) を保存しました', 'Saved the project (all tabs)']), 3000);
}
async function openProjectFile() {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  let d = null;
  try { d = JSON.parse(await file.text()); } catch (e) {}
  if (!validProject(d)) { showToast(pick(['プロジェクトファイルではないため開けませんでした', 'This is not a project file']), 4000); return; }
  if (!confirm(pick([`今のタブをすべて閉じて「${file.name}」を開きますか？ (今の内容は履歴に残ります)`, `Close all tabs and open "${file.name}"? (The current content stays in the history)`]))) return;
  project.files.forEach((x, i) => takeSnapshot(pick(['プロジェクトを開く前', 'Before opening a project']), true, i));
  project.files = d.files.map(x => ({ name: x.name, state: x.state }));
  project.active = Math.min(Math.max(d.active || 0, 0), project.files.length - 1);
  loadActive();
  showToast(pick([`プロジェクトを開きました (${project.files.length} タブ)`, `Opened the project (${project.files.length} tabs)`]), 3000);
}

// ---------- URL で共有 (今のタブを圧縮して URL の # の後ろに入れる) ----------
const toB64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function deflateB64(str) { return toB64url(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
async function inflateB64(s) { return new Response(new Blob([fromB64url(s)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); }
async function shareLink() {
  saveProject();
  const tab = project.files[project.active];
  const url = `${location.href.split('#')[0]}#share=${await deflateB64(JSON.stringify({ format: PROJECT_FORMAT, version: 1, files: [{ name: tab.name, state: tab.state }] }))}`;
  let copied = true;
  try { await navigator.clipboard.writeText(url); } catch (e) { copied = false; }
  if (!copied) window.prompt(pick(['このリンクをコピーしてください', 'Copy this link']), url);
  showToast(pick([`「${tab.name}」の共有リンクをコピーしました (${url.length} 文字)`, `Copied a share link for "${tab.name}" (${url.length} characters)`])
    + (location.protocol === 'file:' ? '\n' + pick(['このページはパソコン内のファイルとして開いているので、リンクはこの PC でしか開けません。GitHub Pages などで公開すると、誰でも開けます。',
      'This page is opened as a local file, so the link only works on this PC. Publish it (e.g. GitHub Pages) so anyone can open it.']) : '')
    + (url.length > 8000 ? '\n' + pick(['リンクが長いため、アプリによっては途中で切れることがあります。', 'The link is long and may be cut off by some apps.']) : ''), 7000);
}
async function openSharedFromHash() {
  const m = location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  window.history.replaceState(null, '', location.href.split('#')[0]);
  try {
    const d = JSON.parse(await inflateB64(m[1]));
    if (!validProject(d)) throw new Error();
    if (!tsParser) await tsReady;
    if (!confirm(pick([`共有された「${d.files.map(x => x.name).join(', ')}」を新しいタブで開きますか？`, `Open the shared "${d.files.map(x => x.name).join(', ')}" in a new tab?`]))) return;
    d.files.forEach(x => newTab(x.state));
    showToast(pick(['共有されたスクリプトを開きました', 'Opened the shared script']), 3000);
  } catch (e) { showToast(pick(['共有リンクを開けませんでした (リンクが途中で切れているかもしれません)', 'Could not open the share link (it may be cut off)']), 5000); }
}
window.addEventListener('hashchange', openSharedFromHash);

// ---------- 編集履歴 (スナップショット) ----------
const HISTORY_KEY = 'unity-block-coder-history', HISTORY_MAX = 30;
let snapshots = [];
try { snapshots = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) {}
function saveSnapshots() {
  for (;;) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(snapshots)); return; }
    catch (e) { if (snapshots.length <= 1) return; snapshots.length = Math.ceil(snapshots.length / 2); }   // 容量が足りなければ古いものから減らす
  }
}
// 今のタブ (または i 番目のタブ) の状態を記録する。同じ内容が直前にあれば記録しない (force のときは記録する)
function takeSnapshot(label, force = false, i = project.active) {
  if (i === project.active) saveProject();
  const tab = project.files[i], json = JSON.stringify(tab.state);
  const last = snapshots.find(s => s.tab === tab.name);
  if (last && last.json === json && !force) return;
  if (json.length < 40) return;   // 空のタブは記録しない
  snapshots.unshift({ time: Date.now(), tab: tab.name, label, json, blocks: (json.match(/"type":/g) || []).length });
  if (snapshots.length > HISTORY_MAX) snapshots.length = HISTORY_MAX;
  saveSnapshots();
}
setInterval(() => takeSnapshot(pick(['自動保存', 'Auto save'])), 2 * 60 * 1000);
window.addEventListener('beforeunload', () => takeSnapshot(pick(['閉じる前', 'Before closing'])));

const historyDlg = document.body.appendChild(Object.assign(document.createElement('dialog'), { id: 'historyDlg' }));
function openHistory() {
  takeSnapshot(pick(['自動保存', 'Auto save']));
  const fmt = t => new Date(t).toLocaleString();
  historyDlg.innerHTML = `<div class="settings-head"><h2>🕘 ${pick(['編集履歴', 'History'])}</h2><button data-h="close">${tr('閉じる')}</button></div>`
    + `<p class="hint">${pick(['2 分ごとと、全消去・読み込みなどの前に自動で記録されます (最大 30 件)。', 'Saved every 2 minutes and before clearing, importing and similar actions (up to 30).'])}</p>`
    + `<div class="row"><button data-h="snap">📸 ${pick(['今の状態を記録', 'Save the current state'])}</button><button data-h="wipe">${pick(['履歴を消去', 'Clear history'])}</button></div>`
    + (snapshots.length ? snapshots.map((s, i) => `<div class="set-row"><span><b>${esc(s.tab)}</b> <small>${fmt(s.time)} · ${esc(s.label)} · ${s.blocks} ${tr('ブロック')}</small></span>`
      + `<span class="row"><button data-h="restore" data-i="${i}">${pick(['このタブに戻す', 'Restore here'])}</button><button data-h="diff" data-i="${i}">${pick(['今と比較', 'Compare'])}</button><button data-h="open" data-i="${i}">${pick(['新しいタブで開く', 'Open in new tab'])}</button></span></div>`).join('')
      : `<p>${pick(['まだ履歴はありません。', 'No history yet.'])}</p>`);
  if (!historyDlg.open) historyDlg.showModal();
}
historyDlg.onclick = e => {
  const b = e.target.closest('[data-h]');
  if (!b) return;
  const act = b.dataset.h, s = snapshots[+b.dataset.i];
  if (act === 'close') return historyDlg.close();
  if (act === 'snap') takeSnapshot(pick(['手動で記録', 'Saved manually']), true);
  if (act === 'wipe' && confirm(pick(['編集履歴をすべて消去しますか？', 'Clear all history?']))) { snapshots = []; saveSnapshots(); }
  if (act === 'restore') {
    takeSnapshot(pick(['履歴から戻す前', 'Before restoring']), true);
    load(JSON.parse(s.json));   // 取り消し (Ctrl+Z) で元に戻せる
    historyDlg.close();
    showToast(pick(['履歴から戻しました (取り消しで元に戻せます)', 'Restored from history (Undo to revert)']), 3000);
    return;
  }
  if (act === 'open') { newTab(JSON.parse(s.json)); historyDlg.close(); return; }
  if (act === 'diff') { saveProject(); showDiff(stateCs(JSON.parse(s.json)), code, [`${s.tab} (${new Date(s.time).toLocaleString()})`, pick([`今の ${fileName}`, `Current ${fileName}`])]); return; }
  openHistory();
};

openSharedFromHash();
