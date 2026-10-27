// 対象の Unity バージョン。Unity 6 で名前が変わった API を、選んだバージョンに合わせてチェック・修正する
const UNITY_VER_KEY = 'unity-block-coder-unity';
let unityVer = '6';
try { unityVer = localStorage.getItem(UNITY_VER_KEY) || '6'; } catch (e) {}
const UNITY_VERS = { 6: 'Unity 6 ~', 2022: 'Unity 2022 LTS ~ 2023' };
// [古い名前, Unity 6 の名前, 対象の型]
const RENAMED = [
  ['velocity', 'linearVelocity', ['Rigidbody', 'Rigidbody2D']],
  ['drag', 'linearDamping', ['Rigidbody', 'Rigidbody2D']],
  ['angularDrag', 'angularDamping', ['Rigidbody', 'Rigidbody2D']],
];
for (const t of ['Rigidbody', 'Rigidbody2D']) Object.assign(MEMBERS[t], { linearVelocity: MEMBERS[t].velocity, drag: 'float', angularDrag: 'float', linearDamping: 'float', angularDamping: 'float' });
Object.assign(MONO, { 'FindFirstObjectByType()': '?', 'FindAnyObjectByType()': '?', 'FindObjectsByType()': '?', 'FindObjectsOfType()': '?' });

const isU6 = () => unityVer === '6';
// ブロックの文字の欄 (NAME, CODE など) にある、バージョンに合わない書き方を探す
function unityVersionIssues() {
  const out = [];
  const textFields = b => b.inputList.flatMap(i => i.fieldRow).filter(fd => fd.name && fd instanceof Blockly.FieldTextInput);
  for (const b of ws.getAllBlocks(false)) {
    if (!b.isEnabled() || b.isShadow()) continue;
    for (const fd of textFields(b)) {
      const val = String(fd.getValue() || '');
      for (const [old, now, types] of RENAMED) {
        const [from, to] = isU6() ? [old, now] : [now, old];
        const re = new RegExp(`([A-Za-z_][\\w.]*)\\.${from}\\b`, 'g');
        // 「(式) . velocity」のように、名前だけが欄に入っていて、相手がつないだブロックのとき
        if (val === from && b.inputList.some(i => i.type === Blockly.inputs.inputTypes.VALUE && i.connection.targetBlock() && types.includes(typeOf(i.connection.targetBlock())))) {
          const fix = [{ label: pick([`'${to}' に修正`, `Change to '${to}'`]), run: () => b.setFieldValue(to, fd.name) }];
          out.push(isU6() ? { block: b, level: 'warn', msg: pick([`Unity 6 では '${from}' は古い名前です。'${to}' を使いましょう`, `'${from}' is obsolete in Unity 6. Use '${to}'`]), fixes: fix }
            : { block: b, level: 'error', msg: pick([`Unity 2022 以前には '${from}' はありません ('${to}' を使います)`, `'${from}' does not exist before Unity 6 (use '${to}')`]), fixes: fix });
        }
        for (const m of val.matchAll(re)) {
          if (!types.includes(resolve(m[1], scopeOf(b)).type)) continue;
          const fix = [{ label: pick([`'${to}' に修正`, `Change to '${to}'`]), run: () => b.setFieldValue(String(b.getFieldValue(fd.name)).replace(new RegExp(`\\b${m[1].replace(/\./g, '\\.')}\\.${from}\\b`, 'g'), `${m[1]}.${to}`), fd.name) }];
          if (isU6()) out.push({ block: b, level: 'warn', msg: pick([`Unity 6 では '${from}' は古い名前です。'${to}' を使いましょう`, `'${from}' is obsolete in Unity 6. Use '${to}'`]), fixes: fix });
          else out.push({ block: b, level: 'error', msg: pick([`Unity 2022 以前には '${from}' はありません ('${to}' を使います)`, `'${from}' does not exist before Unity 6 (use '${to}')`]), fixes: fix });
        }
      }
      if (isU6() && /\bFindObjectOfType\b/.test(val))
        out.push({ block: b, level: 'warn', msg: pick(["Unity 6 では 'FindObjectOfType' は古い名前です。'FindFirstObjectByType' を使いましょう", "'FindObjectOfType' is obsolete in Unity 6. Use 'FindFirstObjectByType'"]),
          fixes: [{ label: pick(["'FindFirstObjectByType' に修正", "Change to 'FindFirstObjectByType'"]), run: () => b.setFieldValue(String(b.getFieldValue(fd.name)).replace(/\bFindObjectOfType\b/g, 'FindFirstObjectByType'), fd.name) }] });
      if (isU6() && /\bFindObjectsOfType\b/.test(val))
        out.push({ block: b, level: 'warn', msg: pick(["Unity 6 では 'FindObjectsOfType' は古い名前です。'FindObjectsByType<型>(FindObjectsSortMode.None)' を使いましょう",
          "'FindObjectsOfType' is obsolete in Unity 6. Use 'FindObjectsByType<T>(FindObjectsSortMode.None)'"]) });
    }
  }
  return out;
}
// 今のタブを、選んだバージョンの書き方にそろえる (自動で直せるものだけ)
function adaptUnityVersion(quiet) {
  let n = 0;
  MODEL = model();   // 開いたばかりのタブでも、変数の型がわかるように
  Blockly.Events.setGroup(true);
  try {
    for (let i = 0; i < 5; i++) {   // 1 つの欄に複数あるときのため、なくなるまでくり返す
      const fixes = unityVersionIssues().filter(x => x.fixes);
      if (!fixes.length) break;
      fixes.forEach(x => { x.fixes[0].run(); n++; });
    }
  } finally { Blockly.Events.setGroup(false); }
  if (!quiet) showToast(n ? pick([`${n} か所を ${UNITY_VERS[unityVer]} の書き方に直しました`, `Updated ${n} places for ${UNITY_VERS[unityVer]}`])
    : pick(['直す所はありませんでした', 'Nothing to update']), 3000);
  return n;
}
function setUnityVer(v) {
  unityVer = v;
  try { localStorage.setItem(UNITY_VER_KEY, v); } catch (e) {}
  refreshToolbox();
  update();
}
// ツールボックスの例も、選んだバージョンの書き方にする
const adaptToolboxJson = contents => isU6() ? JSON.parse(JSON.stringify(contents).replace(/"(rb2?d?)\.velocity"/g, '"$1.linearVelocity"')) : contents;
function unityVerSettings() {
  return `<label class="set-row"><span>🎮 ${pick(['対象の Unity バージョン', 'Target Unity version'])}</span><select data-set="unityVer">`
    + Object.entries(UNITY_VERS).map(([v, l]) => `<option value="${v}" ${v === unityVer ? 'selected' : ''}>${l}</option>`).join('') + '</select></label>'
    + `<div class="set-row"><span>${pick(['このタブをこのバージョンの書き方にそろえる', 'Update this tab for this version'])}</span><button data-set="adaptVer">${pick(['そろえる', 'Update'])}</button></div>`;
}
