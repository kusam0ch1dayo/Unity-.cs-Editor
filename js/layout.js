// 画面の配置: ブロックとコードの幅の調整・はじめての質問 (初期設定)・カテゴリの右クリックメニュー・ミニマップ・エラーの表示
const LAYOUT_KEY = 'unity-block-coder-layout';
let layout = { side: 40, minimap: true, order: [], folded: [] };
try { layout = { ...layout, ...JSON.parse(localStorage.getItem(LAYOUT_KEY)) }; } catch (e) {}
let minimapFrame = 0, minimapGeo = null, markedBlocks = [];   // ミニマップとエラー表示の状態 (下の関数で使う)
const saveLayout = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch (e) {} };
const mainEl = document.querySelector('main'), sideEl = document.getElementById('side'), leftEl = document.getElementById('left');

// ---------- ブロックとコードの幅 (仕切りをドラッグ) ----------
const splitter = Object.assign(document.createElement('div'), { id: 'splitter', tabIndex: 0 });
splitter.setAttribute('role', 'separator');
splitter.title = pick(['ドラッグで幅を変更 (ダブルクリックで元に戻す)', 'Drag to resize (double-click to reset)']);
sideEl.before(splitter);
const vertical = () => getComputedStyle(mainEl).flexDirection === 'column';   // 狭い画面では上下に並ぶ
function setSideSize(pct, save = true) {
  layout.side = Math.round(Math.min(75, Math.max(18, pct)) * 10) / 10;
  mainEl.style.setProperty('--side', layout.side + '%');
  splitter.setAttribute('aria-valuenow', Math.round(layout.side));
  Blockly.svgResize(ws);
  if (typeof drawMinimap === 'function') drawMinimap();
  if (save) saveLayout();
}
splitter.addEventListener('pointerdown', e => {
  e.preventDefault();
  splitter.setPointerCapture(e.pointerId);
  splitter.classList.add('dragging');
  const move = ev => {
    const r = mainEl.getBoundingClientRect();
    setSideSize(vertical() ? (r.bottom - ev.clientY) / r.height * 100 : (r.right - ev.clientX) / r.width * 100, false);
  };
  const up = () => { splitter.classList.remove('dragging'); splitter.removeEventListener('pointermove', move); saveLayout(); };
  splitter.addEventListener('pointermove', move);
  splitter.addEventListener('pointerup', up, { once: true });
});
splitter.addEventListener('dblclick', () => setSideSize(40));
splitter.addEventListener('keydown', e => {
  const d = { ArrowLeft: 2, ArrowUp: 2, ArrowRight: -2, ArrowDown: -2 }[e.key];
  if (d) { e.preventDefault(); setSideSize(layout.side + d); }
});

