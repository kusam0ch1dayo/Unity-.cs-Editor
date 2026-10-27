// 複数スクリプトのタブ管理 (Player.cs と Enemy.cs などを切り替えて編集し、まとめて zip で保存する)
const PROJECT_KEY = 'unity-block-coder-project';
let project = null;
const newScriptState = name => ({ blocks: { languageVersion: 0, blocks: [{ type: 'class_def', x: 20, y: 20,
  fields: { SER: false, ACCESS: 'public', NAME: name, BASE: 'MonoBehaviour' },
  inputs: { MEMBERS: { block: { type: 'unity_event', fields: { EVENT: 'Start()' }, next: { block: { type: 'unity_event', fields: { EVENT: 'Update()' } } } } } } }] } });

// 保存データ (JSON) からクラス情報を取り出す。ほかのタブのクラスもチェックと補完で使えるようにする
function jsonModel(state) {
  const classes = new Map();
  const walk = b => {
    if (!b) return;
    const fl = b.fields || {};
    if (b.type === 'class_def' && fl.NAME && !classes.has(fl.NAME)) {
      const c = { name: fl.NAME, base: (fl.BASE || '').trim(), members: {} };
      for (let m = b.inputs?.MEMBERS?.block; m; m = m.next?.block) {
        const mf = m.fields || {};
        if (['field_def', 'property_def', 'property_expr'].includes(m.type)) c.members[mf.NAME] = (mf.TYPE || '').trim();
        else if (m.type === 'method_def') c.members[mf.NAME + '()'] = (mf.RET || '').trim();
        else if (m.type === 'coroutine_def') c.members[mf.NAME + '()'] = 'IEnumerator';
      }
      classes.set(c.name, c);
    }
    if (b.type === 'enum_def' && fl.NAME && !classes.has(fl.NAME))
      classes.set(fl.NAME, { name: fl.NAME, base: '', members: {}, isEnum: true, values: (fl.VALUES || '').split(',').map(s => s.trim().split(/\s*=/)[0]).filter(Boolean) });
    Object.values(b.inputs || {}).forEach(i => walk(i.block));
    walk(b.next?.block);
  };
  (state?.blocks?.blocks || []).forEach(walk);
  return classes;
}
function otherClasses() {
  const out = new Map();
  if (!project) return out;
  project.files.forEach((fl, i) => {
    if (i === project.active) return;
    fl.model = fl.model || jsonModel(fl.state);
    fl.model.forEach((c, n) => out.has(n) || out.set(n, c));
  });
  return out;
}
function scriptName(workspace) {
  const classes = workspace.getAllBlocks(true).filter(b => b.type === 'class_def');
  const main = classes.find(b => f(b, 'BASE').trim() === 'MonoBehaviour') || classes[0];
  return (main ? f(main, 'NAME') : 'Script') + '.cs';
}

