// マイブロック: よく使うブロックのまとまりを登録して、ツールボックスから何度でも使う
const SNIPPET_KEY = 'unity-block-coder-snippets';
let snippets = [];
try { snippets = JSON.parse(localStorage.getItem(SNIPPET_KEY)) || []; } catch (e) {}
const saveSnippets = () => { try { localStorage.setItem(SNIPPET_KEY, JSON.stringify(snippets)); } catch (e) {} refreshToolbox(); };
const SNIPPET_CAT = () => pick(['⭐ マイブロック', '⭐ My blocks']);

function snippetCategory() {
  if (!snippets.length) return null;
  return { kind: 'category', name: SNIPPET_CAT(), colour: 45, contents: snippets.flatMap(s => [{ kind: 'label', text: s.name }, { kind: 'block', ...s.json }]) };
}
function addSnippet(block, withNext) {
  const json = Blockly.serialization.blocks.save(block, { addCoordinates: false, addNextBlocks: withNext, saveIds: false });
  Blockly.dialog.prompt(pick(['マイブロックの名前', 'Name of the block']), block.toString(24), name => {
    if (!name || !name.trim()) return;
    snippets.push({ name: name.trim(), json });
    saveSnippets();
    showToast(pick([`「${name.trim()}」をマイブロックに登録しました。ツールボックスの「⭐ マイブロック」から使えます`, `Added "${name.trim()}". Use it from "⭐ My blocks" in the toolbox`]), 4000);
  });
}
function openSnippets() {
  if (!snippets.length) {
    showToast(pick(['マイブロックはまだありません。ブロックを右クリック →「マイブロックに登録」で追加できます', 'No blocks yet. Right-click a block → "Add to My blocks"']), 4000);
    return;
  }
  const box = ws.getToolbox(), item = box.getToolboxItems().find(it => it.getName && it.getName() === SNIPPET_CAT());
  if (item) box.setSelectedItem(item);
}
for (const [id, withNext, label] of [['ubc_snippet', false, ['マイブロックに登録', 'Add to My blocks']], ['ubc_snippet_chain', true, ['マイブロックに登録 (下につながるブロックも)', 'Add to My blocks (with the blocks below)']]]) {
  Blockly.ContextMenuRegistry.registry.register({
    id, weight: -1, scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    displayText: () => '⭐ ' + pick(label),
    preconditionFn: s => s.block.isInFlyout || (withNext && !s.block.getNextBlock()) ? 'hidden' : 'enabled',
    callback: s => addSnippet(s.block, withNext),
  });
}
// 設定画面の「マイブロック」欄 (名前の変更・削除)
function snippetSettings() {
  return `<section><h3>⭐ ${pick(['マイブロック', 'My blocks'])}</h3>`
    + (snippets.length ? snippets.map((s, i) => `<div class="set-row"><span>${esc(s.name)}</span><span class="row">`
      + `<button data-snip-rename="${i}">${pick(['名前を変更', 'Rename'])}</button><button data-snip-remove="${i}">${tr('削除')}</button></span></div>`).join('')
      : `<p class="hint">${pick(['ブロックを右クリック →「マイブロックに登録」で追加できます。', 'Right-click a block → "Add to My blocks".'])}</p>`) + '</section>';
}
function handleSnippetSettings(e) {
  const rn = e.target.closest('[data-snip-rename]'), rm = e.target.closest('[data-snip-remove]');
  if (rn) {
    const s = snippets[+rn.dataset.snipRename];
    Blockly.dialog.prompt(pick(['新しい名前', 'New name']), s.name, name => { if (name && name.trim()) { s.name = name.trim(); saveSnippets(); renderSettings(); } });
    return true;
  }
  if (rm && confirm(pick(['このマイブロックを削除しますか？', 'Delete this block?']))) { snippets.splice(+rm.dataset.snipRemove, 1); saveSnippets(); renderSettings(); return true; }
  return false;
}
refreshToolbox();