// ---------- はじめての質問 (初期設定) ----------
const SETUP_STEPS = [
  { id: 'level', q: ['C# やプログラミングの経験は？', 'How much C# / programming experience do you have?'], options: [
    ['new', '🌱', ['はじめて', 'None yet'], ['よく使うブロックだけを表示し、ヒントを出します', 'Shows only common blocks, with hints']],
    ['some', '🌿', ['少しある', 'A little'], ['すべてのブロックを表示し、ヒントも出します', 'Shows every block, with hints']],
    ['pro', '🌳', ['慣れている', 'Experienced'], ['すべてのブロックと、問題の一覧を表示します', 'Shows every block and the problem list']]] },
  { id: 'focus', q: ['画面の配分は？', 'How should the screen be split?'], options: [
    ['blocks', '🧱', ['ブロック中心', 'Mostly blocks'], ['コードは小さめに表示', 'A smaller code view']],
    ['half', '⚖️', ['半分ずつ', 'Half and half'], ['ブロックとコードを同じくらいに', 'Blocks and code about the same']],
    ['code', '📝', ['コード中心', 'Mostly code'], ['C# をしっかり読みたい人向け', 'For reading the C# closely']]] },
  { id: 'unity', q: ['使っている Unity のバージョンは？', 'Which Unity version do you use?'], options: [
    ['6', '🎮', ['Unity 6 以降', 'Unity 6 or later'], ['わからないときはこちら', 'Choose this if unsure']],
    ['2022', '🕹', ['Unity 2022 / 2023', 'Unity 2022 / 2023'], ['少し前のバージョン', 'An earlier version']]] },
  { id: 'theme', q: ['画面の明るさは？', 'Which brightness do you prefer?'], options: [
    ['auto', '🌓', ['自動', 'Auto'], ['パソコンの設定に合わせる', 'Follow the system setting']],
    ['light', '☀', ['ライト', 'Light'], ['明るい画面', 'A bright screen']],
    ['dark', '🌙', ['ダーク', 'Dark'], ['暗い画面', 'A dark screen']]] },
];
const FOCUS_SIDE = { blocks: 32, half: 48, code: 60 };
let setupStep = 0, setupAnswers = {};
function currentAnswers() {
  const focus = layout.side < 40 ? 'blocks' : layout.side > 54 ? 'code' : 'half';
  return { level: beginner ? 'new' : 'some', focus, unity: typeof unityVer !== 'undefined' ? unityVer : '6', theme: themeMode };
}
function openSetup() {
  setupStep = 0; setupAnswers = currentAnswers();
  renderSetup();
  const dlg = document.getElementById('welcomeDlg');
  if (!dlg.open) dlg.showModal();
}
function renderSetup() {
  const body = document.getElementById('welcomeBody'), n = SETUP_STEPS.length;
  const dots = `<div class="setup-dots">${[...SETUP_STEPS, null].map((s, i) => `<span class="${i === setupStep ? 'on' : i < setupStep ? 'done' : ''}"></span>`).join('')}</div>`;
  if (setupStep >= n) {   // 最後: 始め方を選ぶ (はじめての案内)
    body.innerHTML = dots + `<h2>🎉 ${pick(['準備ができました', 'All set'])}</h2>`
      + `<p>${pick(['ブロックを組み合わせて、Unity の C# スクリプトを作れます。右側には本物の C# がリアルタイムで表示されます。答えた内容は、設定の「一般」→「初期設定をやり直す」でいつでも変えられます。',
        'Build Unity C# scripts by snapping blocks together; real C# appears on the right as you go. You can redo these answers any time from Settings → General.'])}</p>`
      + `<div class="welcome-actions"><button class="primary" data-w="learn">📚 ${pick(['チュートリアルで学ぶ', 'Learn with tutorials'])}</button>`
      + `<button data-w="tpl">${pick(['テンプレートから始める', 'Start from a template'])}</button><button data-w="free">${pick(['自由に作る', 'Build freely'])}</button></div>`
      + `<div class="row"><button data-setup="back">← ${pick(['戻る', 'Back'])}</button></div>`;
    return;
  }
  const s = SETUP_STEPS[setupStep];
  body.innerHTML = dots + `<p class="setup-count">${setupStep + 1} / ${n}</p><h2>${esc(pick(s.q))}</h2><div class="setup-options">`
    + s.options.map(([v, ic, l, d]) => `<button class="setup-opt${setupAnswers[s.id] === v ? ' on' : ''}" data-opt="${v}" aria-pressed="${setupAnswers[s.id] === v}">`
      + `<span class="setup-ic">${ic}</span><b>${esc(pick(l))}</b><small>${esc(pick(d))}</small></button>`).join('') + '</div>'
    + `<div class="row setup-nav">${setupStep ? `<button data-setup="back">← ${pick(['戻る', 'Back'])}</button>` : ''}<span class="grow"></span>`
    + `<button data-setup="skip">${pick(['あとで', 'Skip'])}</button><button class="primary" data-setup="next">${pick(['次へ', 'Next'])} →</button></div>`;
}
// 答えを画面に反映する (選ぶたびにすぐ反映するので、結果を見ながら選べる)
function applySetup() {
  const a = setupAnswers;
  setBeginner(a.level === 'new');
  setSideSize(FOCUS_SIDE[a.focus] || 40);
  if (typeof setUnityVer === 'function' && a.unity !== unityVer) setUnityVer(a.unity);
  if (a.theme !== themeMode) setThemeMode(a.theme);
  showPanel(a.level === 'pro' ? 'issues' : 'hints');
}
document.getElementById('welcomeBody').addEventListener('click', e => {
  const opt = e.target.closest('[data-opt]'), nav = e.target.closest('[data-setup]')?.dataset.setup;
  if (opt) { setupAnswers[SETUP_STEPS[setupStep].id] = opt.dataset.opt; applySetup(); renderSetup(); return; }
  if (nav === 'back') setupStep = Math.max(0, setupStep - 1);
  if (nav === 'next') { applySetup(); setupStep++; }
  if (nav === 'skip') { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (err) {} document.getElementById('welcomeDlg').close(); return; }
  if (nav) renderSetup();
}, true);
// はじめての案内は、この質問に置き換える (最後の「始め方」ボタンは learn.js が受け取る)
openWelcome = openSetup;

