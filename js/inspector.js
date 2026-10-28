// インスペクターのプレビュー: public / [SerializeField] のフィールドが、Unity のインスペクターでどう見えるかを表示する
// (Unity と同じ決まり: static・const・readonly・プロパティ・Dictionary は表示されない。[Header] [Range] [Tooltip] [Space] [TextArea] [HideInInspector] に対応)
const UNITY_OBJECTS = new Set(['GameObject', 'Transform', 'Rigidbody', 'Rigidbody2D', 'Collider', 'Collider2D', 'BoxCollider', 'SphereCollider', 'CapsuleCollider',
  'BoxCollider2D', 'CircleCollider2D', 'AudioSource', 'AudioClip', 'Animator', 'Camera', 'Light', 'Material', 'Sprite', 'SpriteRenderer', 'Renderer', 'MeshRenderer',
  'Texture', 'Texture2D', 'Text', 'Image', 'Button', 'Slider', 'Toggle', 'Canvas', 'RectTransform', 'TextMeshProUGUI', 'TMP_Text', 'ParticleSystem', 'NavMeshAgent',
  'CharacterController', 'LineRenderer', 'TrailRenderer', 'Font', 'PhysicsMaterial2D', 'ScriptableObject', 'MonoBehaviour', 'Object']);
// Unity の ObjectNames.NicifyVariableName と同じように、変数名を見出しにする (moveSpeed → Move Speed)
const nicify = n => n.replace(/^m_/, '').replace(/^_+/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
const attrArgs = a => (a.match(/\(([^)]*)\)/) || [])[1] || '';
const unquote = s => s.trim().replace(/^@?"|"$/g, '');

function serializedFields(cls) {
  const out = [];
  let attrs = [];
  for (let m = cls.getInputTargetBlock('MEMBERS'); m; m = m.getNextBlock()) {
    if (m.type === 'attr') { attrs.push(f(m, 'CODE').trim()); continue; }
    if (m.type === 'comment_member') continue;
    if (m.type === 'field_def') {
      const access = f(m, 'ACCESS'), hidden = attrs.some(a => /^(HideInInspector|NonSerialized|System\.NonSerialized)\b/.test(a));
      const shown = (/\bpublic\b/.test(access) || /SerializeField/.test(access) || attrs.some(a => /^SerializeField\b/.test(a))) && !/static|const|readonly/.test(access);
      if (shown && !hidden) out.push({ block: m, name: f(m, 'NAME').trim(), type: f(m, 'TYPE').trim(), attrs, value: m.getInputTargetBlock('VALUE') });
    }
    attrs = [];
  }
  return out;
}
// 初期値 (かんたんな値だけ読む)
function initialValue(b) {
  if (!b) return undefined;
  const num = x => x && x.type === 'math_number' ? +f(x, 'NUM') : undefined;
  if (b.type === 'math_number') return +f(b, 'NUM');
  if (b.type === 'text') return f(b, 'TEXT');
  if (b.type === 'logic_boolean') return f(b, 'BOOL') === 'TRUE';
  if (['vector3_new', 'vector2_new'].includes(b.type)) return ['X', 'Y', 'Z'].map(n => num(b.getInputTargetBlock(n)));
  return null;   // 式など (Unity では実行時に決まる)
}

