// ワークスペースのダークモード (自動 → ライト → ダーク の順に切り替え。自動は OS の設定に合わせる)
const THEME_KEY = 'unity-block-coder-theme';
const darkTheme = Blockly.Theme.defineTheme('ubc-dark', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#1b1c20', toolboxBackgroundColour: '#232429', toolboxForegroundColour: '#d8dae0',
    flyoutBackgroundColour: '#2a2c32', flyoutForegroundColour: '#d8dae0', flyoutOpacity: 0.96,
    scrollbarColour: '#4a4d55', scrollbarOpacity: 0.7, insertionMarkerColour: '#ffffff', insertionMarkerOpacity: 0.3, cursorColour: '#d0d0d0',
  },
});
const THEME_LABEL = { auto: '🌓 自動', light: '☀ ライト', dark: '🌙 ダーク' };
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let themeMode = 'auto';
try { themeMode = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) {}
function applyTheme() {
  const dark = themeMode === 'dark' || (themeMode === 'auto' && darkQuery.matches);
  if (themeMode === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = themeMode;
  document.documentElement.classList.toggle('ws-dark', dark);
  ws.setTheme(dark ? darkTheme : Blockly.Themes.Classic);
  document.getElementById('theme').textContent = THEME_LABEL[themeMode];
}
document.getElementById('theme').onclick = () => {
  themeMode = { auto: 'light', light: 'dark', dark: 'auto' }[themeMode];
  try { localStorage.setItem(THEME_KEY, themeMode); } catch (e) {}
  applyTheme();
};
darkQuery.addEventListener('change', () => themeMode === 'auto' && applyTheme());
applyTheme();