// ---------- カテゴリの右クリック (しまう・並べ替え) ----------
const FOLDER_ID = 'folded-categories';
const catKey = c => c.pack ? 'pack:' + c.pack : c.name;
// ツールボックスのカテゴリに、並び順としまったカテゴリを反映する (refreshToolbox から呼ぶ)
function arrangeToolbox(contents) {
  const keyed = contents.map(c => ({ ...c, toolboxitemid: c.toolboxitemid || catKey(c) }));
  const pos = k => { const i = layout.order.indexOf(k); return i < 0 ? 1e6 : i; };
  keyed.sort((a, b) => pos(a.toolboxitemid) - pos(b.toolboxitemid) || contents.indexOf(contents.find(c => catKey(c) === a.toolboxitemid)) - contents.indexOf(contents.find(c => catKey(c) === b.toolboxitemid)));
  const shown = keyed.filter(c => !layout.folded.includes(c.toolboxitemid)), folded = keyed.filter(c => layout.folded.includes(c.toolboxitemid));
  if (folded.length) shown.push({ kind: 'category', name: pick([`📁 しまったカテゴリ (${folded.length})`, `📁 Folded (${folded.length})`]), toolboxitemid: FOLDER_ID, colour: '#8a8f98', contents: folded, expanded: false });
  return shown;
}
const catMenu = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'catMenu', className: 'menu-panel', hidden: true }));
ws.getInjectionDiv().addEventListener('contextmenu', e => {
  const tb = ws.getToolbox(), row = e.target.closest('.blocklyToolboxCategory');
  if (!tb || !row) return;
  const item = tb.getToolboxItems().find(it => it.getDiv && it.getDiv() && it.getDiv().contains(row) && it.getDiv() === row);
  if (!item) return;
  e.preventDefault(); e.stopPropagation();
  const id = item.getId(), isFolder = id === FOLDER_ID, folded = layout.folded.includes(id);
  const keys = activeToolbox.contents.map(c => c.toolboxitemid).filter(k => k && k !== FOLDER_ID), i = keys.indexOf(id);
  const items = isFolder ? [['unfoldAll', '📂', pick(['すべて取り出す', 'Unfold all'])]] : [
    folded ? ['unfold', '📂', pick(['取り出す (折りたたみを戻す)', 'Unfold'])] : ['fold', '📁', pick(['しまう (折りたたむ)', 'Fold away'])],
    ['top', '⤒', pick(['いちばん上へ', 'Move to top']), folded || i <= 0], ['up', '↑', pick(['上へ', 'Move up']), folded || i <= 0],
    ['down', '↓', pick(['下へ', 'Move down']), folded || i < 0 || i >= keys.length - 1],
    ['reset', '↺', pick(['カテゴリの並びを元に戻す', 'Reset categories'])]];
  catMenu.innerHTML = items.map(([a, ic, lb, off]) => `<button data-cat="${a}" ${off ? 'disabled' : ''}><span class="ic">${ic}</span><span class="lb">${esc(lb)}</span></button>`).join('');
  catMenu.hidden = false;
  catMenu.style.left = Math.min(e.clientX, innerWidth - catMenu.offsetWidth - 8) + 'px';
  catMenu.style.top = Math.min(e.clientY, innerHeight - catMenu.offsetHeight - 8) + 'px';
  catMenu.onclick = ev => {
    const a = ev.target.closest('[data-cat]')?.dataset.cat;
    if (!a) return;
    catMenu.hidden = true;
    const move = to => { keys.splice(to, 0, keys.splice(i, 1)[0]); layout.order = keys; };
    if (a === 'fold') layout.folded = [...layout.folded, id];
    if (a === 'unfold') layout.folded = layout.folded.filter(k => k !== id);
    if (a === 'unfoldAll') layout.folded = [];
    if (a === 'top') move(0);
    if (a === 'up') move(i - 1);
    if (a === 'down') move(i + 1);
    if (a === 'reset') { layout.order = []; layout.folded = []; }
    saveLayout(); refreshToolbox();
  };
}, true);
document.addEventListener('pointerdown', e => { if (!catMenu.hidden && !catMenu.contains(e.target)) catMenu.hidden = true; }, true);

