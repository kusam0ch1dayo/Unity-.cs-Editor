// テーマ: 表示モード (自動 / ライト / ダーク)・テーマカラー・コードの配色・自分で選んだ色
// 色は CSS 変数 (--accent など) で決めているので、ここで変数を上書きすると画面全体の色が変わる
const THEME_KEY = 'unity-block-coder-theme', COLORS_KEY = 'unity-block-coder-colors';
const THEME_LABEL = { auto: tr('🌓 自動'), light: tr('☀ ライト'), dark: tr('🌙 ダーク') };
// テーマカラー: [名前, ライト用のアクセント色, ダーク用のアクセント色]
const PALETTES = {
  blue: [['ブルー', 'Blue'], '#2f6fe4', '#6b95ea'], sky: [['スカイ', 'Sky'], '#0891d1', '#38bdf8'], mint: [['ミント', 'Mint'], '#0d9f74', '#34d399'],
  green: [['グリーン', 'Green'], '#2f9a3e', '#5fd37a'], orange: [['オレンジ', 'Orange'], '#e2620b', '#fb923c'], sakura: [['サクラ', 'Sakura'], '#d6407f', '#f472b6'],
  purple: [['パープル', 'Purple'], '#7c4ddb', '#a78bfa'], gray: [['グレー', 'Gray'], '#4b5563', '#9ca3af'],
};
// 自分で変えられる色 (CSS 変数名, 表示名)
const CUSTOM_COLORS = [['accent', ['アクセント', 'Accent']], ['bg', ['背景', 'Background']], ['panel', ['パネル', 'Panels']], ['fg', ['文字', 'Text']], ['code-bg', ['コードの背景', 'Code background']]];
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let themeMode = 'auto', colors = { palette: 'blue', code: 'auto', vivid: 'vivid', custom: { light: {}, dark: {} } };
try { themeMode = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
try { const c = JSON.parse(localStorage.getItem(COLORS_KEY)); if (c) colors = { ...colors, ...c, custom: { light: {}, dark: {}, ...(c.custom || {}) } }; } catch (e) {}
const saveColors = () => { try { localStorage.setItem(COLORS_KEY, JSON.stringify(colors)); } catch (e) {} };
const isDark = () => themeMode === 'dark' || (themeMode === 'auto' && darkQuery.matches);

const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = c => '#' + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgbHex(hexRgb(a).map((x, i) => x + (hexRgb(b)[i] - x) * t));   // a と b を t の割合で混ぜる
const alpha = (h, a) => `rgba(${hexRgb(h).join(', ')}, ${a})`;
const luminance = h => { const [r, g, b] = hexRgb(h).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// 今の色 (テーマカラーと、自分で選んだ色をまとめたもの)
function themeColors() {
  const dark = isDark(), pal = PALETTES[colors.palette] || PALETTES.blue, accent = dark ? pal[2] : pal[1];
  const base = dark ? { accent, bg: '#15161a', panel: '#1f2126', fg: '#e6e7ea' }
    : { accent, bg: mix('#f7f8fb', accent, 0.035), panel: '#ffffff', fg: '#1d1f23' };   // ライトは背景にアクセント色を少しだけ混ぜる
  return { ...base, ...colors.custom[dark ? 'dark' : 'light'] };
}
// Blockly 標準のブロック (if・ループ・数値・文字など) の色。標準の色相のまま、鮮やかさの設定に合わせて作る
const STYLE_HUES = { logic: 210, loop: 120, math: 230, text: 160, list: 260, colour: 20, variable: 330, variable_dynamic: 310, procedure: 290 };
const blockStyles = () => Object.fromEntries(Object.entries(STYLE_HUES).map(([k, h]) => [k + '_blocks', { colourPrimary: Blockly.utils.colour.hueToHex(h) }]));
const categoryStyles = () => Object.fromEntries(Object.entries(STYLE_HUES).map(([k, h]) => [k + '_category', { colour: Blockly.utils.colour.hueToHex(h) }]));
function applyTheme() {
  const dark = isDark(), c = themeColors(), root = document.documentElement;
  if (themeMode === 'auto') delete root.dataset.theme; else root.dataset.theme = themeMode;
  root.classList.toggle('ws-dark', dark);
  // コードの配色: 画面に合わせる / 明るい / 暗い。コードの背景を自分で選んだときは、その明るさで決める
  const codeDark = c['code-bg'] ? luminance(c['code-bg']) < 0.4 : colors.code === 'auto' ? dark : colors.code === 'dark';
  root.dataset.code = codeDark ? 'dark' : 'light';
  const vars = {
    '--accent': c.accent, '--accent-weak': alpha(c.accent, dark ? 0.18 : 0.12), '--accent-fg': luminance(c.accent) > 0.55 ? '#111' : '#fff',
    '--bg': c.bg, '--panel': c.panel, '--fg': c.fg, '--muted': mix(c.fg, c.panel, 0.42), '--border': mix(c.panel, c.fg, dark ? 0.16 : 0.12),
    '--hover': alpha(c.fg, dark ? 0.07 : 0.05),
  };
  if (c['code-bg']) Object.assign(vars, { '--code-bg': c['code-bg'], '--code-bar': mix(c['code-bg'], codeDark ? '#ffffff' : '#000000', 0.04), '--code-line': mix(c['code-bg'], codeDark ? '#ffffff' : '#000000', 0.09) });
  for (const k of ['--code-bg', '--code-bar', '--code-line']) root.style.removeProperty(k);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.accent);
  // ブロックの作業場所の色もそろえる
  ws.setTheme(Blockly.Theme.defineTheme(dark ? 'ubc-dark' : 'ubc-light', { base: Blockly.Themes.Classic, blockStyles: blockStyles(), categoryStyles: categoryStyles(), componentStyles: {
    workspaceBackgroundColour: mix(c.bg, c.panel, dark ? 0.3 : 0.7), toolboxBackgroundColour: c.panel, toolboxForegroundColour: c.fg,
    flyoutBackgroundColour: mix(c.bg, c.fg, dark ? 0.06 : 0.03), flyoutForegroundColour: c.fg, flyoutOpacity: 0.97,
    scrollbarColour: mix(c.panel, c.fg, 0.35), scrollbarOpacity: 0.6, insertionMarkerColour: dark ? '#ffffff' : '#000000', insertionMarkerOpacity: 0.3, cursorColour: c.fg } }));
  document.getElementById('theme').textContent = THEME_LABEL[themeMode];
}
function setThemeMode(m) { themeMode = m; try { localStorage.setItem(THEME_KEY, m); } catch (e) {} applyTheme(); }
document.getElementById('theme').onclick = () => setThemeMode({ auto: 'light', light: 'dark', dark: 'auto' }[themeMode]);
darkQuery.addEventListener('change', () => themeMode === 'auto' && applyTheme());

// 設定画面の「テーマ」タブ
function themeSettings() {
  const dark = isDark(), c = themeColors(), mode = dark ? 'dark' : 'light', custom = colors.custom[mode];
  const seg = (key, cur, items) => `<div class="seg" role="radiogroup">${items.map(([v, l]) => `<button data-theme-set="${key}" data-v="${v}" class="${v === cur ? 'on' : ''}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</div>`;
  return `<section><h3>${pick(['表示モード', 'Mode'])}</h3>`
    + `<div class="set-row"><span>${pick(['明るさ', 'Brightness'])}</span>${seg('mode', themeMode, [['auto', THEME_LABEL.auto], ['light', THEME_LABEL.light], ['dark', THEME_LABEL.dark]])}</div>`
    + `<div class="set-row"><span>${pick(['ブロックの色', 'Block colors'])}</span>${seg('vivid', colors.vivid || 'vivid', [['calm', pick(['落ち着いた', 'Calm'])], ['vivid', pick(['鮮やか', 'Vivid'])], ['max', pick(['とても鮮やか', 'Very vivid'])]])}</div>`
    + `<div class="set-row"><span>${pick(['コードの配色', 'Code colors'])}</span>${seg('code', colors.code, [['auto', pick(['画面に合わせる', 'Match'])], ['light', pick(['明るい', 'Light'])], ['dark', pick(['暗い', 'Dark'])]])}</div></section>`
    + `<section><h3>${pick(['テーマカラー', 'Theme color'])}</h3><div class="swatches">`
    + Object.entries(PALETTES).map(([id, [name, l, d]]) => `<button class="swatch${id === colors.palette ? ' on' : ''}" data-theme-set="palette" data-v="${id}" title="${esc(pick(name))}" aria-pressed="${id === colors.palette}">`
      + `<span style="background:${dark ? d : l}"></span>${esc(pick(name))}</button>`).join('') + '</div></section>'
    + `<section><h3>${pick([`色を細かく変える (${dark ? 'ダーク' : 'ライト'}用)`, `Custom colors (${dark ? 'dark' : 'light'} mode)`])}</h3>`
    + `<p class="hint">${pick(['ここで選んだ色は、今の明るさ (ライト / ダーク) のときだけ使われます。', 'These colors are used only in the current mode (light / dark).'])}</p>`
    + CUSTOM_COLORS.map(([k, l]) => `<label class="set-row"><span>${esc(pick(l))}${custom[k] ? ' <small class="changed">●</small>' : ''}</span><span class="row">`
      + `<input type="color" data-color="${k}" value="${k === 'code-bg' ? custom[k] || getComputedStyle(document.documentElement).getPropertyValue('--code-bg').trim() : c[k]}">`
      + (custom[k] ? `<button data-color-reset="${k}" title="${pick(['元に戻す', 'Reset'])}">↺</button>` : '') + '</span></label>').join('')
    + `<div class="row end"><button data-theme-set="resetAll">${pick(['テーマを初期設定に戻す', 'Reset theme'])}</button></div></section>`;
}
// 鮮やかさを変えたら、置いてあるブロックとツールボックスを作り直して新しい色にする (ID は同じなので取り消しの記録はそのまま使える)
function recolorBlocks() {
  applyTheme();
  const state = Blockly.serialization.workspaces.save(ws);
  Blockly.Events.disable();
  try { ws.clear(); Blockly.serialization.workspaces.load(state, ws); } finally { Blockly.Events.enable(); }
  refreshToolbox();
  update();
}
// 設定画面での操作 (click / change / input)。扱ったら true
function handleThemeSettings(e) {
  const t = e.target, b = t.closest && t.closest('[data-theme-set]'), col = t.dataset && t.dataset.color, reset = t.closest && t.closest('[data-color-reset]');
  const mode = isDark() ? 'dark' : 'light';
  if (col && (e.type === 'input' || e.type === 'change')) {
    colors.custom[mode][col] = t.value; saveColors(); applyTheme();
    if (e.type === 'change') renderSettings();
    return true;
  }
  if (e.type !== 'click') return false;
  if (reset) { delete colors.custom[mode][reset.dataset.colorReset]; saveColors(); applyTheme(); renderSettings(); return true; }
  if (!b) return false;
  const key = b.dataset.themeSet, v = b.dataset.v;
  if (key === 'mode') setThemeMode(v);
  if (key === 'code') colors.code = v;
  if (key === 'vivid') { colors.vivid = v; setBlockVivid(v); saveColors(); recolorBlocks(); }
  if (key === 'palette') { colors.palette = v; delete colors.custom[mode].accent; }
  if (key === 'resetAll' && confirm(pick(['テーマの設定をすべて初期設定に戻しますか？', 'Reset all theme settings?']))) {
    colors = { palette: 'blue', code: 'auto', vivid: 'vivid', custom: { light: {}, dark: {} } }; setBlockVivid('vivid'); setThemeMode('auto'); recolorBlocks();
  }
  saveColors(); applyTheme(); renderSettings();
  return true;
}
document.getElementById('settingsBody').addEventListener('input', e => { if (e.target.dataset.color) handleThemeSettings(e); });
applyTheme();

// ---------- 文字とブロックの大きさ ----------
const DISPLAY_KEY = 'unity-block-coder-display';
let display = { code: 13, blocks: 0.75 };
try { display = { ...display, ...JSON.parse(localStorage.getItem(DISPLAY_KEY)) }; } catch (e) {}
function applyDisplay(scaleBlocks = true) {
  document.documentElement.style.setProperty('--code-size', display.code + 'px');
  if (scaleBlocks) ws.setScale(display.blocks);
}
function setDisplay(key, value) {
  display[key] = +value;
  try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(display)); } catch (e) {}
  applyDisplay(key === 'blocks');
}
function displaySettings() {
  const sel = (key, values, fmt) => `<select data-display="${key}">${values.map(v => `<option value="${v}" ${v === display[key] ? 'selected' : ''}>${fmt(v)}</option>`).join('')}</select>`;
  return `<label class="set-row"><span>🔠 ${pick(['C# の文字サイズ', 'C# font size'])}</span>${sel('code', [11, 12, 13, 14, 16, 18, 20], v => v + 'px')}</label>`
    + `<label class="set-row"><span>🧱 ${pick(['ブロックの大きさ (はじめの倍率)', 'Block size (starting zoom)'])}</span>${sel('blocks', [0.5, 0.6, 0.75, 0.9, 1, 1.1, 1.25, 1.5], v => Math.round(v * 100) + '%')}</label>`;
}
applyDisplay();
