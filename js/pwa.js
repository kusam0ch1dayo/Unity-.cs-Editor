// アプリとしてインストール (PWA)。http(s) で開いたときだけ使える (file:// では不可)
let installPrompt = null;
if (location.protocol.startsWith('http')) {
  document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest', href: 'manifest.webmanifest' }));
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; if (typeof refreshShortcuts === 'function') refreshShortcuts(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; showToast(pick(['アプリとしてインストールしました', 'Installed as an app']), 3000); });
}
async function installApp() {
  if (!installPrompt) {
    showToast(location.protocol.startsWith('http')
      ? pick(['このブラウザではインストールできないか、すでにインストール済みです。Chrome / Edge のアドレスバーのインストールボタンも試してください。',
        'Installing is not available in this browser or the app is already installed. Also try the install button in the Chrome / Edge address bar.'])
      : pick(['インストールは、GitHub Pages などで公開したページ (https) から行えます。', 'Install from the published page (https), e.g. GitHub Pages.']), 6000);
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
}

// ---------- 更新のお知らせ ----------
// 新しい版が公開されると、サービスワーカーが入れ替わる。そのとき「再読み込み」を出す (30 分ごとにも確認する)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000)).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;   // はじめて開いたときは知らせない
    showToast(pick(['新しいバージョンがあります。再読み込みすると更新されます (作業内容は保存されています)', 'A new version is available. Reload to update (your work is saved)']), 600000,
      [{ label: pick(['再読み込み', 'Reload']), run: () => { saveProject(); location.reload(); } }]);
  });
}

// ---------- 新しくなった点 ----------
const SEEN_VERSION_KEY = 'unity-block-coder-seen-version';
const whatsNewDlg = document.body.appendChild(Object.assign(document.createElement('dialog'), { id: 'whatsNewDlg' }));
function openWhatsNew() {
  whatsNewDlg.innerHTML = `<div class="settings-head"><h2>✨ ${pick([`v${APP_VERSION} の新しくなった点`, `What's new in v${APP_VERSION}`])}</h2><button data-close>${tr('閉じる')}</button></div>`
    + `<ul class="tips">${(CHANGES[APP_VERSION] || []).map(c => `<li>${esc(pick(c))}</li>`).join('')}</ul>`
    + `<p class="hint"><a href="https://github.com/kusam0ch1dayo/Unity-Block-Coder/releases" target="_blank" rel="noopener">${pick(['これまでの更新内容 (GitHub Releases)', 'All release notes (GitHub Releases)'])}</a></p>`;
  whatsNewDlg.showModal();
}
whatsNewDlg.onclick = e => { if (e.target.closest('[data-close]') || e.target === whatsNewDlg) whatsNewDlg.close(); };
(() => {
  let seen = null;
  try { seen = localStorage.getItem(SEEN_VERSION_KEY); localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch (e) { return; }
  // はじめて使う人には出さない (はじめての案内が出るため)。前に使っていた人が新しい版を開いたときだけ
  if (seen && seen !== APP_VERSION && CHANGES[APP_VERSION]) setTimeout(openWhatsNew, 600);
  else if (!seen && localStorage.getItem('unity-block-coder-welcomed')) setTimeout(openWhatsNew, 600);   // バージョン表示より前から使っている人
})();