// ---------- ミニマップ (ブロック画面の右上) ----------
const minimap = Object.assign(document.createElement('canvas'), { id: 'minimap' });
minimap.title = pick(['ミニマップ: クリック・ドラッグでその場所へ移動', 'Minimap: click or drag to move there']);
leftEl.appendChild(minimap);
function drawMinimap() {
  cancelAnimationFrame(minimapFrame);
  minimapFrame = requestAnimationFrame(() => {
    const tutorOpen = !document.getElementById('tutor').hidden;
    minimap.hidden = !layout.minimap || tutorOpen || !ws.getTopBlocks(false).length;
    if (minimap.hidden) return;
    minimap.style.top = (document.getElementById('tabs').offsetHeight + 10) + 'px';
    const small = leftEl.clientWidth < 640, W = small ? 120 : 180, H = small ? 80 : 120, dpr = devicePixelRatio || 1;   // ブロック画面が狭いときは小さく
    if (minimap.width !== W * dpr || minimap.height !== H * dpr) { minimap.width = W * dpr; minimap.height = H * dpr; minimap.style.width = W + 'px'; minimap.style.height = H + 'px'; }
    const view = ws.getMetricsManager().getViewMetrics(true), rects = ws.getTopBlocks(false).map(b => [b.getBoundingRectangle(), b.getColour()]);
    let l = view.left, t = view.top, r = view.left + view.width, btm = view.top + view.height;
    for (const [rc] of rects) { l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.right); btm = Math.max(btm, rc.bottom); }
    const pad = 20, scale = Math.min((W - 8) / (r - l + pad * 2), (H - 8) / (btm - t + pad * 2));
    const ox = (W - (r - l) * scale) / 2 - l * scale, oy = (H - (btm - t) * scale) / 2 - t * scale;
    minimapGeo = { scale, ox, oy };
    const c = minimap.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    const errIds = new Set(issues.filter(x => x.block && x.level === 'error').map(x => x.block.getRootBlock().id));
    for (const [rc, col] of rects) { c.fillStyle = col; c.globalAlpha = 0.85; c.fillRect(ox + rc.left * scale, oy + rc.top * scale, Math.max(2, (rc.right - rc.left) * scale), Math.max(2, (rc.bottom - rc.top) * scale)); }
    c.globalAlpha = 1;
    // エラーのあるブロックの場所に赤い印
    for (const b of ws.getTopBlocks(false)) if (errIds.has(b.id)) { const rc = b.getBoundingRectangle(); c.strokeStyle = '#ff3b3b'; c.lineWidth = 2; c.strokeRect(ox + rc.left * scale - 1, oy + rc.top * scale - 1, (rc.right - rc.left) * scale + 2, (rc.bottom - rc.top) * scale + 2); }
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f6fe4';
    c.lineWidth = 1.5;
    c.strokeRect(ox + view.left * scale, oy + view.top * scale, view.width * scale, view.height * scale);
  });
}
// ミニマップの位置 → その場所が画面の真ん中に来るようにスクロール
function minimapJump(e) {
  if (!minimapGeo) return;
  const r = minimap.getBoundingClientRect(), { scale, ox, oy } = minimapGeo;
  const x = (e.clientX - r.left - ox) / scale, y = (e.clientY - r.top - oy) / scale, view = ws.getMetricsManager().getViewMetrics(true);
  ws.scroll(ws.scrollX - (x - (view.left + view.width / 2)) * ws.scale, ws.scrollY - (y - (view.top + view.height / 2)) * ws.scale);
  drawMinimap();
}
minimap.addEventListener('pointerdown', e => {
  e.preventDefault(); minimap.setPointerCapture(e.pointerId); minimapJump(e);
  const move = ev => minimapJump(ev);
  minimap.addEventListener('pointermove', move);
  minimap.addEventListener('pointerup', () => minimap.removeEventListener('pointermove', move), { once: true });
});
ws.addChangeListener(e => { if (!e.isUiEvent || e.type === Blockly.Events.VIEWPORT_CHANGE) drawMinimap(); });
window.addEventListener('resize', drawMinimap);
function setMinimap(on) { layout.minimap = on; saveLayout(); drawMinimap(); }

