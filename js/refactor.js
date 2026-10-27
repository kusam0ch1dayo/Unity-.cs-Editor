// 名前の一括変更 (ブロックを右クリック →「名前を一括変更」または F2)
// 宣言しているブロックと名前のフィールド
const DECL = { field_def: 'NAME', property_def: 'NAME', property_expr: 'NAME', method_def: 'NAME', coroutine_def: 'NAME', class_def: 'NAME', enum_def: 'NAME',
  var_local: 'NAME', list_foreach: 'VAR', for_range: 'VAR', for_step: 'VAR', try_catch: 'VAR', try_get_component_if: 'VAR', raycast_if: 'HIT', raycast_mouse_if: 'HIT' };
// 名前を参照しているフィールド: 先頭が名前のパス / 型名 / C# のコード
const REF_PATH = { var_get: ['NAME'], var_set: ['NAME'], var_incr: ['NAME'], tuple_assign: ['NAME1', 'NAME2'], hit_get: ['HIT'], case_clause: ['VALUE'],
  switch_arm: ['PATTERN'], method_call: ['NAME'], method_call_expr: ['NAME'], start_coroutine: ['NAME'], invoke_stmt: ['NAME'], invoke_repeating: ['NAME'],
  button_listener: ['NAME'] };
const REF_TYPE = { field_def: ['TYPE'], var_local: ['TYPE'], method_def: ['RET', 'PARAMS'], property_def: ['TYPE'], property_expr: ['TYPE'], list_new: ['TYPE'],
  list_foreach: ['TYPE'], dict_new: ['KEY', 'VAL'], get_component: ['TYPE'], add_component: ['TYPE'], new_object: ['NAME'], new_object_init: ['NAME'],
  generic_call: ['TYPE'], array_new: ['TYPE'], array_init: ['TYPE'], cast_any: ['TYPE'], as_expr: ['TYPE'], is_type: ['TYPE'], try_get_component_if: ['TYPE'],
  try_catch: ['TYPE'], class_def: ['BASE'], constructor_def: ['PARAMS'], coroutine_def: ['PARAMS'], lambda_expr: ['PARAMS'], lambda_block: ['PARAMS'] };
const REF_TEXT = { raw_stmt: ['CODE'], raw_expr: ['CODE'], raw_member: ['CODE'], interp_string: ['TEXT'], method_call: ['ARGS'], method_call_expr: ['ARGS'],
  new_object: ['ARGS'], new_object_init: ['ARGS'], call_on: ['ARGS'], generic_call: ['ARGS'], start_coroutine: ['ARGS'], array_init: ['ITEMS'],
  attr: ['CODE'], class_attr: ['CODE'] };
const SCOPE_OWNERS = ['method_def', 'unity_event', 'coroutine_def', 'constructor_def', 'lambda_block', 'property_expr'];

// その名前が使える範囲のブロック
function declScope(decl) {
  if (['class_def', 'enum_def'].includes(decl.type)) return ws.getAllBlocks(false);
  if (decl.type === 'var_local') {
    let p = decl.getSurroundParent();
    while (p && !SCOPE_OWNERS.includes(p.type)) p = p.getSurroundParent();
    return (p || decl).getDescendants(false);
  }
  if (['list_foreach', 'for_range', 'for_step', 'try_catch', 'try_get_component_if', 'raycast_if', 'raycast_mouse_if'].includes(decl.type)) return decl.getDescendants(false);
  const cls = decl.getSurroundParent();
  return cls ? cls.getDescendants(false) : ws.getAllBlocks(false);
}
// 参照しているブロックから宣言を探す (いちばん内側の宣言)
function findDecl(block) {
  const field = (REF_PATH[block.type] || [])[0];
  if (!field) return null;
  let name = f(block, field).split('.')[0].replace('()', '');
  if (name === 'this') name = f(block, field).split('.')[1] || '';
  const found = ws.getAllBlocks(false).filter(d => DECL[d.type] && f(d, DECL[d.type]).trim() === name && declScope(d).includes(block));
  return found.sort((a, b) => declScope(a).length - declScope(b).length)[0] || null;
}
function renameSymbol(decl) {
  const field = DECL[decl.type], old = f(decl, field).trim();
  Blockly.dialog.prompt(`新しい名前 (「${old}」を使っている場所もすべて変わります)`, old, name => {
    if (!name || (name = name.trim()) === old) return;
    if (!/^[A-Za-z_]\w*$/.test(name)) { Blockly.dialog.alert(`名前「${name}」は使えません`); return; }
    const isType = ['class_def', 'enum_def'].includes(decl.type), word = new RegExp(`\\b${old}\\b`, 'g');
    // 文字列 ("...") の中は変えない
    const inCode = s => s.split(/("(?:\\.|[^"\\])*")/).map((part, i) => i % 2 ? part : part.replace(word, name)).join('');
    const path = s => {
      const seg = s.split('.');
      if (seg[0].replace('()', '') === old) seg[0] = seg[0].replace(old, name);
      else if (seg[0] === 'this' && seg[1] === old) seg[1] = name;
      return seg.join('.');
    };
    let count = 0;
    Blockly.Events.setGroup(true);
    try {
      decl.setFieldValue(name, field);
      for (const b of declScope(decl)) {
        const set = (fl, fn) => { const v = b.getFieldValue(fl); if (v == null) return; const nv = fn(v); if (nv !== v) { b.setFieldValue(nv, fl); count++; } };
        (REF_PATH[b.type] || []).forEach(fl => set(fl, path));
        if (isType) (REF_TYPE[b.type] || []).forEach(fl => set(fl, inCode));
        (REF_TEXT[b.type] || []).forEach(fl => set(fl, b.type === 'interp_string' ? s => s.replace(/\{[^}]*\}/g, inCode) : inCode));
      }
    } finally { Blockly.Events.setGroup(false); }
    showToast(`「${old}」→「${name}」に変更しました (参照 ${count} か所)\n(取り消しで元に戻せます)`);
  });
}
const renameTarget = b => b && !b.isInFlyout ? (DECL[b.type] ? b : findDecl(b)) : null;
Blockly.ContextMenuRegistry.registry.register({
  id: 'ubc_rename', weight: -1, scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
  displayText: () => '名前を一括変更… (F2)',
  preconditionFn: s => renameTarget(s.block) ? 'enabled' : 'hidden',
  callback: s => renameSymbol(renameTarget(s.block)),
});
window.addEventListener('keydown', e => {
  if (e.key !== 'F2' || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const t = renameTarget(Blockly.common.getSelected());
  if (t) { e.preventDefault(); renameSymbol(t); }
});
