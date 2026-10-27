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
