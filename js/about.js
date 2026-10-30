// 設定の「詳細」タブ: このアプリについて・更新履歴・ドキュメント (README など)・キーボード操作・このブラウザで使える機能
const REPO_URL = 'https://github.com/kusam0ch1dayo/Unity-Block-Coder';
const DOCS = [['README.md', ['使い方 (README)', 'Guide (README)']], ['docs/block-packs.md', ['拡張パックの作り方', 'Making block packs']]];
let aboutDoc = null;   // 開いているドキュメントのパス

// かんたんな Markdown の表示 (見出し・段落・箇条書き・表・コード・太字・リンク)。先に HTML をエスケープするので安全
function renderMarkdown(md, base) {
  const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
      const url = /^(https?:|#)/.test(u) ? u : `${REPO_URL}/blob/main/${base}${u}`;
      return /^https?:/.test(url) ? `<a href="${url}" target="_blank" rel="noopener">${t}</a>` : t;
    });
  const out = [], lines = md.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l)) { const code = []; while (++i < lines.length && !/^```/.test(lines[i])) code.push(lines[i]); out.push(`<pre class="md-code">${esc(code.join('\n'))}</pre>`); continue; }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); continue; }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim())));
      i--;
      out.push(`<table>${rows.map((r, k) => `<tr>${r.map(c => k ? `<td>${c}</td>` : `<th>${c}</th>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), items = [];
      for (; i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]); i++) items.push(inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')));
      i--;
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${x}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (!l.trim()) continue;
    const para = [l];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|```|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i + 1])) para.push(lines[++i]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}
async function showDoc(path) {
  aboutDoc = path;
  const el = document.getElementById('aboutDoc');
  if (!el) return;
  el.innerHTML = `<p class="hint">${pick(['読み込み中…', 'Loading…'])}</p>`;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(res.status);
    el.innerHTML = renderMarkdown(await res.text(), path.includes('/') ? path.replace(/[^/]+$/, '') : '');
  } catch (e) {
    // パソコン内のファイルとして開いたとき (file://) は読み込めないので、GitHub のページを案内する
    el.innerHTML = `<p class="hint">${pick(['このページの開き方では読み込めませんでした。GitHub で読めます:', 'Could not load it here. Read it on GitHub:'])} `
      + `<a href="${REPO_URL}/blob/main/${path}" target="_blank" rel="noopener">${esc(path)}</a></p>`;
  }
}

function storageInfo() {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('unity-block-coder')) bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; }
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
const ABOUT_KEYS = [
  ['Ctrl+Z / Ctrl+Y', ['取り消し / やり直し', 'Undo / redo']], ['Ctrl+S', ['Unity の Assets に保存 (対応していないブラウザでは .cs をダウンロード)', 'Save to Unity Assets (downloads the .cs where unsupported)']],
  ['Ctrl+C / Ctrl+V', ['ブロックのコピー (C# もコピー) / 貼り付け (C# はブロックになる)', 'Copy blocks (also as C#) / paste (C# becomes blocks)']],
  ['Ctrl+K', ['ブロック検索', 'Search blocks']], ['Ctrl+Shift+P / F1', ['コマンドパレット', 'Command palette']],
  ['F8 / Shift+F8', ['次 / 前のエラー・警告へ', 'Next / previous error or warning']], ['F2', ['名前の一括変更', 'Rename everywhere']],
  ['Alt+Shift+T', ['閉じたタブを開き直す', 'Reopen closed tab']], ['Tab', ['名前や型の補完', 'Complete names and types']],
  ['Ctrl+Enter', ['C# の直接編集: ブロックに反映', 'C# editor: apply to blocks']], ['Delete', ['選んだブロックを削除', 'Delete the selected block']],
];
function aboutSettings() {
  const yes = ok => ok ? `<span class="feat on">✔ ${pick(['使える', 'Yes'])}</span>` : `<span class="feat">— ${pick(['使えない', 'No'])}</span>`;
  const running = matchMedia('(display-mode: standalone)').matches ? pick(['インストールしたアプリ', 'Installed app']) : location.protocol === 'file:' ? pick(['パソコン内のファイル', 'Local file']) : pick(['ブラウザ', 'Browser']);
  return `<section><h3>${pick(['このアプリについて', 'About'])}</h3>`
    + `<div class="set-row"><span>${pick(['バージョン', 'Version'])}</span><b>v${APP_VERSION}</b></div>`
    + `<div class="set-row"><span>${pick(['開き方', 'Running as'])}</span><span>${running}</span></div>`
    + `<div class="set-row"><span>${pick(['このブラウザに保存しているデータ', 'Data saved in this browser'])}</span><span>${storageInfo()} · ${project.files.length} ${pick(['タブ', 'tabs'])} · ${snippets.length} ${pick(['マイブロック', 'My blocks'])} · ${snapshots.length} ${pick(['履歴', 'snapshots'])}</span></div>`
    + `<div class="set-row"><span>${pick(['ソースコード・不具合の報告', 'Source code and issues'])}</span><span class="row"><a href="${REPO_URL}" target="_blank" rel="noopener">GitHub</a><a href="${REPO_URL}/issues/new/choose" target="_blank" rel="noopener">Issues</a><a href="${REPO_URL}/releases" target="_blank" rel="noopener">Releases</a></span></div>`
    + `<div class="set-row"><span>${pick(['ライセンス', 'License'])}</span><span>MIT · Blockly (Apache-2.0) · web-tree-sitter / tree-sitter-c-sharp (MIT)</span></div></section>`
    + `<section><h3>${pick(['バージョン更新履歴', 'Version history'])}</h3><div class="changelog">`
    + Object.entries(CHANGES).map(([v, list]) => `<details${v === APP_VERSION ? ' open' : ''}><summary><b>v${esc(v)}</b>${v === APP_VERSION ? ` <span class="badge">${pick(['今の版', 'current'])}</span>` : ''}</summary>`
      + `<ul>${list.map(c => `<li>${esc(pick(c))}</li>`).join('')}</ul></details>`).join('') + '</div></section>'
    + `<section><h3>${pick(['ドキュメント', 'Documents'])}</h3><div class="seg doc-tabs">${DOCS.map(([path, label]) => `<button data-doc="${path}" class="${path === aboutDoc ? 'on' : ''}">${esc(pick(label))}</button>`).join('')}</div>`
    + `<div id="aboutDoc" class="md">${aboutDoc ? '' : `<p class="hint">${pick(['読みたいドキュメントを選んでください。', 'Choose a document to read.'])}</p>`}</div></section>`
    + `<section><h3>${pick(['キーボード操作', 'Keyboard shortcuts'])}</h3>${ABOUT_KEYS.map(([k, l]) => `<div class="set-row"><span>${esc(pick(l))}</span><kbd>${esc(k)}</kbd></div>`).join('')}</section>`
    + `<section><h3>${pick(['このブラウザで使える機能', 'Supported in this browser'])}</h3>`
    + `<div class="set-row"><span>${pick(['Unity の Assets に直接保存', 'Save straight to Unity Assets'])}</span>${yes(typeof assetsSupported !== 'undefined' && assetsSupported)}</div>`
    + `<div class="set-row"><span>${pick(['クリップボード (コピー・貼り付け)', 'Clipboard (copy / paste)'])}</span>${yes(!!navigator.clipboard)}</div>`
    + `<div class="set-row"><span>${pick(['オフラインで使う', 'Works offline'])}</span>${yes(!!navigator.serviceWorker?.controller)}</div>`
    + `<div class="set-row"><span>${pick(['アプリとしてインストール', 'Install as an app'])}</span>${yes(location.protocol.startsWith('http') && 'serviceWorker' in navigator)}</div>`
    + `<p class="hint">${pick(['「使えない」ものは、Chrome / Edge で GitHub Pages の公開ページを開くと使えるようになります。', 'Features marked "No" work in Chrome / Edge on the published GitHub Pages site.'])}</p></section>`;
}
// ドキュメントの切り替え (タブを描き直したあとも、開いていたものを表示する)
document.getElementById('settingsBody').addEventListener('click', e => {
  const b = e.target.closest('[data-doc]');
  if (!b) return;
  document.querySelectorAll('#settingsBody [data-doc]').forEach(x => x.classList.toggle('on', x === b));
  showDoc(b.dataset.doc);
});
new MutationObserver(() => { const el = document.getElementById('aboutDoc'); if (el && aboutDoc && !el.dataset.loaded) { el.dataset.loaded = '1'; showDoc(aboutDoc); } })
  .observe(document.getElementById('settingsBody'), { childList: true });