// ---------- エラーのあるブロックを赤く (警告は黄色) ----------
function markIssueBlocks() {
  markedBlocks.forEach(b => b.getSvgRoot && b.getSvgRoot() && b.getSvgRoot().classList.remove('ubc-error', 'ubc-warn'));
  markedBlocks = [];
  for (const x of issues) {
    if (!x.block || !x.block.getSvgRoot || x.block.isDeadOrDying() || !x.block.getSvgRoot()) continue;
    const root = x.block.getSvgRoot();
    if (x.level === 'error') { root.classList.remove('ubc-warn'); root.classList.add('ubc-error'); }
    else if (!root.classList.contains('ubc-error')) root.classList.add('ubc-warn');
    markedBlocks.push(x.block);
  }
  drawMinimap();
}

// 設定の「一般」タブ: 初期設定・ミニマップ・幅
function layoutSettings() {
  return `<section><h3>🖥 ${pick(['画面の配置', 'Layout'])}</h3>`
    + `<div class="set-row"><span>${pick(['初期設定 (いくつかの質問に答えて、画面を合わせる)', 'Setup (answer a few questions to fit the screen to you)'])}</span><button data-layout="setup">${pick(['初期設定をやり直す', 'Run setup again'])}</button></div>`
    + `<label class="set-row"><span>🗺 ${pick(['ミニマップを表示 (ブロック画面の右上)', 'Show the minimap (top right of the blocks)'])}</span><input type="checkbox" data-layout="minimap" ${layout.minimap ? 'checked' : ''}></label>`
    + `<div class="set-row"><span>${pick(['コード画面の幅', 'Code view width'])}: ${Math.round(layout.side)}% <small class="hint">${pick(['(仕切りをドラッグして変えられます)', '(drag the divider to change it)'])}</small></span><button data-layout="resetSide">${pick(['元に戻す', 'Reset'])}</button></div></section>`;
}
document.getElementById('settingsBody').addEventListener('click', e => {
  const b = e.target.closest('[data-layout]');
  if (!b || b.type === 'checkbox') return;
  if (b.dataset.layout === 'setup') { document.getElementById('settingsDlg').close(); openSetup(); }
  if (b.dataset.layout === 'resetSide') { setSideSize(40); renderSettings(); }
});
document.getElementById('settingsBody').addEventListener('change', e => { if (e.target.dataset.layout === 'minimap') setMinimap(e.target.checked); });
setSideSize(layout.side, false);
refreshToolbox();
drawMinimap();
