// 入力欄の補完 (Tab で確定)
// ---------- 入力補完 (Tab で確定) ----------
const AC = {
  el: Object.assign(document.createElement('div'), { id: 'ac', hidden: true }),
  items: [], idx: 0, field: null, from: 0, to: 0, moved: false,
  candidates(field, token) {
    const kind = field.acKind, sc = scopeOf(field.getSourceBlock());
    if (['member', 'member_method', 'initmember'].includes(kind)) {
      const blk = field.getSourceBlock(), par = blk.getSurroundParent();
      const t = kind === 'initmember' ? (par && par.type === 'new_object_init' ? f(par, 'NAME').trim() : '?') : typeOf(blk.getInputTargetBlock('OBJ'));
      return Object.entries(membersOf(t) || {}).filter(([n]) => n.endsWith('()') === (kind === 'member_method'))
        .map(([n, ty]) => ({ label: n, insert: n.replace('()', ''), detail: `${ty === '?' ? '' : ty + ' · '}${t}` }));
    }
    const cls = [...MODEL.keys()];
    const T = (list, detail) => list.map(label => ({ label, insert: label, detail }));
    if (['type', 'params', 'base', 'component', 'class'].includes(kind)) {
      if (kind === 'base') return [...T(['MonoBehaviour', 'ScriptableObject'], 'Unity'), ...T(cls, 'クラス')];
      if (kind === 'component') return [...T(COMPONENTS, 'コンポーネント'), ...T(cls.filter(n => isMono(MODEL.get(n))), 'クラス')];
      if (kind === 'class') return [...T(cls, 'クラス'), ...T(UNITY_TYPES, 'Unity')];
      return [...T(PRIMS, '型'), ...T(cls, 'クラス'), ...T(UNITY_TYPES, 'Unity'),
        ...T(['int', 'float', 'string', 'GameObject', ...cls].map(t => `List<${t}>`), 'リスト')];
    }
    const methodOnly = kind === 'method';
    const fromMembers = (mem, detail) => Object.entries(mem || {})
      .filter(([n]) => !methodOnly || n.endsWith('()'))
      .map(([n, t]) => ({ label: n, insert: methodOnly ? n.slice(0, -2) : n, detail: `${t === '?' ? '' : t + ' · '}${detail}` }));
    const dot = token.lastIndexOf('.');
    if (dot >= 0) {
      const r = resolve(token.slice(0, dot), sc);
      return fromMembers(membersOf(r.type), r.type.replace('#', ''));
    }
    const out = [];
    if (!methodOnly) sc.vars.forEach((t, n) => out.push({ label: n, insert: n, detail: t + ' · ローカル' }));
    if (sc.cls) out.push(...fromMembers({ ...sc.cls.members, ...classMembers(sc.cls) }, 'メンバー'));
    if (!methodOnly) out.push({ label: 'this', insert: 'this', detail: 'this' });
    out.push(...T(Object.keys(STATICS), 'Unity'), ...T(cls, 'クラス'));
    return out;
  },
  open(field) {
    this.field = field;
    const inp = field.htmlInput_;
    if (!inp) return;
    MODEL = model();
    const all = inp.selectionStart !== inp.selectionEnd && inp.selectionStart === 0 && inp.selectionEnd === inp.value.length;
    const caret = inp.selectionEnd, before = all ? '' : inp.value.slice(0, caret);
    const typeLike = ['type', 'params', 'base', 'component', 'class'].includes(field.acKind);
    const token = before.match(typeLike ? /[\w<>\[\]]*$/ : /[\w.]*$/)[0];
    const partial = typeLike ? token : token.slice(token.lastIndexOf('.') + 1);
    this.from = all ? 0 : caret - partial.length; this.to = all ? inp.value.length : caret;
    const p = partial.toLowerCase(), seen = new Set();
    this.items = this.candidates(field, token)
      .filter(c => !seen.has(c.label) && seen.add(c.label) && c.label.toLowerCase().includes(p) && c.insert !== partial)
      .sort((a, b) => b.label.toLowerCase().startsWith(p) - a.label.toLowerCase().startsWith(p))
      .slice(0, 60);
    this.idx = 0; this.moved = false;
    if (!this.items.length) return this.close();
    const r = inp.getBoundingClientRect();
    Object.assign(this.el.style, { left: r.left + 'px', top: r.bottom + 4 + 'px' });
    this.el.hidden = false;
    this.draw();
  },
  draw() {
    this.el.innerHTML = this.items.map((c, i) =>
      `<div class="ac-item${i === this.idx ? ' sel' : ''}" data-i="${i}"><span>${esc(c.label)}</span><small>${esc(c.detail)}</small></div>`).join('')
      + '<div class="ac-hint">Tab で確定 · ↑↓ で選択 · Esc で閉じる</div>';
    const sel = this.el.querySelector('.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  },
  accept(i) {
    const inp = this.field && this.field.htmlInput_, c = this.items[i];
    if (!inp || !c) return;
    inp.value = inp.value.slice(0, this.from) + c.insert + inp.value.slice(this.to);
    const pos = this.from + c.insert.length;
    inp.setSelectionRange(pos, pos);
    inp.dispatchEvent(new Event('input'));
  },
  close() { this.el.hidden = true; },
  key(e) {
    if (!this.el.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        this.idx = (this.idx + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
        this.moved = true; this.draw();
      } else if (e.key === 'Tab' || (e.key === 'Enter' && this.moved)) this.accept(this.idx);
      else if (e.key === 'Escape') this.close();
      else return false;
    } else if (e.key === ' ' && e.ctrlKey) this.open(this.field);
    else return false;
    e.preventDefault(); e.stopPropagation();
    return true;
  },
};
document.body.appendChild(AC.el);
AC.el.addEventListener('mousedown', e => {
  e.preventDefault();
  const d = e.target.closest('.ac-item');
  if (d) AC.accept(+d.dataset.i);
});

class FieldAC extends Blockly.FieldTextInput {
  constructor(value, validator, config) { super(value, validator, config); this.acKind = config && config.ac; }
  static fromJson(o) { return new FieldAC(o.text, undefined, o); }
  showEditor_(e, quiet) {
    super.showEditor_(e, quiet);
    if (!this.htmlInput_) return;
    this.htmlInput_.addEventListener('input', () => AC.open(this));
    AC.open(this);
  }
  onHtmlInputKeyDown_(e) { if (!AC.key(e)) super.onHtmlInputKeyDown_(e); }
  widgetDispose_() { AC.close(); super.widgetDispose_(); }
}
Blockly.fieldRegistry.register('field_ac', FieldAC);