function fieldControl(fd, depth = 0) {
  const t = fd.type, v = initialValue(fd.value), attrs = fd.attrs || [];
  const range = attrs.find(a => /^Range\b/.test(a)), text = attrs.find(a => /^(TextArea|Multiline)\b/.test(a));
  const enumDef = ws.getAllBlocks(false).find(b => b.type === 'enum_def' && f(b, 'NAME') === t);
  const serClass = ws.getAllBlocks(false).find(b => b.type === 'class_def' && f(b, 'NAME') === t && f(b, 'SER') === 'TRUE');
  const list = t.match(/^List<(.+)>$/) || t.match(/^(.+)\[\]$/);
  const box = (val, cls = '') => `<span class="ins-box ${cls}">${esc(String(val))}</span>`;
  if (list) return `<span class="ins-list">▸ ${box(0, 'num')} <small>${pick(['個 (要素はインスペクターで追加)', 'items (add them in the Inspector)'])}</small></span>`;
  if (/^Dictionary</.test(t)) return `<small class="ins-note">${pick(['Dictionary はインスペクターに表示されません', 'Dictionaries are not shown in the Inspector'])}</small>`;
  if (enumDef) return box(`${(f(enumDef, 'VALUES').split(',')[0] || '').split('=')[0].trim()} ▾`, 'drop');
  if (serClass && depth < 3) return `<span class="ins-sub">▸ ${esc(t)}</span>` + serializedFields(serClass).map(x => fieldRow(x, depth + 1)).join('');
  if (['int', 'float', 'double', 'long', 'byte', 'short'].includes(t)) {
    const val = typeof v === 'number' ? v : 0;
    if (range) { const [lo, hi] = attrArgs(range).split(',').map(s => parseFloat(s)); const p = hi > lo ? Math.min(1, Math.max(0, (val - lo) / (hi - lo))) : 0;
      return `<span class="ins-slider"><span class="track"><span class="knob" style="left:${(p * 100).toFixed(1)}%"></span></span>${box(val, 'num')}</span>`; }
    return box(val, 'num');
  }
  if (t === 'bool') return `<span class="ins-check">${v === true ? '✔' : ''}</span>`;
  if (t === 'string') return text ? `<span class="ins-box area">${esc(v ?? '')}</span>` : box(v ?? '');
  if (['Vector2', 'Vector3', 'Vector2Int', 'Vector3Int'].includes(t)) {
    const n = /2/.test(t) ? 2 : 3, vals = Array.isArray(v) ? v : [];
    return `<span class="ins-vec">${['X', 'Y', 'Z'].slice(0, n).map((a, i) => `<b>${a}</b>${box(vals[i] ?? 0, 'num')}`).join('')}</span>`;
  }
  if (t === 'Color') return '<span class="ins-color"></span>';
  if (t === 'LayerMask') return box('Nothing ▾', 'drop');
  if (['AnimationCurve', 'Gradient'].includes(t)) return `<span class="ins-box curve">〜</span>`;
  if (UNITY_OBJECTS.has(t) || MODEL.has(t) || /^[A-Z]/.test(t)) return box(`None (${t})`, 'obj') + '<span class="ins-dot">⊙</span>';
  return `<small class="ins-note">${pick(['インスペクターに表示されない型です', 'This type is not shown in the Inspector'])}</small>`;
}
function fieldRow(fd, depth = 0) {
  const header = fd.attrs.find(a => /^Header\b/.test(a)), space = fd.attrs.find(a => /^Space\b/.test(a)), tip = fd.attrs.find(a => /^Tooltip\b/.test(a));
  return (space ? `<div style="height:${Math.min(40, parseFloat(attrArgs(space)) || 8)}px"></div>` : '')
    + (header ? `<div class="ins-header" style="padding-left:${depth * 14}px">${esc(unquote(attrArgs(header)))}</div>` : '')
    + `<div class="ins-row" data-id="${fd.block.id}" style="padding-left:${10 + depth * 14}px" ${tip ? `title="${esc(unquote(attrArgs(tip)))}"` : ''}>`
    + `<span class="ins-label">${esc(nicify(fd.name))}${tip ? ' <small>ⓘ</small>' : ''}</span><span class="ins-ctl">${fieldControl(fd, depth)}</span></div>`;
}
function renderInspector() {
  const el = document.getElementById('inspector');
  // 選んでいるブロックのクラス、なければ MonoBehaviour のクラスを表示する
  let cls = Blockly.common.getSelected();
  while (cls && cls.type !== 'class_def') cls = cls.getSurroundParent ? cls.getSurroundParent() : null;
  const classes = ws.getAllBlocks(true).filter(b => b.type === 'class_def');
  if (!cls) cls = classes.find(b => /MonoBehaviour|ScriptableObject/.test(f(b, 'BASE'))) || classes[0];
  if (!cls) { el.innerHTML = `<div class="ok"><small>${pick(['クラスがありません', 'No class'])}</small></div>`; return; }
  const base = f(cls, 'BASE').trim(), isComp = base === 'MonoBehaviour' || isMono(MODEL.get(f(cls, 'NAME'))), fields = serializedFields(cls);
  el.innerHTML = `<div class="ins">`
    + `<div class="ins-comp"><span>▾</span>${isComp ? '<span class="ins-check on">✔</span>' : ''}<b>${esc(nicify(f(cls, 'NAME')))}</b><small>${isComp ? '(Script)' : base ? `(${esc(base)})` : ''}</small></div>`
    + (isComp ? `<div class="ins-row dim" style="padding-left:10px"><span class="ins-label">Script</span><span class="ins-ctl"><span class="ins-box obj">${esc(f(cls, 'NAME'))}</span></span></div>` : '')
    + (fields.length ? fields.map(x => fieldRow(x)).join('')
      : `<div class="ins-empty">${pick(['インスペクターに表示される項目はありません。フィールドを public にするか [SerializeField] を付けると、Unity の画面から値を変えられます。',
        'Nothing is shown in the Inspector. Make a field public or add [SerializeField] to edit it from Unity.'])}</div>`)
    + `</div><p class="ins-tip">${pick(['クリックでそのフィールドのブロックへ。値はプレビューです (Unity では、インスペクターで設定した値がコードの初期値より優先されます)。',
      'Click to jump to the field. Values are a preview (in Unity, values set in the Inspector override the defaults in code).'])}</p>`;
}
document.getElementById('inspector').onclick = e => {
  const r = e.target.closest('[data-id]'), b = r && ws.getBlockById(r.dataset.id);
  if (b) { ws.centerOnBlock(b.id); Blockly.common.setSelected(b); }
};
