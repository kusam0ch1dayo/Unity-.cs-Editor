// コードの書き方 ({ の位置・字下げ) と、名前の付け方のチェック
const STYLE_KEY = 'unity-block-coder-style';
let codeStyle = { brace: 'next', indent: '4', naming: true };
try { codeStyle = { ...codeStyle, ...JSON.parse(localStorage.getItem(STYLE_KEY)) }; } catch (e) {}
const INDENTS = { 4: '    ', 2: '  ', tab: '\t' };
function applyCodeStyle() {
  cs.braceSameLine = codeStyle.brace === 'same';
  cs.INDENT = INDENTS[codeStyle.indent] || INDENTS[4];
}
function setCodeStyle(key, value) {
  codeStyle[key] = key === 'naming' ? !!value : value;
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(codeStyle)); } catch (e) {}
  applyCodeStyle();
  if (typeof update === 'function') update();
}
applyCodeStyle();

// ---------- 名前の付け方 (C# と Unity でよく使われる決まり) ----------
// 大文字で始める: クラス・enum・メソッド・プロパティ・コルーチン / 小文字で始める: フィールド・ローカル変数
const NAME_RULES = {
  class_def: 'upper', enum_def: 'upper', method_def: 'upper', coroutine_def: 'upper', property_def: 'upper', property_expr: 'upper',
  field_def: 'lower', var_local: 'lower', list_foreach: 'lower', for_range: 'lower', for_step: 'lower',
};
const toUpper = s => s.charAt(0).toUpperCase() + s.slice(1), toLower = s => s.charAt(0).toLowerCase() + s.slice(1);
function namingIssues() {
  if (!codeStyle.naming || typeof DECL === 'undefined') return [];
  const out = [];
  for (const b of ws.getAllBlocks(false)) {
    const rule = NAME_RULES[b.type];
    if (!rule || !b.isEnabled() || b.isShadow()) continue;
    // 定数 (const) と static (シングルトンの Instance など) は大文字で始めることが多いので対象外
    if (b.type === 'field_def' && /const|static/.test(f(b, 'ACCESS'))) continue;
    const field = DECL[b.type], name = f(b, field).trim();
    if (!/^[A-Za-z]\w*$/.test(name)) continue;
    const want = rule === 'upper' ? toUpper(name) : toLower(name);
    if (want === name) continue;
    const kind = { upper: pick(['大文字', 'an uppercase letter']), lower: pick(['小文字', 'a lowercase letter']) }[rule];
    out.push({ block: b, level: 'warn', msg: pick([`名前 '${name}' は${kind}で始めるのが一般的です`, `'${name}' usually starts with ${kind}`]),
      fixes: [{ label: pick([`'${want}' に変更`, `Rename to '${want}'`]), run: () => applyRename(b, want) }] });
  }
  return out;
}

function codeStyleSettings() {
  const seg = (key, cur, items) => `<div class="seg">${items.map(([v, l]) => `<button data-style="${key}" data-v="${v}" class="${v === cur ? 'on' : ''}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
  return `<section><h3>${pick(['コードの書き方', 'Code style'])}</h3>`
    + `<div class="set-row"><span>${pick(['{ の位置', 'Brace position'])}</span>${seg('brace', codeStyle.brace, [['next', pick(['次の行 (Unity 標準)', 'Next line (Unity)'])], ['same', pick(['同じ行', 'Same line'])]])}</div>`
    + `<div class="set-row"><span>${pick(['字下げ', 'Indent'])}</span>${seg('indent', codeStyle.indent, [['4', pick(['空白 4 つ', '4 spaces'])], ['2', pick(['空白 2 つ', '2 spaces'])], ['tab', pick(['タブ', 'Tab'])]])}</div>`
    + `<label class="set-row"><span>🔤 ${pick(['名前の付け方をチェック (メソッドは大文字・変数は小文字で始める など)', 'Check naming (methods start uppercase, variables lowercase, ...)'])}</span>`
    + `<input type="checkbox" data-style="naming" ${codeStyle.naming ? 'checked' : ''}></label></section>`;
}
function handleCodeStyleSettings(e) {
  const t = e.target.closest && e.target.closest('[data-style]');
  if (!t) return false;
  if (t.type === 'checkbox') { if (e.type === 'change') setCodeStyle('naming', t.checked); return true; }
  if (e.type !== 'click') return false;
  setCodeStyle(t.dataset.style, t.dataset.v);
  renderSettings();
  return true;
}
