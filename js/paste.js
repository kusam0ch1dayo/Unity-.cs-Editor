// C# の貼り付けとコピー
// - ブロックを Ctrl+C すると、ブロックのコピーに加えて C# の文字もクリップボードに入る (エディターにそのまま貼れる)
// - どこかでコピーした C# を Ctrl+V すると、その場所にブロックとして入る (クラス・メンバー・文・式のどれでもよい)
let lastCopiedCs = null, copiedBlock = null;   // copiedBlock: ブロックとして貼り付けるためのデータ

// 1 つのブロック (とその中身) の C#
function blockCs(b) {
  cs.init(ws);
  const out = cs.blockToCode(b, true);
  return (Array.isArray(out) ? out[0] : out).replace(/[\u0001\u0003][^\u0002]*\u0002/g, '').replace(/\s+$/, '');
}
(function wrapClipboardShortcuts() {
  const reg = Blockly.ShortcutRegistry.registry, items = reg.getRegistry(), N = Blockly.ShortcutItems.names;
  for (const name of [N.COPY, N.CUT]) {
    const orig = items[name];
    if (!orig) continue;
    const keys = reg.getKeyCodesByShortcutName(name);
    reg.unregister(name);
    reg.register({ ...orig, keyCodes: keys, callback: (w, e, sc, scope) => {
      const b = Blockly.common.getSelected();
      if (b && b.workspace === ws && !b.isInFlyout) {
        try { copiedBlock = b.toCopyData(); lastCopiedCs = blockCs(b); navigator.clipboard.writeText(lastCopiedCs).catch(() => {}); } catch (err) {}
      }
      return orig.callback(w, e, sc, scope);
    } });
  }
  // 貼り付けはブラウザの paste イベントで受け取る (クリップボードの文字を読むため)。ここでは何もしない
  const keys = reg.getKeyCodesByShortcutName(N.PASTE);
  reg.unregister(N.PASTE);
  reg.register({ name: N.PASTE, keyCodes: keys, preconditionFn: w => !w.options.readOnly && !Blockly.Gesture.inProgress(), callback: () => false });
})();

// 貼り付けた C# を、クラス → メンバー → 文 → 式 の順に試してブロックにする
Imp.snippet = function (text) {
  const tries = [
    ['file', text],
    ['member', `class __P {\n${text}\n}`],
    ['stmt', `class __P { void __M() {\n${text}\n} }`],
    ['expr', `class __P { void __M() { var __x = ${text.replace(/;\s*$/, '')}; } }`],
  ];
  for (const [kind, src] of tries) {
    const tree = tsParser.parse(src);
    try {
      if (tree.rootNode.hasError()) continue;
      this.src = src; this.log = []; this.seq = 0; this.comments = 0; this.notes = new Set();
      if (kind === 'file') {
        if (!tree.rootNode.namedChildren.some(c => /^(class|enum|namespace)_declaration$|file_scoped_namespace/.test(c.type))) continue;
        const tops = []; this.top(tree.rootNode, tops);
        return { kind, blocks: tops, log: this.log };
      }
      const cls = tree.rootNode.namedChildren.find(c => c.type === 'class_declaration'), body = cls.childForFieldName('body');
      if (kind === 'member') {
        const ms = body.namedChildren;
        if (!ms.length) continue;
        return { kind, blocks: [this.chain(ms.flatMap(m => this.member(m))).block], log: this.log };
      }
      const blk = body.namedChildren.find(c => c.type === 'method_declaration').childForFieldName('body');
      if (kind === 'stmt') {
        if (!blk.namedChildren.length) continue;
        return { kind, blocks: [this.body(blk).block], log: this.log };
      }
      let node = null;
      (function find(x) { if (node) return; if (x.type === 'equals_value_clause') node = x.namedChildren[0]; else x.namedChildren.forEach(find); })(blk);
      if (node) return { kind, blocks: [this.ex(node)], log: this.log };
    } finally { tree.delete(); }
  }
  return null;
};

