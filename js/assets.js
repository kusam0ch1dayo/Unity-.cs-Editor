// Unity の Assets フォルダに直接保存する (Chrome / Edge のファイル保存機能)。
// 一度フォルダを選べば、次からは Ctrl+S で .cs を上書き保存できる。フォルダの情報はブラウザの中 (IndexedDB) にだけ保存する
const assetsSupported = typeof window.showDirectoryPicker === 'function';
const assets = { dir: null, written: new Set() };   // written: このアプリが書いたファイル名 (はじめて上書きするときだけ確認する)

const idb = (() => {
  let db = null;
  const open = () => db || (db = new Promise((ok, ng) => {
    const r = indexedDB.open('unity-block-coder', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result); r.onerror = () => ng(r.error);
  }));
  const run = (mode, fn) => open().then(d => new Promise((ok, ng) => {
    const t = d.transaction('kv', mode), req = fn(t.objectStore('kv'));
    t.oncomplete = () => ok(req.result); t.onerror = () => ng(t.error);
  }));
  return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)), del: k => run('readwrite', s => s.delete(k)) };
})();

async function loadAssetsFolder() {
  if (!assetsSupported) return;
  try {
    const saved = await idb.get('assets');
    if (saved) { assets.dir = saved.dir; assets.written = new Set(saved.written || []); }
  } catch (e) {}
}
const saveAssetsState = () => idb.set('assets', { dir: assets.dir, written: [...assets.written] }).catch(() => {});

async function chooseAssetsFolder() {
  if (!assetsSupported) {
    showToast(pick(['このブラウザはフォルダへの直接保存に対応していません。Chrome か Edge を使ってください。(「.cs を保存」でダウンロードはできます)',
      'This browser cannot save to a folder directly. Use Chrome or Edge. ("Save .cs" still downloads the file)']), 6000);
    return false;
  }
  try {
    assets.dir = await window.showDirectoryPicker({ id: 'unity-assets', mode: 'readwrite' });
  } catch (e) { return false; }   // キャンセル
  assets.written = new Set();
  await saveAssetsState();
  showToast(pick([`保存先を「${assets.dir.name}」にしました。Ctrl+S でここに保存します`, `Saving to "${assets.dir.name}". Press Ctrl+S to save here`]), 4000);
  if (typeof refreshShortcuts === 'function') refreshShortcuts();
  return true;
}
async function forgetAssetsFolder() {
  assets.dir = null; assets.written = new Set();
  await idb.del('assets').catch(() => {});
}
async function assetsPermission() {
  const opt = { mode: 'readwrite' };
  if (await assets.dir.queryPermission(opt) === 'granted') return true;
  return await assets.dir.requestPermission(opt) === 'granted';
}

// files: [{ name, text }]。保存できた数を返す
async function writeToAssets(files) {
  if (!assets.dir && !(await chooseAssetsFolder())) return 0;
  try {
    if (!(await assetsPermission())) { showToast(pick(['フォルダへの書き込みが許可されませんでした', 'Writing to the folder was not allowed']), 4000); return 0; }
    let n = 0;
    for (const fl of files) {
      // このアプリが書いていない同名のファイルは、上書きしてよいか確認する (Unity 側で作ったスクリプトを消さないように)
      if (!assets.written.has(fl.name)) {
        let exists = true;
        try { await assets.dir.getFileHandle(fl.name); } catch (e) { exists = false; }
        if (exists && !confirm(pick([`「${assets.dir.name}」に ${fl.name} がすでにあります。上書きしますか？`, `${fl.name} already exists in "${assets.dir.name}". Overwrite it?`]))) continue;
      }
      const w = await (await assets.dir.getFileHandle(fl.name, { create: true })).createWritable();
      await w.write(fl.text); await w.close();
      assets.written.add(fl.name); n++;
    }
    await saveAssetsState();
    if (n) showToast(pick([`「${assets.dir.name}」に保存しました: ${files.filter(x => assets.written.has(x.name)).map(x => x.name).join(', ')}`,
      `Saved to "${assets.dir.name}": ${files.filter(x => assets.written.has(x.name)).map(x => x.name).join(', ')}`]), 3000);
    return n;
  } catch (e) {
    showToast(pick([`保存できませんでした: ${e.message}`, `Could not save: ${e.message}`]), 5000, [{ label: pick(['保存先を選び直す', 'Choose another folder']), run: chooseAssetsFolder }]);
    return 0;
  }
}
// Ctrl+S: 対応ブラウザなら Assets フォルダに、それ以外はダウンロード
function saveToAssets() {
  if (!assetsSupported) return document.getElementById('dl').click();
  saveProject();
  return writeToAssets([{ name: fileName, text: code }]);
}
const saveAllToAssets = () => writeToAssets(allScripts());

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveToAssets(); }
});

// 設定画面の「Unity の Assets に保存」欄
function assetsSettings() {
  return `<section><h3>🎮 ${pick(['Unity の Assets に保存', 'Save to Unity Assets'])}</h3>`
    + (assetsSupported
      ? `<div class="set-row"><span>${pick(['保存先', 'Folder'])}: <b>${assets.dir ? esc(assets.dir.name) : pick(['未選択', 'Not chosen'])}</b></span><span class="row">`
        + `<button data-assets="choose">${pick(['フォルダを選ぶ', 'Choose folder'])}</button>${assets.dir ? `<button data-assets="forget">${pick(['解除', 'Forget'])}</button>` : ''}</span></div>`
        + `<p class="hint">${pick(['Unity プロジェクトの Assets (または Assets/Scripts) を選ぶと、Ctrl+S でそこに .cs を保存します。Unity に切り替えると自動で読み込まれます。',
          'Choose Assets (or Assets/Scripts) of your Unity project and Ctrl+S saves the .cs there. Unity reloads it when you switch back.'])}</p>`
      : `<p class="hint">${pick(['このブラウザは対応していません (Chrome / Edge で使えます)。Ctrl+S は .cs のダウンロードになります。', 'Not supported in this browser (use Chrome / Edge). Ctrl+S downloads the .cs instead.'])}</p>`)
    + '</section>';
}
async function handleAssetsSettings(e) {
  const b = e.target.closest && e.target.closest('[data-assets]');
  if (!b) return false;
  if (b.dataset.assets === 'choose') await chooseAssetsFolder();
  if (b.dataset.assets === 'forget') await forgetAssetsFolder();
  renderSettings();
  return true;
}
loadAssetsFolder();
