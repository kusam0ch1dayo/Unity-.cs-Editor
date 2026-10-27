// エラーチェック (意味チェックと tree-sitter による構文チェック)
// ---------- 意味チェック ----------
// 編集距離 (つづり間違いの候補探し用)
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// いちばん近い名前 (2 文字以内の違いのとき)
function closest(s, list) {
  let best = null, bd = Math.min(3, Math.max(2, Math.floor(s.length / 3) + 1));
  for (const x of new Set(list)) { const d = lev(s.toLowerCase(), x.toLowerCase()); if (x !== s && d < bd) { bd = d; best = x; } }
  return best;
}
// 「〜は定義されていません」の修正候補: 近い名前に直す / フィールドやメソッドを作る
function undefinedFixes(b, path, field, sc) {
  const head = path.split('.')[0], isCall = head.endsWith('()'), name = head.replace('()', ''), fixes = [];
  const names = [...sc.vars.keys(), ...(sc.cls ? Object.keys(classMembers(sc.cls)) : []), ...(isCall ? [] : [...Object.keys(STATICS), ...MODEL.keys()])]
    .filter(n => n.endsWith('()') === isCall).map(n => n.replace('()', ''));
  const near = closest(name, names);
  if (near) fixes.push({ label: `'${near}' に修正`, run: () => b.setFieldValue(f(b, field).replace(new RegExp(`^${name}\\b`), near), field) });
  const cls = sc.cls && ws.getAllBlocks(false).find(x => x.type === 'class_def' && f(x, 'NAME') === sc.cls.name);
  if (cls && path === head) {
    if (isCall) fixes.push({ label: `メソッド '${name}' を作成`, run: () => addMember(cls, b.type === 'start_coroutine'
      ? { type: 'coroutine_def', fields: { NAME: name, PARAMS: '' }, inputs: { BODY: { block: { type: 'yield_null' } } } }
      : { type: 'method_def', fields: { ACCESS: 'private', RET: 'void', NAME: name, PARAMS: '' } }, false) });
    else {
      let t = b.type === 'var_set' ? typeOf(b.getInputTargetBlock('VALUE')) : b.type === 'var_incr' ? 'int' : '?';
      if (!knownType(t) || t === 'null') t = 'float';
      fixes.push({ label: `フィールド '${name}' (${t}) を追加`, run: () => addMember(cls, { type: 'field_def', fields: { ACCESS: 'private', TYPE: t, NAME: name } }, true) });
    }
  }
  return fixes;
}
// クラスにメンバーを追加 (first: 先頭に / それ以外: 末尾に)
function addMember(cls, json, first) {
  const nb = Blockly.serialization.blocks.append(json, ws), input = cls.getInput('MEMBERS').connection;
  let last = input.targetBlock();
  if (first || !last) nb.previousConnection.connect(input);
  else { while (last.getNextBlock()) last = last.getNextBlock(); nb.previousConnection.connect(last.nextConnection); }
  Blockly.common.setSelected(nb);
}
const REQUIRED = { list_add: ['LIST', 'VALUE'], list_remove: ['LIST', 'VALUE'], list_clear: ['LIST'], list_get: ['LIST', 'INDEX'],
  list_set: ['LIST', 'INDEX', 'VALUE'], list_count: ['LIST'], list_contains: ['LIST', 'VALUE'], list_foreach: ['LIST'], var_set: ['VALUE'],
  expr_stmt: ['EXPR'], instantiate: ['PREFAB'], controls_if: ['IF0'], controls_whileUntil: ['BOOL'], logic_compare: ['A', 'B'],
  logic_operation: ['A', 'B'], logic_negate: ['BOOL'], text_concat: ['A', 'B'], list_insert: ['LIST', 'INDEX', 'VALUE'],
  list_index_of: ['LIST', 'VALUE'], list_order: ['LIST'], dict_add: ['LIST', 'KEY', 'VALUE'], dict_contains: ['LIST', 'KEY'], dict_remove: ['LIST', 'KEY'],
  ui_set_text: ['OBJ', 'VALUE'], prop_set: ['OBJ', 'VALUE'], prop_get: ['OBJ'], button_listener: ['OBJ'], audio_play: ['OBJ'], audio_oneshot: ['OBJ', 'CLIP'],
  anim_trigger: ['OBJ'], anim_set: ['OBJ', 'VALUE'], prefs_set: ['VALUE'],
  do_while: ['COND'], is_type: ['VALUE'], as_expr: ['VALUE'], cast_any: ['VALUE'], null_coalesce: ['A', 'B'], button_listener_lambda: ['OBJ', 'FN'],
  instantiate_one: ['PREFAB'], instantiate_rot: ['PREFAB'], string_check: ['VALUE'], parse_num: ['VALUE'], gizmos_color: ['VALUE'],
  switch_stmt: ['VALUE'], set_active: ['BOOL'], load_scene: ['SCENE'], logic_ternary: ['IF', 'THEN', 'ELSE'] };
