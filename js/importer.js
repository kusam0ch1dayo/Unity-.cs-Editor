// C# → ブロック (読み込み) と読み込みログの記録
// ---------- C# → ブロック (読み込み) ----------
const AUTO_USINGS = ['System.Collections', 'System.Collections.Generic', 'UnityEngine', 'UnityEngine.SceneManagement', 'UnityEngine.UI', 'TMPro'];
const CHECKS = {};
function checksOf(type) {
  if (!CHECKS[type]) {
    const tmp = new Blockly.Workspace(), b = tmp.newBlock(type);
    CHECKS[type] = { out: b.outputConnection ? b.outputConnection.getCheck() : null,
      inputs: Object.fromEntries(b.inputList.filter(i => i.connection).map(i => [i.name, i.connection.getCheck()])) };
    tmp.dispose();
  }
  return CHECKS[type];
}
const Imp = {
  run(src) {
    this.src = src; this.log = []; this.seq = 0; this.notes = new Set();
    const tree = tsParser.parse(src), tops = [];
    if (tree.rootNode.hasError()) this.notes.add('入力に構文エラーがあります (その部分は「C# 文」ブロックになります)');
    this.top(tree.rootNode, tops);
    let comments = 0;
    (function w(x) { if (x.type === 'comment') comments++; else x.namedChildren.forEach(w); })(tree.rootNode);
    if (comments) this.notes.add(`コメント ${comments} 件は省略しました (ブロックにはコメントを残せません)`);
    tree.delete();
    return tops;
  },
  t(n) { return n ? this.src.slice(n.startIndex, n.endIndex) : ''; },
  // コメントを除いて 1 行にまとめる
  flat(n) {
    let s = this.t(n);
    const cm = [];
    (function w(x) { if (x.type === 'comment') cm.push(x); else x.namedChildren.forEach(w); })(n);
    for (const c of cm.reverse()) s = s.slice(0, c.startIndex - n.startIndex) + s.slice(c.endIndex - n.startIndex);
    return s.replace(/\s*\n\s*/g, ' ').trim();
  },
  B(type, fields = {}, inputs = {}, extraState) {
    for (const k in inputs) if (!inputs[k]) delete inputs[k];
    const b = { type, fields, inputs };
    if (extraState) b.extraState = extraState;
    return b;
  },
  chain(list) {
    list = list.filter(Boolean);
    for (let i = list.length - 2; i >= 0; i--) list[i].next = { block: list[i + 1] };
    return list.length ? { block: list[0] } : null;
  },
  // 代用ブロックに置き換えた箇所を記録 (読み込みログ用)
  raw(n, type, why) {
    const id = `imp${++this.seq}_${Date.now().toString(36)}`, code = this.flat(n);
    this.log.push({ id, type, line: n.startPosition.row + 1, need: why || this.need(n),
      code: code.length > 90 ? code.slice(0, 90) + '…' : code, full: code.length > 400 ? code.slice(0, 400) + ' …' : code });
    const b = this.B(type, { CODE: code });
    b.id = id;
    return b;
  },
  dropLog(b) {
    const ids = new Set();
    (function w(x) { if (!x) return; if (x.id) ids.add(x.id); Object.values(x.inputs || {}).forEach(i => w(i.block)); if (x.next) w(x.next.block); })(b);
    this.log = this.log.filter(e => !ids.has(e.id));
  },
  // その構文を表すのに足りないブロックの名前
  need(n) {
    const t = n.type, txt = this.flat(n), mods = this.mods(n);
    const attrs = this.attrs(n).map(a => `[${(a.match(/^\[\s*([\w.]+)/) || [, '?'])[1]}]`).join(' ');
    const NAMES = {
      do_statement: 'do-while 文', try_statement: 'try / catch 文', throw_statement: 'throw 文', using_statement: 'using 文', lock_statement: 'lock 文',
      local_function_statement: 'ローカル関数', goto_statement: 'goto 文', checked_statement: 'checked 文', labeled_statement: 'ラベル付き文',
      lambda_expression: 'ラムダ式 (=>)', interpolated_string_expression: '文字列補間 $"..."', array_creation_expression: '配列の生成 new T[]',
      implicit_array_creation_expression: '配列の生成 new[] { }', typeof_expression: 'typeof()', is_pattern_expression: 'is 型判定', is_expression: 'is 型判定',
      as_expression: 'as キャスト', await_expression: 'await', conditional_access_expression: '?. 演算子', character_literal: "文字リテラル 'a'",
      default_expression: 'default 式', query_expression: 'LINQ クエリ式', tuple_expression: 'タプル', switch_expression: 'switch 式',
      verbatim_string_literal: '逐語的文字列 @"..."', anonymous_object_creation_expression: '匿名型 new { }', base_expression: 'base 参照',
      struct_declaration: '構造体 struct', interface_declaration: 'インターフェース', delegate_declaration: 'デリゲート', event_field_declaration: 'event',
      event_declaration: 'event', class_declaration: '入れ子のクラス', enum_declaration: '入れ子の enum', indexer_declaration: 'インデクサー',
      operator_declaration: '演算子オーバーロード', destructor_declaration: 'デストラクター', ERROR: '構文エラーの部分',
    };
    if (NAMES[t]) return NAMES[t];
    const body = n.childForFieldName && n.childForFieldName('body');
    switch (t) {
      case 'expression_statement': return n.namedChildren[0] ? this.need(n.namedChildren[0]) : '空の文';
      case 'field_declaration': return attrs ? `属性付きフィールド ${attrs}` : `修飾子 '${mods}' のフィールド`;
      case 'property_declaration': return attrs ? `属性付きプロパティ ${attrs}` : 'プロパティ (get/set の本体・初期値・修飾子付き)';
      case 'method_declaration':
        return attrs ? `属性付きメソッド ${attrs}` : !body || body.type !== 'block' ? '式形式メソッド (=>)'
          : n.childForFieldName('type_parameters') ? 'ジェネリックメソッド' : `修飾子 '${mods}' のメソッド`;
      case 'constructor_declaration': return 'コンストラクター (public 以外 / base・this 呼び出し / 属性付き)';
      case 'for_statement': return 'for 文 (int i = a; i < b; i++ 以外の形)';
      case 'switch_statement': return 'switch 文 (複数ラベル / パターン)';
      case 'yield_statement': return /^yield\s+break/.test(txt) ? 'yield break' : 'yield return (WaitForSeconds / null 以外)';
      case 'local_declaration_statement': return /^const\b/.test(txt) ? 'const ローカル定数' : /^using\b/.test(txt) ? 'using 宣言' : 'ローカル変数宣言 (特殊な形)';
      case 'invocation_expression': return 'メソッドチェーン / 式の結果に対する呼び出し';
      case 'assignment_expression': return `代入 (演算子 '${this.t(n.namedChildren.find(c => c.type === 'assignment_operator') || n.child(1))}' / 左辺が複雑)`;
      case 'binary_expression': return `演算子 '${n.child(1).type}'`;
      case 'prefix_unary_expression': case 'postfix_unary_expression': return `単項演算子 '${(txt.match(/\+\+|--|^[-+!~]/) || [''])[0]}'`;
      case 'cast_expression': return `キャスト (${this.t(n.childForFieldName('type'))})`;
      case 'object_creation_expression': return 'オブジェクト初期化子 new T { ... }';
      case 'integer_literal': case 'real_literal': return '小数点のない float などの数値リテラル (例: 5f)';
      case 'string_literal': return '特殊な文字列リテラル';
      case 'element_access_expression': return '多次元の要素アクセス [a, b]';
    }
    return `未対応の構文 (${t})`;
  },
  fit(ptype, input, b, n) {
    const want = checksOf(ptype).inputs[input] ?? checksOf(ptype).inputs[input.replace(/\d+$/, '0')], have = checksOf(b.type).out;
    if (!want || !have || have.some(c => want.includes(c))) return { block: b };
    this.dropLog(b);
    return { block: this.raw(n, 'raw_expr', `「${ptype}」の ${input} に入れられる形のブロック (型が合わない値)`) };
  },
  val(ptype, input, n) { return n ? this.fit(ptype, input, this.ex(n), n) : null; },
  str(n) {
    if (!n || n.type !== 'string_literal' || this.t(n)[0] !== '"') return null;
    try { return JSON.parse(this.t(n).replace(/\\'/g, "'")); } catch (e) { return null; }
  },
  path(n) {
    if (!n) return null;
    if (['identifier', 'this_expression', 'predefined_type'].includes(n.type)) return this.t(n);
    if (n.type !== 'member_access_expression') return null;
    const e = this.path(n.childForFieldName('expression')), nm = n.childForFieldName('name');
    return e && nm && nm.type === 'identifier' ? e + '.' + this.t(nm) : null;
  },
  args(inv) {
    const al = inv.childForFieldName('arguments');
    if (!al) return null;
    const a = al.namedChildren.filter(c => c.type === 'argument');
    return a.some(x => x.namedChildren.length !== 1 || /^(out|ref|in)\b/.test(this.t(x))) ? null : a.map(x => x.namedChildren[0]);
  },
  argText(inv) { const al = inv.childForFieldName('arguments'); return al ? this.flat(al).slice(1, -1).trim() : ''; },
  generic(fn) {
    if (fn.type === 'generic_name') return { target: null, g: fn };
    const nm = fn.type === 'member_access_expression' && fn.childForFieldName('name');
    return nm && nm.type === 'generic_name' ? { target: fn.childForFieldName('expression'), g: nm } : null;
  },
  params(m) { return this.flat(m.childForFieldName('parameters')).slice(1, -1).trim().replace(/\s+/g, ' '); },
  mods(n) { return n.namedChildren.filter(c => c.type === 'modifier').map(c => this.t(c)).join(' '); },
  attrs(n) { return n.namedChildren.filter(c => c.type === 'attribute_list').map(c => this.flat(c)); },
  decls(d) {
    return d.namedChildren.filter(c => c.type === 'variable_declarator').map(v => {
      const eq = v.namedChildren.find(c => c.type === 'equals_value_clause');
      return [this.t(d.childForFieldName('type')), this.t(v.namedChildren[0]), eq ? eq.namedChildren[0] : null];
    });
  },

  top(n, out) {
    for (const c of n.namedChildren) {
      if (c.type === 'using_directive') {
        const ns = this.flat(c).replace(/^using\s+|\s*;$/g, '');
        if (!AUTO_USINGS.includes(ns)) out.push(this.B('using_def', { NS: ns }));
      } else if (/namespace_declaration$/.test(c.type)) {
        this.notes.add('namespace は省略しました');
        this.top(c.childForFieldName('body') || c, out);
      } else if (c.type === 'class_declaration') out.push(this.cls(c));
      else if (c.type === 'enum_declaration') {
        const body = c.childForFieldName('body');
        out.push(this.B('enum_def', { NAME: this.t(c.childForFieldName('name')),
          VALUES: body.namedChildren.filter(m => m.type === 'enum_member_declaration').map(m => this.flat(m)).join(', ') }));
      } else if (!['comment', 'identifier', 'qualified_name', 'declaration_list'].includes(c.type)) this.notes.add(`読み込めない部分を省略しました: ${this.flat(c).slice(0, 40)}`);
    }
  },
  cls(n) {
    const attrs = this.attrs(n), mods = this.mods(n), bases = n.childForFieldName('bases'), body = n.childForFieldName('body');
    attrs.filter(a => !/\bSerializable\b/.test(a)).forEach(a => this.notes.add(`属性 ${a} は省略しました`));
    if (mods && !['public', 'internal'].includes(mods)) this.notes.add(`クラス修飾子 '${mods}' は省略しました`);
    if (n.childForFieldName('type_parameters')) this.notes.add('ジェネリッククラスの型引数は省略しました');
    return this.B('class_def', {
      SER: attrs.some(a => /\bSerializable\b/.test(a)), ACCESS: mods.includes('public') ? 'public' : 'internal',
      NAME: this.t(n.childForFieldName('name')), BASE: bases ? this.flat(bases).replace(/^:\s*/, '') : '',
    }, { MEMBERS: this.chain(body ? body.namedChildren.flatMap(m => this.member(m)) : []) });
  },
  member(m) {
    const attrs = this.attrs(m), mods = this.mods(m);
    switch (m.type) {
      case 'comment': return [];
      case 'field_declaration': {
        const ser = attrs.length === 1 && /^\[\s*SerializeField\s*\]$/.test(attrs[0]);
        const access = ser ? '[SerializeField]' + (mods ? ' ' + mods : '') : mods || 'none';
        if ((attrs.length && !ser) || !ACCESS.some(a => a[1] === access)) break;
        return this.decls(m.namedChildren.find(c => c.type === 'variable_declaration')).map(([type, name, init]) =>
          this.B('field_def', { ACCESS: access, TYPE: type, NAME: name }, { VALUE: this.val('field_def', 'VALUE', init) }));
      }
      case 'property_declaration': {
        const arrow = m.childForFieldName('value');
        if (arrow && arrow.type === 'arrow_expression_clause' && !attrs.length && PROP_ACCESS.includes(mods || 'none'))
          return [this.B('property_expr', { ACCESS: mods || 'none', TYPE: this.t(m.childForFieldName('type')), NAME: this.t(m.childForFieldName('name')) },
            { VALUE: this.val('property_expr', 'VALUE', arrow.namedChildren[0]) })];
        const acc = m.childForFieldName('accessors'), inner = acc ? this.flat(acc).replace(/^\{|\}$/g, '').trim().replace(/\s+/g, ' ') : '';
        if (attrs.length || !PROP_ACCESS.includes(mods || 'none') || !['get; set;', 'get; private set;', 'get;'].includes(inner)
            || m.namedChildren.some(c => c.type === 'equals_value_clause')) break;
        return [this.B('property_def', { ACCESS: mods || 'none', TYPE: this.t(m.childForFieldName('type')), NAME: this.t(m.childForFieldName('name')), ACC: inner })];
      }
      case 'constructor_declaration': {
        const body = m.childForFieldName('body');
        if (attrs.length || mods !== 'public' || !body || m.namedChildren.some(c => c.type === 'constructor_initializer')) break;
        return [this.B('constructor_def', { PARAMS: this.params(m) }, { BODY: this.body(body) })];
      }
      case 'method_declaration': {
        const body = m.childForFieldName('body');
        if (attrs.length || !body || body.type !== 'block' || m.childForFieldName('type_parameters')) break;
        const name = this.t(m.childForFieldName('name')), ret = this.t(m.childForFieldName('type')), ps = this.params(m), acc = mods || 'none';
        if (ret === 'void' && ['none', 'private'].includes(acc) && EVENTS.includes(`${name}(${ps})`)) return [this.B('unity_event', { EVENT: `${name}(${ps})` }, { BODY: this.body(body) })];
        if (ret === 'IEnumerator' && ['none', 'private'].includes(acc)) return [this.B('coroutine_def', { NAME: name, PARAMS: ps }, { BODY: this.body(body) })];
        if (!METHOD_ACCESS.includes(acc)) break;
        return [this.B('method_def', { ACCESS: acc, RET: ret, NAME: name, PARAMS: ps }, { BODY: this.body(body) })];
      }
    }
    return [this.raw(m, 'raw_member')];
  },
  body(n) { return n ? this.chain(n.type === 'block' ? n.namedChildren.flatMap(c => this.st(c)) : this.st(n)) : null; },

  st(n) {
    switch (n.type) {
      case 'comment': return [];
      case 'block': return n.namedChildren.flatMap(c => this.st(c));
      case 'local_declaration_statement': {
        const d = n.namedChildren.find(c => c.type === 'variable_declaration');
        if (!d || n.namedChildren.some(c => c.type === 'modifier') || /^(using|const)\b/.test(this.t(n))) break;
        return this.decls(d).map(([type, name, init]) => this.B('var_local', { TYPE: type, NAME: name }, { VALUE: this.val('var_local', 'VALUE', init) }));
      }
      case 'expression_statement': { const b = this.exprStmt(n.namedChildren[0]); if (b) return [b]; break; }
      case 'if_statement': return [this.ifSt(n)];
      case 'for_statement': {
        const init = n.childForFieldName('initializer'), cond = n.childForFieldName('condition'), upd = n.childForFieldName('update');
        const d = init && init.type === 'variable_declaration' && this.decls(init);
        if (d && d.length === 1 && d[0][0] === 'int' && d[0][2] && cond && cond.type === 'binary_expression' && cond.child(1).type === '<'
            && this.t(cond.childForFieldName('left')) === d[0][1] && upd && this.t(upd).replace(/\s/g, '') === d[0][1] + '++')
          return [this.B('for_range', { VAR: d[0][1] }, { FROM: this.val('for_range', 'FROM', d[0][2]), TO: this.val('for_range', 'TO', cond.childForFieldName('right')),
            DO: this.body(n.childForFieldName('body')) })];
        break;
      }
      case 'for_each_statement':
        return [this.B('list_foreach', { TYPE: this.t(n.childForFieldName('type')), VAR: this.t(n.childForFieldName('left')) },
          { LIST: this.val('list_foreach', 'LIST', n.childForFieldName('right')), DO: this.body(n.childForFieldName('body')) })];
      case 'while_statement':
        return [this.B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: this.val('controls_whileUntil', 'BOOL', n.childForFieldName('condition') || n.namedChildren[0]),
          DO: this.body(n.childForFieldName('body') || n.namedChildren[1]) })];
      case 'switch_statement': {
        const cases = [], mark = this.log.length;
        for (const sec of n.childForFieldName('body').namedChildren.filter(c => c.type === 'switch_section')) {
          const labels = sec.namedChildren.filter(c => /switch_label$/.test(c.type)), stmts = sec.namedChildren.filter(c => !/switch_label$/.test(c.type));
          if (labels.length !== 1 || !['case_switch_label', 'default_switch_label'].includes(labels[0].type)) { this.log.length = mark; return [this.raw(n, 'raw_stmt')]; }
          if (stmts.length && stmts[stmts.length - 1].type === 'break_statement') stmts.pop();
          const DO = this.chain(stmts.flatMap(s => this.st(s)));
          cases.push(labels[0].type === 'default_switch_label' ? this.B('default_clause', {}, { DO })
            : this.B('case_clause', { VALUE: this.flat(labels[0]).replace(/^case\s+|\s*:$/g, '') }, { DO }));
        }
        return [this.B('switch_stmt', {}, { VALUE: this.val('switch_stmt', 'VALUE', n.childForFieldName('value')), CASES: this.chain(cases) })];
      }
      case 'return_statement': return [this.B('return_stmt', {}, { VALUE: this.val('return_stmt', 'VALUE', n.namedChildren[0]) })];
      case 'break_statement': return [this.B('controls_flow_statements', { FLOW: 'BREAK' })];
      case 'continue_statement': return [this.B('controls_flow_statements', { FLOW: 'CONTINUE' })];
      case 'yield_statement': {
        const x = n.namedChildren[0];
        if (x && x.type === 'null_literal') return [this.B('yield_null')];
        if (x && x.type === 'object_creation_expression' && this.t(x.childForFieldName('type')) === 'WaitForSeconds') {
          const a = this.args(x);
          if (a && a.length === 1) return [this.B('yield_wait', {}, { SEC: this.val('yield_wait', 'SEC', a[0]) })];
        }
        break;
      }
    }
    return [this.raw(n, 'raw_stmt')];
  },
  ifSt(n) {
    const conds = [], bodies = [];
    let cur = n;
    while (cur && cur.type === 'if_statement') { conds.push(cur.childForFieldName('condition')); bodies.push(cur.childForFieldName('consequence')); cur = cur.childForFieldName('alternative'); }
    if (conds.length === 1 && !cur) { const rc = this.raycast(conds[0], bodies[0]); if (rc) return rc; }
    const inputs = {};
    conds.forEach((c, i) => { inputs['IF' + i] = this.val('controls_if', 'IF' + i, c); inputs['DO' + i] = this.body(bodies[i]); });
    if (cur) inputs.ELSE = this.body(cur);
    return this.B('controls_if', {}, inputs, conds.length > 1 || cur ? { elseIfCount: conds.length - 1, hasElse: !!cur } : undefined);
  },
  raycast(cond, body) {
    if (cond.type !== 'invocation_expression' || this.path(cond.childForFieldName('function')) !== 'Physics.Raycast') return null;
    const a = cond.childForFieldName('arguments').namedChildren.filter(c => c.type === 'argument'), e = x => x.namedChildren[x.namedChildren.length - 1];
    const hit = x => (this.flat(x).match(/^out\s+RaycastHit\s+(\w+)$/) || [])[1];
    if (a.length === 4 && hit(a[2]) && a.slice(0, 2).concat(a[3]).every(x => x.namedChildren.length === 1))
      return this.B('raycast_if', { HIT: hit(a[2]) }, { ORIGIN: this.val('raycast_if', 'ORIGIN', e(a[0])), DIR: this.val('raycast_if', 'DIR', e(a[1])),
        DIST: this.val('raycast_if', 'DIST', e(a[3])), DO: this.body(body) });
    if (a.length === 3 && this.flat(a[0]).replace(/\s/g, '') === 'Camera.main.ScreenPointToRay(Input.mousePosition)' && hit(a[1]))
      return this.B('raycast_mouse_if', { HIT: hit(a[1]) }, { DIST: this.val('raycast_mouse_if', 'DIST', e(a[2])), DO: this.body(body) });
    return null;
  },
  exprStmt(e) {
    if (!e) return null;
    if (e.type === 'assignment_expression') {
      const L = e.childForFieldName('left'), R = e.childForFieldName('right');
      const op = this.t(e.namedChildren.find(c => c.type === 'assignment_operator') || e.child(1)), lp = this.path(L);
      let m;
      if (lp && op === '=' && (m = lp.match(/^transform\.(position|localPosition|localScale|eulerAngles)$/)))
        return this.B('transform_set', { PROP: m[1] }, { VALUE: this.val('transform_set', 'VALUE', R) });
      if (lp && op === '=' && (m = lp.match(/^(.+)\.text$/)))
        return this.B('ui_set_text', {}, { OBJ: { block: this.pathBlock(m[1]) }, VALUE: this.val('ui_set_text', 'VALUE', R) });
      if (lp && ['=', '+=', '-=', '*=', '/='].includes(op)) return this.B('var_set', { NAME: lp, OP: op }, { VALUE: this.val('var_set', 'VALUE', R) });
      if (op !== '=') return null;
      if (L.type === 'tuple_expression') {
        const names = L.namedChildren.filter(c => c.type === 'argument').map(a => a.namedChildren.length === 1 && this.path(a.namedChildren[0]));
        if (names.length === 2 && names.every(Boolean)) return this.B('tuple_assign', { NAME1: names[0], NAME2: names[1] }, { VALUE: this.val('tuple_assign', 'VALUE', R) });
      }
      if (L.type === 'element_access_expression') {
        const a = L.childForFieldName('subscript').namedChildren.filter(c => c.type === 'argument');
        if (a.length === 1) return this.B('list_set', {}, { LIST: this.val('list_set', 'LIST', L.childForFieldName('expression')),
          INDEX: this.val('list_set', 'INDEX', a[0].namedChildren[0]), VALUE: this.val('list_set', 'VALUE', R) });
      }
      if (L.type === 'member_access_expression' && L.childForFieldName('name').type === 'identifier')
        return this.B('prop_set', { PROP: this.t(L.childForFieldName('name')) }, { OBJ: this.val('prop_set', 'OBJ', L.childForFieldName('expression')),
          VALUE: this.val('prop_set', 'VALUE', R) });
      return null;
    }
    if (/unary_expression$/.test(e.type)) {
      const p = this.path(e.namedChildren[0]), op = (this.t(e).match(/\+\+|--/) || [])[0];
      return p && op ? this.B('var_incr', { NAME: p, OP: op }) : null;
    }
    if (e.type === 'invocation_expression') return this.callStmt(e);
    return null;
  },
  callStmt(e) {
    const fn = e.childForFieldName('function'), a = this.args(e), k = a ? a.length : -1, fp = this.path(fn), V = (t, i, n) => this.val(t, i, n);
    let m;
    if (fp && a) {
      if ((m = fp.match(/^Debug\.(Log|LogWarning|LogError)$/)) && k === 1) return this.B('debug_log', { LEVEL: m[1] }, { MSG: V('debug_log', 'MSG', a[0]) });
      if ((m = fp.match(/^transform\.(Translate|Rotate|LookAt)$/)) && k === 1) return this.B('transform_action', { ACTION: m[1] }, { VEC: V('transform_action', 'VEC', a[0]) });
      if (fp === 'Destroy' && (k === 1 || k === 2)) return this.B('destroy', {}, { OBJ: V('destroy', 'OBJ', a[0]), DELAY: V('destroy', 'DELAY', a[1]) });
      if (fp === 'StartCoroutine' && k === 1 && a[0].type === 'invocation_expression') {
        const inner = this.path(a[0].childForFieldName('function'));
        if (inner && /^\w+$/.test(inner) && !this.argText(a[0])) return this.B('start_coroutine', { NAME: inner });
      }
      if (fp === 'Invoke' && k === 2 && this.str(a[0]) !== null) return this.B('invoke_stmt', { NAME: this.str(a[0]) }, { SEC: V('invoke_stmt', 'SEC', a[1]) });
      if (fp === 'SceneManager.LoadScene' && k === 1) return this.B('load_scene', {}, { SCENE: V('load_scene', 'SCENE', a[0]) });
      if ((m = fp.match(/^PlayerPrefs\.(SetInt|SetFloat|SetString)$/)) && k === 2 && this.str(a[0]) !== null)
        return this.B('prefs_set', { FN: m[1], KEY: this.str(a[0]) }, { VALUE: V('prefs_set', 'VALUE', a[1]) });
      if (fp === 'PlayerPrefs.Save' && k === 0) return this.B('prefs_save');
      if (fp === 'Application.Quit' && k === 0) return this.B('app_quit');
      if (fp === 'Debug.DrawRay' && k === 3) return this.B('draw_ray', {}, { ORIGIN: V('draw_ray', 'ORIGIN', a[0]), DIR: V('draw_ray', 'DIR', a[1]), COLOR: V('draw_ray', 'COLOR', a[2]) });
    }
    if (fn.type === 'member_access_expression' && a) {
      const tgt = fn.childForFieldName('expression'), nm = this.t(fn.childForFieldName('name'));
      const on = (type, inp = 'OBJ') => ({ [inp]: V(type, inp, tgt) });
      switch (nm) {
        case 'Add':
          if (k === 1) return this.B('list_add', {}, { ...on('list_add', 'LIST'), VALUE: V('list_add', 'VALUE', a[0]) });
          if (k === 2) return this.B('dict_add', {}, { ...on('dict_add', 'LIST'), KEY: V('dict_add', 'KEY', a[0]), VALUE: V('dict_add', 'VALUE', a[1]) });
          break;
        case 'Remove': case 'RemoveAt':
          if (k === 1) return this.B('list_remove', { OP: nm }, { ...on('list_remove', 'LIST'), VALUE: V('list_remove', 'VALUE', a[0]) });
          break;
        case 'Clear': if (k === 0) return this.B('list_clear', {}, on('list_clear', 'LIST')); break;
        case 'Insert': if (k === 2) return this.B('list_insert', {}, { ...on('list_insert', 'LIST'), INDEX: V('list_insert', 'INDEX', a[0]), VALUE: V('list_insert', 'VALUE', a[1]) }); break;
        case 'Sort': case 'Reverse': if (k === 0) return this.B('list_order', { OP: nm }, on('list_order', 'LIST')); break;
        case 'SetActive': if (k === 1) return this.B('set_active', {}, { ...on('set_active'), BOOL: V('set_active', 'BOOL', a[0]) }); break;
        case 'AddForce': {
          const fm = k === 2 && (this.t(a[1]).match(/^ForceMode\.(Force|Impulse|VelocityChange|Acceleration)$/) || [])[1];
          if (fm) return this.B('rb_addforce', { MODE: fm || 'Force' }, { ...on('rb_addforce', 'RB'), VEC: V('rb_addforce', 'VEC', a[0]) });
          break;
        }
        case 'Play': case 'Stop': case 'Pause': case 'UnPause': if (k === 0) return this.B('audio_play', { FN: nm }, on('audio_play')); break;
        case 'PlayOneShot': if (k === 1) return this.B('audio_oneshot', {}, { ...on('audio_oneshot'), CLIP: V('audio_oneshot', 'CLIP', a[0]) }); break;
        case 'SetTrigger': if (k === 1 && this.str(a[0]) !== null) return this.B('anim_trigger', { NAME: this.str(a[0]) }, on('anim_trigger')); break;
        case 'SetBool': case 'SetFloat': case 'SetInteger':
          if (k === 2 && this.str(a[0]) !== null) return this.B('anim_set', { FN: nm, NAME: this.str(a[0]) }, { ...on('anim_set'), VALUE: V('anim_set', 'VALUE', a[1]) });
          break;
        case 'AddListener':
          if (k === 1 && tgt.type === 'member_access_expression' && this.t(tgt.childForFieldName('name')) === 'onClick' && /^\w+$/.test(this.t(a[0])))
            return this.B('button_listener', { NAME: this.t(a[0]) }, { OBJ: V('button_listener', 'OBJ', tgt.childForFieldName('expression')) });
          break;
      }
    }
    if (fp) return this.B('method_call', { NAME: fp, ARGS: this.argText(e) });
    const x = this.callExpr(e);
    return x ? this.B('expr_stmt', {}, { EXPR: { block: x } }) : null;
  },
  pathBlock(p) {
    let m;
    if ((m = p.match(/^Time\.(deltaTime|time|fixedDeltaTime|timeScale|unscaledDeltaTime)$/))) return this.B('time_value', { PROP: m[1] });
    if ((m = p.match(/^Vector3\.(zero|one|up|down|left|right|forward|back)$/))) return this.B('vector3_const', { DIR: m[1] });
    if ((m = p.match(/^transform\.(position|rotation|localScale|forward|right|up)$/))) return this.B('transform_get', { PROP: m[1] });
    if ((m = p.match(/^Color\.(white|black|red|green|blue|yellow|cyan|magenta|gray|clear)$/))) return this.B('color_const', { COLOR: m[1] });
    if (['Input.mousePosition', 'Camera.main', 'Screen.width', 'Screen.height'].includes(p)) return this.B('unity_value', { V: p });
    return this.B('var_get', { NAME: p });
  },
  ex(n) {
    const T = n.type, txt = this.t(n), V = (t, i, x) => this.val(t, i, x);
    if (T === 'parenthesized_expression') return this.ex(n.namedChildren[0]);
    if (T === 'integer_literal' || T === 'real_literal') {
      if (/^\d+$/.test(txt)) return this.B('math_number', { NUM: +txt });
      const m = txt.match(/^(\d*\.\d+)[fF]?$/);
      if (m && !Number.isInteger(+m[1])) return this.B('math_number', { NUM: +m[1] });
      const fm = txt.match(/^(\d+(?:\.\d+)?)[fF]$/);
      if (fm) return this.B('number_f', { NUM: +fm[1] });
    }
    if (T === 'string_literal' && this.str(n) !== null) return this.B('text', { TEXT: this.str(n) });
    if (T === 'boolean_literal') return this.B('logic_boolean', { BOOL: txt === 'true' ? 'TRUE' : 'FALSE' });
    if (T === 'null_literal') return this.B('logic_null');
    const p = this.path(n);
    if (p) return this.pathBlock(p);
    if (T === 'prefix_unary_expression') {
      const op = n.child(0).type, x = n.namedChildren[0];
      if (op === '!') return this.B('logic_negate', {}, { BOOL: V('logic_negate', 'BOOL', x) });
      if (op === '-' && /_literal$/.test(x.type)) { const b = this.ex(x); if (['math_number', 'number_f'].includes(b.type)) { b.fields.NUM = -b.fields.NUM; return b; } }
      if (op === '-') return this.B('negate', {}, { VALUE: V('negate', 'VALUE', x) });
    }
    if (T === 'binary_expression') {
      const op = n.child(1).type, L = n.childForFieldName('left'), R = n.childForFieldName('right');
      const ar = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE' }[op], cmp = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' }[op];
      if (op === '+') {
        const a = this.ex(L), b = this.ex(R);
        if ([a, b].some(x => ['text', 'text_concat', 'to_string'].includes(x.type))) return this.B('text_concat', {}, { A: { block: a }, B: { block: b } });
        return this.B('math_arithmetic', { OP: 'ADD' }, { A: this.fit('math_arithmetic', 'A', a, L), B: this.fit('math_arithmetic', 'B', b, R) });
      }
      if (ar) return this.B('math_arithmetic', { OP: ar }, { A: V('math_arithmetic', 'A', L), B: V('math_arithmetic', 'B', R) });
      if (op === '%') return this.B('math_modulo', {}, { DIVIDEND: V('math_modulo', 'DIVIDEND', L), DIVISOR: V('math_modulo', 'DIVISOR', R) });
      if (cmp) return this.B('logic_compare', { OP: cmp }, { A: V('logic_compare', 'A', L), B: V('logic_compare', 'B', R) });
      if (op === '&&' || op === '||') return this.B('logic_operation', { OP: op === '&&' ? 'AND' : 'OR' }, { A: V('logic_operation', 'A', L), B: V('logic_operation', 'B', R) });
    }
    if (T === 'conditional_expression')
      return this.B('logic_ternary', {}, { IF: V('logic_ternary', 'IF', n.childForFieldName('condition')), THEN: V('logic_ternary', 'THEN', n.childForFieldName('consequence')),
        ELSE: V('logic_ternary', 'ELSE', n.childForFieldName('alternative')) });
    if (T === 'cast_expression' && ['int', 'float'].includes(this.t(n.childForFieldName('type'))))
      return this.B('cast_expr', { TYPE: this.t(n.childForFieldName('type')) }, { VALUE: V('cast_expr', 'VALUE', n.childForFieldName('value')) });
    if (T === 'element_access_expression') {
      const a = n.childForFieldName('subscript').namedChildren.filter(c => c.type === 'argument');
      if (a.length === 1) return this.B('list_get', {}, { LIST: V('list_get', 'LIST', n.childForFieldName('expression')), INDEX: V('list_get', 'INDEX', a[0].namedChildren[0]) });
    }
    if (T === 'object_creation_expression') {
      const init = n.namedChildren.find(c => c.type === 'initializer_expression'), items = init ? init.namedChildren.filter(c => c.type !== 'comment') : [];
      if (init && items.every(c => c.type === 'assignment_expression' && c.childForFieldName('left').type === 'identifier'
          && this.t(c.namedChildren.find(x => x.type === 'assignment_operator')) === '='))
        return this.B('new_object_init', { NAME: this.t(n.childForFieldName('type')), ARGS: this.argText(n) }, { INITS: this.chain(items.map(c =>
          this.B('init_assign', { NAME: this.t(c.childForFieldName('left')) }, { VALUE: this.val('init_assign', 'VALUE', c.childForFieldName('right')) }))) });
    }
    if (T === 'array_creation_expression' && n.namedChildren.length === 1) {
      const at = n.namedChildren[0], rank = at.childForFieldName('rank');
      if (rank && rank.namedChildren.length === 1) return this.B('array_new', { TYPE: this.t(at.childForFieldName('type')) }, { SIZE: V('array_new', 'SIZE', rank.namedChildren[0]) });
    }
    if (T === 'tuple_expression') {
      const a = n.namedChildren.filter(c => c.type === 'argument');
      if (a.length === 2 && a.every(x => x.namedChildren.length === 1)) return this.B('tuple2', {}, { A: V('tuple2', 'A', a[0].namedChildren[0]), B: V('tuple2', 'B', a[1].namedChildren[0]) });
    }
    if (T === 'switch_expression') {
      const arms = n.namedChildren.filter(c => c.type === 'switch_expression_arm');
      if (arms.every(a => a.namedChildren.length === 2))
        return this.B('switch_expr', {}, { VALUE: V('switch_expr', 'VALUE', n.namedChildren[0]), ARMS: this.chain(arms.map(a =>
          this.B('switch_arm', { PATTERN: this.flat(a.namedChildren[0]) }, { VALUE: this.val('switch_arm', 'VALUE', a.namedChildren[1]) }))) });
    }
    if (T === 'object_creation_expression' && !n.namedChildren.some(c => c.type === 'initializer_expression')) {
      const ty = this.t(n.childForFieldName('type')), a = this.args(n);
      let m;
      if (ty === 'Vector3' && a && a.length === 3) return this.B('vector3_new', {}, { X: V('vector3_new', 'X', a[0]), Y: V('vector3_new', 'Y', a[1]), Z: V('vector3_new', 'Z', a[2]) });
      if ((m = ty.match(/^List<(.+)>$/)) && a && !a.length) return this.B('list_new', { TYPE: m[1] });
      if ((m = ty.match(/^Dictionary<([^,<>]+),\s*([^,]+)>$/)) && a && !a.length) return this.B('dict_new', { KEY: m[1].trim(), VAL: m[2].trim() });
      return this.B('new_object', { NAME: ty, ARGS: this.argText(n) });
    }
    if (T === 'member_access_expression' && n.childForFieldName('name').type === 'identifier')
      return this.B('prop_get', { PROP: this.t(n.childForFieldName('name')) }, { OBJ: V('prop_get', 'OBJ', n.childForFieldName('expression')) });
    if (T === 'invocation_expression') { const b = this.callExpr(n); if (b) return b; }
    return this.raw(n, 'raw_expr');
  },
  callExpr(n) {
    const fn = n.childForFieldName('function'), a = this.args(n), k = a ? a.length : -1, fp = this.path(fn), V = (t, i, x) => this.val(t, i, x);
    const gen = this.generic(fn);
    let m;
    if (gen && k === 0) {
      const gname = this.t(gen.g.namedChildren[0]), targs = this.t(gen.g.namedChildren[1]).slice(1, -1).trim();
      if (!gen.target && gname === 'GetComponent') return this.B('get_component', { TYPE: targs });
      if (gen.target && this.path(gen.target) === 'gameObject' && gname === 'AddComponent') return this.B('add_component', { TYPE: targs });
    }
    if (gen) return this.B('generic_call', { NAME: this.t(gen.g.namedChildren[0]), TYPE: this.t(gen.g.namedChildren[1]).slice(1, -1).trim(), ARGS: this.argText(n) },
      { OBJ: gen.target && V('generic_call', 'OBJ', gen.target) });
    if (fp && a) {
      if ((m = fp.match(/^Input\.(GetKey|GetKeyDown|GetKeyUp)$/)) && k === 1) {
        const key = (this.path(a[0]) || '').match(/^KeyCode\.(\w+)$/);
        if (key && KEYS.includes(key[1])) return this.B('input_key', { MODE: m[1], KEY: key[1] });
      }
      if (fp === 'Input.GetAxis' && k === 1 && ['Horizontal', 'Vertical', 'Mouse X', 'Mouse Y', 'Jump'].includes(this.str(a[0]))) return this.B('input_axis', { AXIS: this.str(a[0]) });
      if ((m = fp.match(/^Input\.(GetMouseButton(?:Down|Up)?)$/)) && k === 1 && /^[012]$/.test(this.t(a[0]))) return this.B('mouse_button', { MODE: m[1], BTN: this.t(a[0]) });
      if (fp === 'Random.Range' && k === 2) return this.B('random_range', {}, { A: V('random_range', 'A', a[0]), B: V('random_range', 'B', a[1]) });
      if ((m = fp.match(/^Mathf\.(\w+)$/))) {
        if (k === 1 && ['Abs', 'Sqrt', 'Round', 'Floor', 'Ceil', 'Sin', 'Cos', 'Sign', 'RoundToInt', 'FloorToInt'].includes(m[1])) return this.B('math_func1', { FN: m[1] }, { X: V('math_func1', 'X', a[0]) });
        if (k === 2 && ['Max', 'Min', 'Pow'].includes(m[1])) return this.B('math_func2', { FN: m[1] }, { A: V('math_func2', 'A', a[0]), B: V('math_func2', 'B', a[1]) });
        if (k === 3 && ['Clamp', 'Lerp'].includes(m[1])) return this.B('math_func3', { FN: m[1] }, { A: V('math_func3', 'A', a[0]), B: V('math_func3', 'B', a[1]), C: V('math_func3', 'C', a[2]) });
      }
      if ((m = fp.match(/^Vector3\.(Distance|Dot|Cross)$/)) && k === 2) return this.B('vector3_func', { FN: m[1] }, { A: V('vector3_func', 'A', a[0]), B: V('vector3_func', 'B', a[1]) });
      if ((m = fp.match(/^Vector3\.(Lerp|MoveTowards)$/)) && k === 3)
        return this.B('vector3_lerp', { FN: m[1] }, { A: V('vector3_lerp', 'A', a[0]), B: V('vector3_lerp', 'B', a[1]), C: V('vector3_lerp', 'C', a[2]) });
      if (fp === 'Quaternion.Euler' && k === 3) return this.B('quaternion_euler', {}, { X: V('quaternion_euler', 'X', a[0]), Y: V('quaternion_euler', 'Y', a[1]), Z: V('quaternion_euler', 'Z', a[2]) });
      if ((m = fp.match(/^GameObject\.(Find|FindWithTag)$/)) && k === 1 && this.str(a[0]) !== null) return this.B('find_object', { FN: m[1], NAME: this.str(a[0]) });
      if (fp === 'Instantiate' && k === 3 && this.t(a[2]) === 'Quaternion.identity') return this.B('instantiate', {}, { PREFAB: V('instantiate', 'PREFAB', a[0]), POS: V('instantiate', 'POS', a[1]) });
      if ((m = fp.match(/^PlayerPrefs\.(GetInt|GetFloat|GetString)$/)) && (k === 1 || k === 2) && this.str(a[0]) !== null)
        return this.B('prefs_get', { FN: m[1], KEY: this.str(a[0]) }, { DEF: V('prefs_get', 'DEF', a[1]) });
    }
    if (fn.type === 'member_access_expression' && a) {
      const tgt = fn.childForFieldName('expression'), nm = this.t(fn.childForFieldName('name'));
      if (nm === 'CompareTag' && k === 1 && this.str(a[0]) !== null) return this.B('compare_tag', { TAG: this.str(a[0]) }, { OBJ: V('compare_tag', 'OBJ', tgt) });
      if (nm === 'Contains' && k === 1) return this.B('list_contains', {}, { LIST: V('list_contains', 'LIST', tgt), VALUE: V('list_contains', 'VALUE', a[0]) });
      if (nm === 'ContainsKey' && k === 1) return this.B('dict_contains', {}, { LIST: V('dict_contains', 'LIST', tgt), KEY: V('dict_contains', 'KEY', a[0]) });
      if (nm === 'IndexOf' && k === 1) return this.B('list_index_of', {}, { LIST: V('list_index_of', 'LIST', tgt), VALUE: V('list_index_of', 'VALUE', a[0]) });
      if (nm === 'ToString' && k === 0) return this.B('to_string', {}, { VALUE: V('to_string', 'VALUE', tgt) });
    }
    if (fp) return this.B('method_call_expr', { NAME: fp, ARGS: this.argText(n) });
    const nm = fn.type === 'member_access_expression' && fn.childForFieldName('name');
    return nm && nm.type === 'identifier'
      ? this.B('call_on', { NAME: this.t(nm), ARGS: this.argText(n) }, { OBJ: V('call_on', 'OBJ', fn.childForFieldName('expression')) }) : null;
  },
};
function importCs(src, append) {
  if (!tsParser) throw new Error('C# パーサーを読み込み中です。少し待ってから再度お試しください');
  const tops = Imp.run(src);
  if (!tops.some(t => t.type !== 'using_def')) throw new Error('クラスまたは enum が見つかりませんでした');
  const before = ws.getAllBlocks(false).length;
  Blockly.Events.setGroup(true);
  try {
    if (!append) ws.clear();
    for (const t of tops) Blockly.serialization.blocks.append(t, ws);
    ws.cleanUp();
  } finally { Blockly.Events.setGroup(false); }
  return { count: ws.getAllBlocks(false).length - (append ? before : 0), log: Imp.log, notes: [...Imp.notes] };
}