function saveProject() {
  if (!project) return;
  const cur = project.files[project.active];
  cur.state = Blockly.serialization.workspaces.save(ws);
  cur.name = fileName;
  try { localStorage.setItem(PROJECT_KEY, JSON.stringify({ active: project.active, files: project.files.map(({ name, state }) => ({ name, state })) })); } catch (e) {}
  renderTabs();
}
function loadActive() {
  AC.close(); Blockly.hideChaff();
  Blockly.Events.disable();
  try { ws.clear(); Blockly.serialization.workspaces.load(project.files[project.active].state || {}, ws); }
  catch (e) { ws.clear(); Blockly.serialization.workspaces.load(sample, ws); }
  finally { Blockly.Events.enable(); }
  ws.clearUndo();
  update();
}
function switchTo(i) {
  if (i === project.active || !project.files[i]) return;
  saveProject();
  project.active = i;
  loadActive();
}
function newTab(state) {
  saveProject();
  const names = new Set(project.files.map(fl => fl.name));
  let n = 1, name = 'NewScript';
  while (names.has(name + '.cs')) name = 'NewScript' + ++n;
  project.files.push({ name: name + '.cs', state: state || newScriptState(name) });
  project.active = project.files.length - 1;
  loadActive();
}
function closeTab(i) {
  if (!confirm(tr('「{0}」を閉じますか？ (タブを閉じる操作は元に戻せません)', project.files[i].name))) return;
  if (project.files.length === 1) { project.files[0] = { name: 'NewScript.cs', state: newScriptState('NewScript') }; loadActive(); return; }
  project.files.splice(i, 1);
  if (i < project.active) project.active--;
  else if (i === project.active) { project.active = Math.min(i, project.files.length - 1); loadActive(); return; }
  saveProject();
}
function renderTabs() {
  document.getElementById('tabs').innerHTML = project.files.map((fl, i) =>
    `<div class="tab${i === project.active ? ' on' : ''}" data-i="${i}" title="${esc(fl.name)}"><span>${esc(fl.name)}</span><button class="x" data-x="${i}" title="${tr('閉じる')}">×</button></div>`).join('')
    + `<button id="newTab" title="${tr('新しいスクリプト')}">＋</button>`;
}
document.getElementById('tabs').onclick = e => {
  if (e.target.id === 'newTab') return newTab();
  const x = e.target.closest('[data-x]');
  if (x) return closeTab(+x.dataset.x);
  const t = e.target.closest('.tab');
  if (t) switchTo(+t.dataset.i);
};

// 全スクリプトを zip にまとめて保存 (圧縮なしの zip を自前で作る)
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const crc32 = data => {
    let crc = -1;
    for (let i = 0; i < data.length; i++) { let c = (crc ^ data[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
    return (crc ^ -1) >>> 0;
  };
  let offset = 0;
  for (const fl of files) {
    const name = enc.encode(fl.name), data = enc.encode(fl.text), crc = crc32(data);
    const head = (size, sig, central) => {
      const v = new DataView(new ArrayBuffer(size)); let p = 0;
      const u16 = x => { v.setUint16(p, x, true); p += 2; }, u32 = x => { v.setUint32(p, x, true); p += 4; };
      u32(sig); if (central) u16(20); u16(20); u16(0x0800); u16(0); u16(0); u16(0x21); u32(crc); u32(data.length); u32(data.length); u16(name.length); u16(0);
      if (central) { u16(0); u16(0); u16(0); u32(0); u32(offset); }
      return new Uint8Array(v.buffer);
    };
    parts.push(head(30, 0x04034b50, false), name, data);
    central.push(head(46, 0x02014b50, true), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, x) => n + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
function allScripts() {
  saveProject();
  const used = new Set();
  return project.files.map((fl, i) => {
    let text = code, name = fileName;
    if (i !== project.active) {
      const tmp = new Blockly.Workspace();
      try { Blockly.serialization.workspaces.load(fl.state || {}, tmp); text = generate(tmp).code; name = scriptName(tmp); } finally { tmp.dispose(); }
    }
    let unique = name, n = 2;
    while (used.has(unique)) unique = name.replace(/\.cs$/, `_${n++}.cs`);
    used.add(unique);
    return { name: unique, text };
  });
}
document.getElementById('zip').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(makeZip(allScripts()));
  a.download = 'UnityScripts.zip'; a.click(); URL.revokeObjectURL(a.href);
};

// 起動時: 保存したプロジェクトを開く (以前の 1 ファイル保存からも引き継ぐ)
(function initProject() {
  let data = null, old = null;
  try { data = JSON.parse(localStorage.getItem(PROJECT_KEY)); } catch (e) {}
  if (!data || !data.files || !data.files.length) {
    try { old = JSON.parse(localStorage.getItem('unity-block-coder')); } catch (e) {}
    data = { active: 0, files: [{ name: 'Script.cs', state: old || sample }] };
  }
  project = { active: Math.min(Math.max(data.active || 0, 0), data.files.length - 1), files: data.files };
  loadActive();
})();