const MEMBER_BLOCKS = ['field_def', 'property_def', 'property_expr', 'attr', 'comment_member', 'method_def', 'constructor_def', 'coroutine_def', 'unity_event', 'raw_member'];
const lastWarn = new Map();
function check() {
  MODEL = model();
  const out = [];
  const E = (block, msg, fixes) => out.push({ block, level: 'error', msg, fixes }), W = (block, msg, fixes) => out.push({ block, level: 'warn', msg, fixes });
  const name = (b, n) => { const v = f(b, n).trim(); if (!/^[A-Za-z_]\w*$/.test(v)) E(b, `名前 '${v}' は使えません`); return v; };
  const type = (b, t, field) => {
    if (knownType(t)) return;
    const near = field && /^\w+$/.test(t) && closest(t, [...PRIMS, ...UNITY_TYPES, ...MODEL.keys()]);
    E(b, `型 '${t}' が見つかりません`, near && [{ label: `'${near}' に修正`, run: () => b.setFieldValue(near, field) }]);
  };
  const assign = (b, target, vb) => { if (!vb) return; const s = typeOf(vb); if (!assignable(target, s)) E(b, `'${s}' を '${target}' に変換できません`); };
  const want = (b, n, t) => assign(b, t, b.getInputTargetBlock(n));
  const listOf = b => {
    const t = typeOf(b.getInputTargetBlock('LIST'));
    if (t !== '?' && elemOf(t) === '?') E(b, dictOf(t) ? 'Dictionary には辞書用のブロックを使ってください' : `'${t}' は List ではありません`);
    return elemOf(t);
  };
  const listOrDict = b => {
    const t = typeOf(b.getInputTargetBlock('LIST')), d = dictOf(t);
    if (d) return d;
    if (t !== '?' && elemOf(t) === '?') E(b, `'${t}' は List / Dictionary ではありません`);
    return ['int', elemOf(t)];
  };
  const dictOfBlock = b => {
    const t = typeOf(b.getInputTargetBlock('LIST'));
    if (t !== '?' && !dictOf(t)) E(b, `'${t}' は Dictionary ではありません`);
    return dictOf(t) || ['?', '?'];
  };
  const resolved = (b, path, field = 'NAME') => {
    const sc = scopeOf(b), r = resolve(path, sc);
    if (r.err) E(b, r.err, r.err.endsWith('は定義されていません') && b.getField(field) ? undefinedFixes(b, path, field, sc) : undefined);
    else if (r.warn) W(b, r.warn);
    return r;
  };
  const classNames = new Set(); let monos = 0;
  for (const b of ws.getAllBlocks(true)) {
    if (!b.isEnabled() || b.isShadow()) continue;
    if ((REQUIRED[b.type] || []).some(n => !b.getInputTargetBlock(n))) E(b, '空いているスロットにブロックをつないでください');
    const par = b.getSurroundParent();
    if (par && par.type === 'switch_stmt' && !b.outputConnection && !['case_clause', 'default_clause'].includes(b.type)) { E(b, 'switch の中には case / default を置いてください'); continue; }
    if (MEMBER_BLOCKS.includes(b.type)) {
      if (!par || par.type !== 'class_def') { E(b, 'クラスの中に置いてください'); continue; }
    } else if (!['class_def', 'enum_def', 'using_def', 'init_assign', 'switch_arm', 'class_attr'].includes(b.type) && !b.outputConnection && !scopeOf(b).method) {
      E(b, par && par.type === 'class_def' ? 'この文はメソッド (Unityイベント) の中に置いてください' : 'メソッド (Unityイベント) の中に置いてください');
      continue;
    } else if (b.outputConnection && !b.getParent()) { W(b, 'どこにもつながっていない式です'); continue; }

    switch (b.type) {
      case 'class_def': {
        const n = name(b, 'NAME');
        if (classNames.has(n)) E(b, `クラス '${n}' が重複しています`);
        classNames.add(n);
        if (isMono(MODEL.get(n)) && ++monos === 2) W(b, 'Unity では 1 ファイルに MonoBehaviour は 1 つ (ファイル名 = クラス名) にしてください');
        const seen = new Set();
        for (let m = b.getInputTargetBlock('MEMBERS'); m; m = m.getNextBlock()) {
          if (['raw_member', 'attr', 'comment_member'].includes(m.type)) continue;
          const key = m.type === 'unity_event' ? f(m, 'EVENT').split('(')[0]
            : m.type === 'method_def' ? f(m, 'NAME') + '(' + params(f(m, 'PARAMS')).map(p => p[0]).join(',') + ')'
            : m.type === 'constructor_def' ? 'コンストラクター(' + params(f(m, 'PARAMS')).map(p => p[0]).join(',') + ')' : f(m, 'NAME');
          if (seen.has(key)) E(m, `'${key.split('(')[0]}' が重複しています`);
          seen.add(key);
        }
        break;
      }
      case 'field_def': name(b, 'NAME'); type(b, f(b, 'TYPE').trim(), 'TYPE'); want(b, 'VALUE', f(b, 'TYPE').trim()); break;
      case 'method_def': {
        const ret = f(b, 'RET').trim();
        name(b, 'NAME'); type(b, ret, 'RET');
        params(f(b, 'PARAMS')).forEach(([t, n]) => t === '?' ? E(b, `引数 '${n}' の書き方が不正です (例: int a, string b)`) : type(b, t));
        if (ret !== 'void' && !b.getDescendants(false).some(d => (d.type === 'return_stmt' && d.getInputTargetBlock('VALUE')) || d.type.startsWith('yield_')))
          E(b, `'${f(b, 'NAME')}' は ${ret} を return する必要があります`);
        break;
      }
      case 'var_local': {
        const n = name(b, 'NAME'), t = f(b, 'TYPE').trim();
        if (scopeOf(b).vars.has(n)) E(b, `'${n}' は既に定義されています`);
        if (t === 'var') { if (!b.getInputTargetBlock('VALUE')) E(b, 'var には初期値が必要です'); }
        else { type(b, t, 'TYPE'); want(b, 'VALUE', t); }
        break;
      }
      case 'var_set': {
        const r = resolved(b, f(b, 'NAME')), op = f(b, 'OP');
        if (r.err) break;
        if (op === '=') want(b, 'VALUE', r.type);
        else if (r.type === 'bool' || (r.type === 'string' && op !== '+=')) E(b, `'${r.type}' に ${op} は使えません`);
        break;
      }
      case 'var_get': resolved(b, f(b, 'NAME')); break;
      case 'method_call': case 'method_call_expr': resolved(b, f(b, 'NAME') + '()'); break;
      case 'new_object': {
        const n = f(b, 'NAME').trim();
        type(b, n, 'NAME');
        if (isMono(MODEL.get(n))) W(b, 'MonoBehaviour は new できません。AddComponent<T>() を使ってください');
        break;
      }
      case 'return_stmt': {
        const m = scopeOf(b).method, vb = b.getInputTargetBlock('VALUE');
        if (m.ret === 'IEnumerator') E(b, 'コルーチンでは return ではなく yield を使います');
        else if (m.ret === 'void' && vb) E(b, 'void メソッドは値を返せません');
        else if (m.ret !== 'void' && !vb) E(b, `${m.ret} の値を返す必要があります`);
        else assign(b, m.ret, vb);
        break;
      }
      case 'list_new': type(b, f(b, 'TYPE').trim(), 'TYPE'); break;
      case 'get_component': {
        const t = f(b, 'TYPE').trim();
        type(b, t, 'TYPE');
        if (MODEL.has(t) && !isMono(MODEL.get(t))) E(b, `'${t}' はコンポーネントではありません`);
        break;
      }
      case 'list_add': case 'list_contains': want(b, 'VALUE', listOf(b)); break;
      case 'list_set': { const [k, val] = listOrDict(b); want(b, 'VALUE', val); want(b, 'INDEX', k); break; }
      case 'list_get': want(b, 'INDEX', listOrDict(b)[0]); break;
      case 'list_remove': { const el = listOf(b); want(b, 'VALUE', f(b, 'OP') === 'RemoveAt' ? 'int' : el); break; }
      case 'list_clear': case 'list_count': listOrDict(b); break;
      case 'list_foreach': {
        if (dictOf(typeOf(b.getInputTargetBlock('LIST')))) break;
        const el = listOf(b), t = f(b, 'TYPE').trim();
        name(b, 'VAR');
        if (t !== 'var') { type(b, t, 'TYPE'); if (!assignable(t, el)) E(b, `'${el}' を '${t}' に変換できません`); }
        break;
      }
      case 'controls_if': for (let i = 0; b.getInput('IF' + i); i++) want(b, 'IF' + i, 'bool'); break;
      case 'controls_whileUntil': want(b, 'BOOL', 'bool'); break;
      case 'logic_operation': want(b, 'A', 'bool'); want(b, 'B', 'bool'); break;
      case 'logic_negate': want(b, 'BOOL', 'bool'); break;
      case 'controls_repeat_ext': want(b, 'TIMES', 'int'); break;
      case 'for_range': name(b, 'VAR'); want(b, 'FROM', 'int'); want(b, 'TO', 'int'); break;
      case 'math_arithmetic':
        if (f(b, 'OP') !== 'ADD' && ['A', 'B'].some(n => typeOf(b.getInputTargetBlock(n)) === 'string')) E(b, '文字列には + 以外の演算は使えません');
        break;
      case 'transform_set': want(b, 'VALUE', MEMBERS.Transform[f(b, 'PROP')]); break;
      case 'transform_action': if (f(b, 'ACTION') !== 'LookAt') want(b, 'VEC', 'Vector3'); break;
      case 'enum_def': {
        const n = name(b, 'NAME');
        if (classNames.has(n)) E(b, `'${n}' が重複しています`);
        classNames.add(n);
        f(b, 'VALUES').split(',').map(s => s.trim()).filter(Boolean).forEach(s => { if (!/^[A-Za-z_]\w*(\s*=\s*-?\d+)?$/.test(s)) E(b, `値 '${s}' は使えません`); });
        break;
      }
      case 'property_def': name(b, 'NAME'); type(b, f(b, 'TYPE').trim(), 'TYPE'); break;
      case 'constructor_def': case 'coroutine_def':
        if (b.type === 'coroutine_def') {
          name(b, 'NAME');
          if (!b.getDescendants(false).some(d => d.type.startsWith('yield_'))) W(b, 'yield がありません');
        }
        params(f(b, 'PARAMS')).forEach(([t, n]) => t === '?' ? E(b, `引数 '${n}' の書き方が不正です (例: int a, string b)`) : type(b, t));
        break;
      case 'yield_wait': case 'yield_null': case 'yield_until': case 'yield_frame': case 'yield_break':
        if (scopeOf(b).method.ret !== 'IEnumerator') E(b, 'yield はコルーチンの中でのみ使えます');
        if (b.type === 'yield_wait') want(b, 'SEC', 'float');
        if (b.type === 'yield_until') want(b, 'COND', 'bool');
        break;
      case 'start_coroutine': {
        const r = resolved(b, f(b, 'NAME') + '()');
        if (!r.err && r.type !== '?' && r.type !== 'IEnumerator') E(b, `'${f(b, 'NAME')}' はコルーチン (IEnumerator) ではありません`);
        break;
      }
      case 'invoke_stmt': resolved(b, f(b, 'NAME') + '()'); want(b, 'SEC', 'float'); break;
      case 'case_clause': case 'default_clause': if (!par || par.type !== 'switch_stmt') E(b, 'switch の中に置いてください'); break;
      case 'var_incr': {
        const r = resolved(b, f(b, 'NAME'));
        if (!r.err && !['int', 'float', 'double', 'long', '?'].includes(r.type)) E(b, `'${r.type}' に ${f(b, 'OP')} は使えません`);
        break;
      }
      case 'math_func1': want(b, 'X', 'float'); break;
      case 'math_func2': want(b, 'A', 'float'); want(b, 'B', 'float'); break;
      case 'math_func3': ['A', 'B', 'C'].forEach(n => want(b, n, 'float')); break;
      case 'logic_ternary': want(b, 'IF', 'bool'); break;
      case 'vector3_func': want(b, 'A', 'Vector3'); want(b, 'B', 'Vector3'); break;
      case 'vector3_lerp': want(b, 'A', 'Vector3'); want(b, 'B', 'Vector3'); want(b, 'C', 'float'); break;
      case 'quaternion_euler': ['X', 'Y', 'Z'].forEach(n => want(b, n, 'float')); break;
      case 'rb_addforce': want(b, 'RB', 'Rigidbody'); want(b, 'VEC', 'Vector3'); break;
      case 'set_active': want(b, 'OBJ', 'GameObject'); want(b, 'BOOL', 'bool'); break;
      case 'compare_tag': {
        const t = typeOf(b.getInputTargetBlock('OBJ')), mem = membersOf(t);
        if (t !== '?' && mem && !('CompareTag()' in mem)) E(b, `'${t}' に CompareTag はありません`);
        break;
      }
      case 'add_component': {
        const t = f(b, 'TYPE').trim();
        type(b, t, 'TYPE');
        if (MODEL.has(t) && !isMono(MODEL.get(t))) E(b, `'${t}' はコンポーネントではありません`);
        break;
      }
      case 'load_scene': { const t = typeOf(b.getInputTargetBlock('SCENE')); if (!['string', 'int', '?'].includes(t)) E(b, 'シーン名 (string) か番号 (int) を指定してください'); break; }
      case 'destroy': want(b, 'DELAY', 'float'); break;
      case 'class_attr': { const nx = b.getNextBlock(); if (!nx || !['class_def', 'class_attr'].includes(nx.type)) W(b, 'クラス属性の下にクラスをつなげてください'); break; }
      case 'for_step': name(b, 'VAR'); want(b, 'FROM', 'int'); want(b, 'TO', 'int'); break;
      case 'do_while': want(b, 'COND', 'bool'); break;
      case 'try_catch': type(b, f(b, 'TYPE').trim(), 'TYPE'); name(b, 'VAR'); break;
      case 'interp_string':
        for (const m of f(b, 'TEXT').matchAll(/\{([^{}:]+)(?::[^{}]*)?\}/g)) if (/^[A-Za-z_][\w.]*$/.test(m[1].trim())) resolved(b, m[1].trim());
        break;
      case 'string_check': case 'parse_num': want(b, 'VALUE', 'string'); break;
      case 'cast_any': case 'as_expr': case 'is_type': case 'array_init': type(b, f(b, 'TYPE').trim(), 'TYPE'); break;
      case 'vector2_new': want(b, 'X', 'float'); want(b, 'Y', 'float'); break;
      case 'quaternion_lerp': want(b, 'A', 'Quaternion'); want(b, 'B', 'Quaternion'); want(b, 'T', 'float'); break;
      case 'quaternion_look': want(b, 'DIR', 'Vector3'); break;
      case 'quaternion_axis': want(b, 'ANGLE', 'float'); want(b, 'AXIS', 'Vector3'); break;
      case 'color_new': ['R', 'G', 'B', 'A'].forEach(n => want(b, n, 'float')); break;
      case 'instantiate_rot': want(b, 'POS', 'Vector3'); want(b, 'ROT', 'Quaternion'); break;
      case 'try_get_component_if': {
        const t = f(b, 'TYPE').trim();
        type(b, t, 'TYPE'); name(b, 'VAR');
        if (MODEL.has(t) && !isMono(MODEL.get(t))) E(b, `'${t}' はコンポーネントではありません`);
        break;
      }
      case 'raycast2d': want(b, 'DIST', 'float'); want(b, 'LAYER', 'int'); break;
      case 'physics_overlap': want(b, 'R', 'float'); want(b, 'LAYER', 'int'); break;
      case 'rb2d_addforce': want(b, 'RB', 'Rigidbody2D'); want(b, 'VEC', 'Vector2'); break;
      case 'invoke_repeating': resolved(b, f(b, 'NAME') + '()'); want(b, 'DELAY', 'float'); want(b, 'RATE', 'float'); break;
      case 'anim_play': want(b, 'OBJ', 'Animator'); break;
      case 'audio_clip_at_point': want(b, 'CLIP', 'AudioClip'); want(b, 'POS', 'Vector3'); break;
      case 'gizmos_color': want(b, 'VALUE', 'Color'); break;
      case 'gizmos_sphere': want(b, 'CENTER', 'Vector3'); want(b, 'R', 'float'); break;
      case 'gizmos_cube': want(b, 'CENTER', 'Vector3'); want(b, 'SIZE', 'Vector3'); break;
      case 'gizmos_line': want(b, 'A', 'Vector3'); want(b, 'B', 'Vector3'); break;
      case 'draw_line': want(b, 'A', 'Vector3'); want(b, 'B', 'Vector3'); want(b, 'COLOR', 'Color'); break;
      case 'button_listener_lambda': want(b, 'OBJ', 'Button'); break;
      case 'property_expr': name(b, 'NAME'); type(b, f(b, 'TYPE').trim(), 'TYPE'); want(b, 'VALUE', f(b, 'TYPE').trim()); break;
      case 'new_object_init': type(b, f(b, 'NAME').trim(), 'NAME'); break;
      case 'init_assign': {
        if (!par || par.type !== 'new_object_init') { E(b, 'new { } (オブジェクト初期化子) の中に置いてください'); break; }
        const t = f(par, 'NAME').trim(), mem = membersOf(t), n = f(b, 'NAME').trim();
        if (mem && !(n in mem)) (MODEL.has(t) ? E : W)(b, `'${t}' に '${n}' はありません`);
        else if (mem) want(b, 'VALUE', mem[n]);
        break;
      }
      case 'switch_arm': if (!par || par.type !== 'switch_expr') E(b, 'switch 式の中に置いてください'); break;
      case 'tuple_assign': resolved(b, f(b, 'NAME1'), 'NAME1'); resolved(b, f(b, 'NAME2'), 'NAME2'); break;
      case 'array_new': type(b, f(b, 'TYPE').trim(), 'TYPE'); want(b, 'SIZE', 'int'); break;
      case 'generic_call': case 'call_on': {
        const n = f(b, 'NAME').trim(), t = b.getInputTargetBlock('OBJ') ? typeOf(b.getInputTargetBlock('OBJ')) : '?', mem = membersOf(t);
        if (b.type === 'generic_call') {
          type(b, f(b, 'TYPE').trim(), 'TYPE');
          if (/Component/.test(n) && MODEL.has(f(b, 'TYPE').trim()) && !isMono(MODEL.get(f(b, 'TYPE').trim()))) E(b, `'${f(b, 'TYPE').trim()}' はコンポーネントではありません`);
        }
        if (mem && !(n + '()' in mem)) (MODEL.has(t) ? E : W)(b, `'${t}' に ${n} はありません`);
        break;
      }
      case 'raycast_if': name(b, 'HIT'); want(b, 'ORIGIN', 'Vector3'); want(b, 'DIR', 'Vector3'); want(b, 'DIST', 'float'); break;
      case 'raycast_mouse_if': name(b, 'HIT'); want(b, 'DIST', 'float'); break;
      case 'hit_get': { const r = resolved(b, f(b, 'HIT'), 'HIT'); if (!r.err && !['RaycastHit', '?'].includes(r.type)) E(b, `'${f(b, 'HIT')}' は RaycastHit ではありません`); break; }
      case 'draw_ray': want(b, 'ORIGIN', 'Vector3'); want(b, 'DIR', 'Vector3'); want(b, 'COLOR', 'Color'); break;
      case 'ui_set_text': case 'prop_set': case 'prop_get': {
        const t = typeOf(b.getInputTargetBlock('OBJ')), mem = membersOf(t), p = b.type === 'ui_set_text' ? 'text' : f(b, 'PROP').trim();
        if (mem && !(p in mem)) (MODEL.has(t) ? E : W)(b, `'${t}' に '${p}' はありません`);
        else if (mem && b.type !== 'prop_get') want(b, 'VALUE', mem[p]);
        break;
      }
      case 'button_listener': want(b, 'OBJ', 'Button'); resolved(b, f(b, 'NAME') + '()'); break;
      case 'audio_play': want(b, 'OBJ', 'AudioSource'); break;
      case 'audio_oneshot': want(b, 'OBJ', 'AudioSource'); want(b, 'CLIP', 'AudioClip'); break;
      case 'anim_trigger': want(b, 'OBJ', 'Animator'); break;
      case 'anim_set': want(b, 'OBJ', 'Animator'); want(b, 'VALUE', { SetBool: 'bool', SetFloat: 'float', SetInteger: 'int' }[f(b, 'FN')]); break;
      case 'prefs_set': want(b, 'VALUE', { SetInt: 'int', SetFloat: 'float', SetString: 'string' }[f(b, 'FN')]); break;
      case 'prefs_get': want(b, 'DEF', { GetInt: 'int', GetFloat: 'float', GetString: 'string' }[f(b, 'FN')]); break;

      case 'list_insert': want(b, 'VALUE', listOf(b)); want(b, 'INDEX', 'int'); break;
      case 'list_index_of': want(b, 'VALUE', listOf(b)); break;
      case 'list_order': listOf(b); break;
      case 'dict_new': type(b, f(b, 'KEY').trim(), 'KEY'); type(b, f(b, 'VAL').trim(), 'VAL'); break;
      case 'dict_add': { const [k, val] = dictOfBlock(b); want(b, 'KEY', k); want(b, 'VALUE', val); break; }
      case 'dict_contains': case 'dict_remove': want(b, 'KEY', dictOfBlock(b)[0]); break;

      case 'vector3_new': ['X', 'Y', 'Z'].forEach(n => want(b, n, 'float')); break;
      case 'random_range': want(b, 'A', 'float'); want(b, 'B', 'float'); break;
      case 'instantiate': want(b, 'POS', 'Vector3'); break;
    }
  }
  // ブロックに警告アイコンを付ける
  const byBlock = new Map();
  out.forEach(x => byBlock.set(x.block, new Set([...(byBlock.get(x.block) || []), (x.level === 'error' ? '✖ ' : '⚠ ') + x.msg])));
  Blockly.Events.disable();
  try {
    for (const b of ws.getAllBlocks(false)) {
      const t = [...(byBlock.get(b) || [])].join('\n');
      if ((lastWarn.get(b.id) || '') !== t) { b.setWarningText(t || null); lastWarn.set(b.id, t); }
    }
  } finally { Blockly.Events.enable(); }
  return out.filter((x, i) => out.findIndex(y => y.block === x.block && y.msg === x.msg) === i);
}