// 置く場所: 選んでいるブロックの下 / 選んでいるクラスやメソッドの中 / 画面の左上
function placeSnippet(r) {
  const sel = Blockly.common.getSelected(), placed = [];
  Blockly.Events.setGroup(true);
  try {
    for (const json of r.blocks) placed.push(Blockly.serialization.blocks.append(json, ws, { recordUndo: true }));
    const first = placed[0], last = b => { while (b.getNextBlock()) b = b.getNextBlock(); return b; };
    let attached = false;
    if (sel && sel.workspace === ws && placed.length === 1 && first.previousConnection) {
      if (r.kind === 'member') {
        const cls = sel.type === 'class_def' ? sel : (() => { let p = sel; while (p && p.type !== 'class_def') p = p.getSurroundParent(); return p; })();
        if (cls) {
          const m = cls.getInputTargetBlock('MEMBERS');
          if (m) last(m).nextConnection.connect(first.previousConnection); else cls.getInput('MEMBERS').connection.connect(first.previousConnection);
          attached = true;
        }
      } else if (r.kind === 'stmt') {
        const body = sel.getInput('BODY') || sel.getInput('DO');
        if (MEMBER_BLOCKS.includes(sel.type) && body && body.type === Blockly.inputs.inputTypes.STATEMENT) {
          const t = body.connection.targetBlock();
          if (t) last(t).nextConnection.connect(first.previousConnection); else body.connection.connect(first.previousConnection);
          attached = true;
        } else if (sel.nextConnection && sel.previousConnection && !MEMBER_BLOCKS.includes(sel.type)) {
          const after = sel.nextConnection.targetBlock();
          sel.nextConnection.connect(first.previousConnection);
          if (after) last(first).nextConnection.connect(after.previousConnection);
          attached = true;
        }
      }
    }
    if (!attached) {
      const view = ws.getMetricsManager().getViewMetrics(true);
      let y = view.top + 40;
      for (const b of placed) { b.moveTo(new Blockly.utils.Coordinate(view.left + 40, y)); y += b.getHeightWidth().height + 24; }
    }
    Blockly.common.setSelected(placed[0]);
  } finally { Blockly.Events.setGroup(false); }
  return placed;
}

function pasteCs(text) {
  if (!tsParser) { showToast(tr('C# パーサーを読み込み中です。少し待ってから再度お試しください'), 3000); return false; }
  const r = Imp.snippet(text);
  if (!r) return false;
  placeSnippet(r);
  update();
  const kinds = { file: ['クラス', 'class'], member: ['メンバー', 'members'], stmt: ['文', 'statements'], expr: ['式', 'an expression'] };
  if (r.log.length) { collect({ log: r.log, notes: [] }, pick(['貼り付け', 'Paste'])); renderLog({ log: r.log, notes: [] }); }
  showToast(pick([`C# (${kinds[r.kind][0]}) をブロックにして貼り付けました`, `Pasted C# (${kinds[r.kind][1]}) as blocks`])
    + (r.log.length ? '\n' + pick([`${r.log.length} か所は専用ブロックがないため「C# 文 / 式」ブロックになりました`, `${r.log.length} places became "C# statement / expression" blocks`]) : ''), 3500);
  return true;
}

document.addEventListener('paste', e => {
  const t = e.target;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || document.querySelector('dialog[open]') || (typeof editor !== 'undefined' && editor.on)) return;
  if (Blockly.WidgetDiv.isVisible() || Blockly.DropDownDiv.isVisible()) return;
  const text = (e.clipboardData && e.clipboardData.getData('text/plain') || '').trim();
  e.preventDefault();
  // 自分でコピーしたブロック (または文字が入っていない) なら、ふつうのブロックの貼り付け
  if (!text || text === (lastCopiedCs || '').trim() || !pasteCs(text)) {
    if (!(copiedBlock && Blockly.clipboard.paste(copiedBlock, ws)) && text) showToast(pick(['クリップボードの内容を C# として読み込めませんでした', 'The clipboard does not contain C# that can be read']), 3000);
  }
});
