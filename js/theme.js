// ワークスペースのダークモード (自動 → ライト → ダーク の順に切り替え。自動は OS の設定に合わせる)
const THEME_KEY = 'unity-block-coder-theme';
const darkTheme = Blockly.Theme.defineTheme('ubc-dark', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#1a1b1f', toolboxBackgroundColour: '#1f2126', toolboxForegroundColour: '#d8dae0',
    flyoutBackgroundColour: '#2a2c32', flyoutForegroundColour: '#d8dae0', flyoutOpacity: 0.96,
    scrollbarColour: '#4a4d55', scrollbarOpacity: 0.7, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3, cursorColour: '#d0d0d0',
  },
});
const lightTheme = Blockly.Theme.defineTheme('ubc-light', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#fbfbfc', toolboxBackgroundColour: '#ffffff', toolboxForegroundColour: '#1d1f23',
    flyoutBackgroundColour: '#eef0f4', flyoutForegroundColour: '#1d1f23', flyoutOpacity: 0.97, scrollbarColour: '#b9bec8', scrollbarOpacity: 0.6,
  },
});
const THEME_LABEL = { auto: tr('🌓 自動'), light: tr('☀ ライト'), dark: tr('🌙 ダーク') };
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let themeMode = 'auto';
try { themeMode = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
function applyTheme() {
  const dark = themeMode === 'dark' || (themeMode === 'auto' && darkQuery.matches);
  if (themeMode === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = themeMode;
  document.documentElement.classList.toggle('ws-dark', dark);
  ws.setTheme(dark ? darkTheme : lightTheme);
  document.getElementById('theme').textContent = THEME_LABEL[themeMode];
}
document.getElementById('theme').onclick = () => {
  themeMode = { auto: 'light', light: 'dark', dark: 'auto' }[themeMode];
  try { localStorage.setItem(THEME_KEY, themeMode); } catch (e) {}
  applyTheme();
};
darkQuery.addEventListener('change', () => themeMode === 'auto' && applyTheme());
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