// ---------- 構文チェック (tree-sitter C# パーサー) ----------
let tsParser = null, tsState = '構文チェッカー読込中…';
// wasm は base64 の JS として同梱 (file:// でも fetch なしで読める)。大きいので画面の表示後に読み込む
const loadScript = src => new Promise((ok, ng) => document.head.appendChild(Object.assign(document.createElement('script'), { src, onload: ok, onerror: ng })));
const fromBase64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const tsReady = (async () => {
  try {
    await Promise.all([loadScript('vendor/tree-sitter/tree-sitter-wasm.js'), loadScript('vendor/tree-sitter/tree-sitter-c_sharp-wasm.js')]);
    const core = fromBase64(TS_WASM.core), csharp = fromBase64(TS_WASM.csharp);
    await TreeSitter.init({ wasmBinary: core });
    const p = new TreeSitter();
    p.setLanguage(await TreeSitter.Language.load(csharp));
    tsParser = p; tsState = '';
  } catch (e) { tsState = '構文チェッカーを読み込めませんでした (意味チェックのみ)'; }
  if (typeof update === 'function') update();
})();
function syntaxErrors(src) {
  if (!tsParser) return [];
  const out = [], tree = tsParser.parse(src);
  (function walk(n) {
    if (n.type === 'ERROR' || n.isMissing()) {
      out.push({ line: n.startPosition.row + 1, level: 'error',
        msg: n.isMissing() ? `構文エラー: '${n.type}' がありません` : `構文エラー: ${src.slice(n.startIndex, n.endIndex).split('\n')[0].trim().slice(0, 40)}` });
    } else if (n.hasError()) for (let i = 0; i < n.childCount; i++) walk(n.child(i));
  })(tree.rootNode);
  tree.delete();
  return out;
}

