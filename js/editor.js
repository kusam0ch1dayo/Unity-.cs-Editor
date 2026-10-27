// C# を直接編集して、ブロックに反映する (ブロック → C# → ブロック の双方向)
const editor = { on: false, base: '' };
const side = document.getElementById('side'), codePre = document.getElementById('code');
const edWrap = Object.assign(document.createElement('div'), { id: 'csEditor', hidden: true });
edWrap.innerHTML = '<pre class="ed-hl" aria-hidden="true"></pre><textarea spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>';
codePre.after(edWrap);
const edHl = edWrap.querySelector('pre'), edText = edWrap.querySelector('textarea');
const edBar = Object.assign(document.createElement('div'), { id: 'edBar', hidden: true });
codePre.before(edBar);
const lock = Object.assign(document.createElement('div'), { id: 'editLock', hidden: true });
document.getElementById('left').appendChild(lock);
const editBtn = Object.assign(document.createElement('button'), { id: 'editCs' });
document.getElementById('copy').before(editBtn);

let edErrors = [], edTimer;
function paintEditor() {
  const lines = new Set(edErrors.map(x => x.line));
  edHl.innerHTML = hl(edText.value + '\n').split('\n').map((l, i) => `<span class="ln${lines.has(i + 1) ? ' err' : ''}">${l}</span>`).join('');
  edHl.scrollTop = edText.scrollTop; edHl.scrollLeft = edText.scrollLeft;
}
function checkEditor() {
  edErrors = tsParser ? syntaxErrors(edText.value) : [];
  const changed = edText.value !== editor.base;
  edBar.innerHTML = `<span>${edErrors.length ? `✖ ${esc(tr(edErrors[0].msg))} (${tr('行 {0}', edErrors[0].line)})${edErrors.length > 1 ? ` +${edErrors.length - 1}` : ''}`
      : changed ? pick(['✎ 編集中 — 「ブロックに反映」で更新します', '✎ Editing — "Apply to blocks" updates the blocks']) : pick(['✔ ブロックと同じ内容です', '✔ Same as the blocks'])}</span>`
    + `<button data-ed="apply" class="primary" ${edErrors.length || !changed ? 'disabled' : ''} title="Ctrl+Enter">${pick(['ブロックに反映', 'Apply to blocks'])}</button>`
    + `<button data-ed="close">${pick(['編集を終わる', 'Finish editing'])}</button>`;
  edBar.className = edErrors.length ? 'bad' : '';
  paintEditor();
}
function setEditMode(on) {
  if (!on && edText.value !== editor.base && !confirm(pick(['ブロックに反映していない変更があります。破棄して編集を終わりますか？', 'You have changes not applied to the blocks. Discard them?']))) return;
  editor.on = on;
  edWrap.hidden = edBar.hidden = lock.hidden = !on;
  codePre.hidden = on;
  editBtn.textContent = on ? pick(['✏️ 編集中', '✏️ Editing']) : pick(['✏️ C# を編集', '✏️ Edit C#']);
  editBtn.classList.toggle('pressed', on);
  lock.innerHTML = `<div>✏️ ${pick(['C# を編集しています。「ブロックに反映」するとブロックが更新されます。', 'Editing the C#. "Apply to blocks" updates the blocks.'])}</div>`;
  if (on) {
    AC.close(); Blockly.hideChaff();
    edText.value = editor.base = code;
    checkEditor();
    edText.focus();
  }
  if (typeof refreshShortcuts === 'function') refreshShortcuts();
}
function applyEditor() {
  if (!tsParser || edErrors.length) return;
  const caretLine = edText.value.slice(0, edText.selectionStart).split('\n').length, scroll = edText.scrollTop;
  try {
    takeSnapshot(pick(['C# 編集の前', 'Before editing C#']), true);
    const r = importCs(edText.value, false);
    update();
    collect(r, pick(['C# 編集', 'C# editing']));
    if (r.log.length) renderLog(r);
    showToast(pick(['ブロックに反映しました (取り消しで元に戻せます)', 'Applied to the blocks (Undo to revert)'])
      + (r.log.length ? '\n' + pick([`${r.log.length} か所は専用ブロックがないため「C# 文 / 式」ブロックになりました`, `${r.log.length} places became "C# statement / expression" blocks`]) : ''), 4000);
  } catch (err) { showToast(tr('変換できませんでした: {0}', tr(err.message)), 5000); return; }
  // 書式はブロックから作り直した C# にそろえる (カーソルの行はなるべく保つ)
  edText.value = editor.base = code;
  const lines = code.split('\n'), pos = lines.slice(0, Math.min(caretLine, lines.length) - 1).reduce((n, l) => n + l.length + 1, 0);
  edText.setSelectionRange(pos, pos);
  edText.scrollTop = scroll;
  checkEditor();
}
editBtn.onclick = () => setEditMode(!editor.on);
edBar.onclick = e => {
  const act = e.target.closest('[data-ed]')?.dataset.ed;
  if (act === 'apply') applyEditor();
  if (act === 'close') setEditMode(false);
};
edText.addEventListener('input', () => { paintEditor(); clearTimeout(edTimer); edTimer = setTimeout(checkEditor, 250); });
edText.addEventListener('scroll', () => { edHl.scrollTop = edText.scrollTop; edHl.scrollLeft = edText.scrollLeft; });
edText.addEventListener('keydown', e => {
  const t = edText, s = t.selectionStart, en = t.selectionEnd, v = t.value;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); clearTimeout(edTimer); checkEditor(); applyEditor(); return; }
  if (e.key === 'Tab') {   // Tab は 4 文字の字下げ
    e.preventDefault();
    document.execCommand('insertText', false, '    ');
  } else if (e.key === 'Enter') {   // 改行したら前の行の字下げをそろえる ({ の後は 1 段深く)
    e.preventDefault();
    const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s), indent = line.match(/^\s*/)[0] + (/\{\s*$/.test(line) ? '    ' : '');
    document.execCommand('insertText', false, '\n' + indent);
  } else if (e.key === '}' && s === en && /^\s+$/.test(v.slice(v.lastIndexOf('\n', s - 1) + 1, s))) {   // 行頭の } は 1 段浅く
    e.preventDefault();
    const start = v.lastIndexOf('\n', s - 1) + 1, cut = Math.min(4, s - start);
    t.setSelectionRange(s - cut, s);
    document.execCommand('insertText', false, '}');
  }
});
setEditMode(false);
