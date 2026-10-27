// 自動テスト: ブラウザ (Chromium) でアプリを開いて、主な機能を確かめる。
// 使い方: npm ci && npx playwright install chromium && npm test
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ubc-test-'));
const VERSION = fs.readFileSync(path.join(ROOT, 'js/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];

let failed = 0, passed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else failed++;
  console.log(`${ok ? '  ✔' : '  ✖'} ${name}${ok || !detail ? '' : `\n      ${String(detail).slice(0, 600)}`}`);
  // GitHub Actions では、失敗をプルリクエストや実行結果の画面に注釈として出す
  if (!ok && process.env.GITHUB_ACTIONS) console.log(`::error title=${name.replace(/[:,\n]/g, ' ')}::${String(detail || name).replace(/\n/g, ' ').slice(0, 600)}`);
}

// 静的ファイルのサーバー (リポジトリの外は返さない)
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

// 新しいページを開く (はじめての案内は出さない)。外部への通信は止めて数える
async function open(browser, base, lang, init = {}, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 }, ...opts });
  await ctx.addInitScript(([l, extra]) => {
    localStorage.setItem('unity-block-coder-welcomed', '1');
    localStorage.setItem('unity-block-coder-lang', l);
    localStorage.setItem('unity-block-coder-seen-version', extra.__version);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    window.confirm = () => true;
  }, [lang, { __version: VERSION, ...init }]);
  const page = await ctx.newPage();
  // SLOW=4 などで CPU を遅くして、遅いマシンでの動きを確かめる
  if (process.env.SLOW) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: +process.env.SLOW });
  page.errors = []; page.external = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if (/^(https?:\/\/127\.0\.0\.1|data:|blob:)/.test(u)) return r.continue();
    page.external.push(u); return r.abort();
  });
  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => typeof tsParser !== 'undefined' && tsParser, null, { timeout: 30000 });
  return page;
}

async function langTests(browser, base, lang) {
  console.log(`\n[${lang}] 基本`);
  const p = await open(browser, base, lang);

  check('バージョンが表示される', await p.evaluate(() => /^\d+\.\d+\.\d+$/.test(APP_VERSION) && document.getElementById('appVersion').textContent === 'v' + APP_VERSION));
  check('起動時にエラーがない', !p.errors.length, p.errors.join(' / '));
  check('外部への通信がない (オフラインで動く)', !p.external.length, p.external.join(' / '));

  const tb = await p.evaluate(() => {
    const errs = []; let n = 0;
    for (const c of toolbox.contents) for (const it of c.contents || []) {
      if (it.kind !== 'block') continue;
      n++;
      try { const b = Blockly.serialization.blocks.append(it.type ? { type: it.type, inputs: it.inputs, fields: it.fields } : it, ws); cs.init(ws); cs.blockToCode(b); b.dispose(); }
      catch (e) { errs.push(`${it.type}: ${e.message}`); }
    }
    return { n, errs };
  });
  check(`ツールボックスの全ブロック (${tb.n} 個) を作って C# にできる`, tb.n > 100 && !tb.errs.length, tb.errs.join(' / '));

  for (const f of fs.readdirSync(FIX).filter(f => f.endsWith('.cs'))) {
    const src = fs.readFileSync(path.join(FIX, f), 'utf8');
    const r = await p.evaluate(s => {
      const r = importCs(s, false); update(); const c1 = code;
      importCs(c1, false); update();
      return { raws: r.log.map(x => x.code), same: s.trim() === c1.trim(), stable: c1 === code, errors: issues.filter(i => i.level === 'error').map(i => i.msg) };
    }, src);
    check(`${f}: 読み込みで「C# 文 / 式」ブロックにならない`, !r.raws.length, r.raws.join(' / '));
    check(`${f}: 読み込み → 生成をくり返しても同じ C#${f.startsWith('hand') ? '' : ' (元のコードとも同じ)'}`, r.stable && (f.startsWith('hand') || r.same));
    check(`${f}: エラーがない`, !r.errors.length, r.errors.join(' / '));
  }

  const tpl = await p.evaluate(() => TEMPLATES.map((t, i) => {
    const r = importCs(tr(t.code), false); update(); const c1 = code;
    importCs(c1, false); update();
    return { i, raws: r.log.length, stable: c1 === code, errors: issues.filter(x => x.level === 'error').length };
  }).filter(x => x.raws || !x.stable || x.errors));
  check('テンプレートがすべてそのまま読み込めて、エラーがない', !tpl.length, JSON.stringify(tpl));

  const tut = await p.evaluate(() => {
    const bad = [];
    for (const t of TUTORIALS) {
      try {
        startTutorial(t);
        t.steps.forEach((s, i) => { if (s.check) s.check(code); if (i > 0 && s.check && s.check(code) && t.steps[i - 1].check) bad.push(`${t.id}: ${i} は最初から完了`); });
      } catch (e) { bad.push(`${t.id}: ${e.message}`); }
    }
    return bad;
  });
  check(`チュートリアルが始められて、判定が動く`, !tut.length, tut.join(' / '));

  if (lang === 'en') {
    const jp = await p.evaluate(() => {
      const re = /[぀-ヿ一-龯]/, out = [];
      for (const el of document.querySelectorAll('body *:not(script):not(style)'))
        for (const n of el.childNodes) if (n.nodeType === 3 && re.test(n.textContent) && !el.closest('#code,textarea,.ed-hl')) out.push(n.textContent.trim().slice(0, 30));
      for (const c of toolbox.contents) if (re.test(c.name || '')) out.push(c.name);
      for (const t of Object.keys(Blockly.Blocks)) { const h = HELP[t]; if (h && re.test(h.name[1] + h.desc[1])) out.push(t); }
      return out;
    });
    check('英語表示で日本語が残っていない', !jp.length, jp.join(' / '));
  }
  check('テスト中にエラーがない', !p.errors.length, p.errors.join(' / '));
  await p.context().close();
}

async function featureTests(browser, base) {
  console.log('\n[ja] 拡張パック・保存・共有・履歴・マイブロック・C# 編集');
  const p = await open(browser, base, 'ja');
  await p.evaluate(() => document.getElementById('sample').click());

  // 拡張パック
  const packFile = path.join(tmp, 'mypack.json'), badFile = path.join(tmp, 'bad.json');
  fs.writeFileSync(packFile, JSON.stringify({ id: 'my-pack', name: 'テスト', blocks: [{ type: 'my_log_warn', label: 'warn {MSG}', code: 'Debug.LogWarning({MSG});', inputs: { MSG: { type: 'string', example: { text: 'hi' } } } }] }));
  fs.writeFileSync(badFile, JSON.stringify({ id: 'bad pack', blocks: [] }));
  await p.click('#settingsBtn');
  await p.setInputFiles('#settingsBody [data-pack-file]', packFile); await p.waitForTimeout(300);
  check('拡張パックを読み込める', await p.evaluate(() => !!PACK_BLOCKS.my_log_warn && toolbox.contents.some(c => c.pack === 'my-pack')));
  await p.setInputFiles('#settingsBody [data-pack-file]', badFile); await p.waitForTimeout(300);
  check('形式が正しくない拡張パックは断る', await p.evaluate(() => /形式/.test(document.getElementById('packMsg').textContent) && !PACKS.some(x => x.id === 'bad pack')));
  await p.click('#settingsClose');
  check('拡張パックのブロックとして C# を読み込める', await p.evaluate(() => {
    importCs('using UnityEngine;\npublic class A : MonoBehaviour\n{\n    void Start()\n    {\n        Debug.LogWarning("x");\n    }\n}\n', false); update();
    return ws.getAllBlocks(false).some(x => x.type === 'my_log_warn') && code.includes('Debug.LogWarning("x");');
  }));
  await p.evaluate(() => document.getElementById('sample').click());

  // ② プロジェクトファイル
  await p.evaluate(() => newTab());
  const dl = p.waitForEvent('download');
  await p.evaluate(() => saveProjectFile());
  const projFile = path.join(tmp, 'project.json');
  await (await dl).saveAs(projFile);
  const proj = JSON.parse(fs.readFileSync(projFile, 'utf8'));
  check('プロジェクトを保存できる (全タブ)', proj.format === 'unity-block-coder-project' && proj.files.length === 2);
  await p.evaluate(() => { project.files.length = 1; project.active = 0; loadActive(); });
  const chooser = p.waitForEvent('filechooser');
  p.evaluate(() => openProjectFile());
  await (await chooser).setFiles(projFile); await p.waitForTimeout(500);
  check('プロジェクトを開ける', await p.evaluate(() => project.files.length === 2));
  await p.evaluate(() => { project.active = 0; loadActive(); });

  // ③ URL で共有
  const share = await p.evaluate(async () => `${location.href.split('#')[0]}#share=${await deflateB64(JSON.stringify({ format: PROJECT_FORMAT, version: 1, files: [{ name: 'Shared.cs', state: project.files[0].state }] }))}`);
  const p2 = await open(browser, base, 'ja');
  await p2.goto(share); await p2.waitForTimeout(1500);
  check('共有リンクを開くと新しいタブで読み込まれる', await p2.evaluate(() => project.files.length === 2 && project.active === 1 && !location.hash && code.includes('class')));
  await p2.context().close();

  // ④ 編集履歴
  const n = await p.evaluate(() => ws.getAllBlocks(false).length);
  await p.evaluate(() => document.getElementById('clear').click()); await p.waitForTimeout(200);
  await p.evaluate(() => openHistory());
  await p.click('#historyDlg [data-h="restore"][data-i="0"]'); await p.waitForTimeout(300);
  check('全消去の前の状態に履歴から戻せる', await p.evaluate(() => ws.getAllBlocks(false).length) === n);
  await p.evaluate(() => ws.undo(false)); await p.waitForTimeout(200);
  check('履歴から戻したのを取り消せる', await p.evaluate(() => ws.getAllBlocks(false).length) === 0);
  await p.evaluate(() => ws.undo(false)); await p.waitForTimeout(200);

  // ⑤ マイブロック
  await p.evaluate(() => { Blockly.dialog.setPrompt((m, d, cb) => cb('テスト')); addSnippet(ws.getTopBlocks(true)[0].getInputTargetBlock('BODY') || ws.getTopBlocks(true)[0], true); });
  check('マイブロックを登録するとツールボックスに出る', await p.evaluate(() => toolbox.contents.some(c => c.name === SNIPPET_CAT()) || ws.getToolbox().getToolboxItems().some(it => it.getName && it.getName() === SNIPPET_CAT())));
  check('マイブロックが保存される', await p.evaluate(() => JSON.parse(localStorage.getItem(SNIPPET_KEY)).some(s => s.name === 'テスト')));

  // ⑦ C# を直接編集
  const shown = () => p.evaluate(() => ['csEditor', 'edBar', 'editLock'].map(id => getComputedStyle(document.getElementById(id)).display !== 'none'));
  check('編集していないときは C# 編集画面とブロックのカバーが見えない', (await shown()).every(x => !x));
  await p.evaluate(() => setEditMode(true));
  check('編集中は C# 編集画面とブロックのカバーが見える', (await shown()).every(x => x));
  await p.evaluate(() => { const t = document.querySelector('#csEditor textarea'); t.value = t.value.replace(/(void Start\(\)\s*\{)/, '$1\n        int lives = 3;'); checkEditor(); });
  check('編集中は「ブロックに反映」が押せる', await p.evaluate(() => !document.querySelector('#edBar [data-ed="apply"]').disabled));
  await p.evaluate(() => applyEditor());
  check('編集した C# がブロックに反映される', await p.evaluate(() => code.includes('int lives = 3;') && ws.getAllBlocks(false).some(b => b.getField('NAME') && b.getFieldValue('NAME') === 'lives')));
  await p.evaluate(() => { const t = document.querySelector('#csEditor textarea'); t.value = t.value.replace('int lives = 3;', 'int lives = ;'); checkEditor(); });
  check('構文エラーがある間は反映できない', await p.evaluate(() => document.querySelector('#edBar [data-ed="apply"]').disabled && document.querySelectorAll('#csEditor .ln.err').length === 1));
  await p.evaluate(() => setEditMode(false));
  check('編集を終わると C# 編集画面とブロックのカバーが消える', (await shown()).every(x => !x));

  // ⑥ PWA
  await p.click('#settingsBtn');
  check('設定画面にバージョンが出る', await p.evaluate(() => document.getElementById('settingsBody').innerText.includes('v' + APP_VERSION)));
  await p.click('#settingsClose');
  check('manifest がある (アプリとしてインストール)', await p.evaluate(async () => !!document.querySelector('link[rel=manifest]') && (await (await fetch('manifest.webmanifest')).json()).icons.length > 0));

  check('テスト中にエラーがない', !p.errors.length, p.errors.join(' / '));
  await p.context().close();
}

async function qolTests(browser, base) {
  console.log('\n[ja] Assets 保存・貼り付け・折りたたみ・Unity バージョン・ヒント・比較・タブ・表示・更新');
  const p = await open(browser, base, 'ja');
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await ev(() => document.getElementById('sample').click());

  // ① Assets フォルダに保存 (フォルダ選択の代わりに、メモリ上のフォルダを使う)
  await ev(() => {
    const files = window.__files = { 'PlayerController.cs': 'old' };
    const dir = { name: 'Scripts', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async (n, o) => { if (!(n in files) && !(o && o.create)) throw new Error('NotFound');
        return { createWritable: async () => { let t = ''; return { write: async s => { t += s; }, close: async () => { files[n] = t; } }; } }; } };
    window.showDirectoryPicker = async () => dir;
    window.__asked = 0; window.confirm = () => { window.__asked++; return true; };
  });
  await ev(() => chooseAssetsFolder());
  await p.keyboard.press('Control+s'); await p.waitForTimeout(300);
  check('Ctrl+S で Assets フォルダに .cs を保存する', await ev(() => window.__files['PlayerController.cs'] === code));
  check('アプリが書いていない同名ファイルは、上書きの前に確認する', await ev(() => window.__asked === 1));
  await ev(() => saveToAssets()); await p.waitForTimeout(200);
  check('2 回目からは確認せずに上書きする', await ev(() => window.__asked === 1));
  await ev(() => { newTab(); }); await ev(() => saveAllToAssets()); await p.waitForTimeout(300);
  check('全タブを Assets に保存できる', await ev(() => Object.keys(window.__files).length === 2));
  await ev(() => { closeTab(project.active); window.confirm = () => true; });

  // ② C# の貼り付け・コピー
  const paste = text => p.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, text);
  await ev(() => Blockly.common.setSelected(ws.getAllBlocks(false).find(b => b.type === 'unity_event' && f(b, 'EVENT') === 'Start()')));
  await paste('int lives = 3;\nDebug.Log("hi " + lives);');
  check('文の C# を貼り付けると、選んだメソッドの中にブロックとして入る', await ev(() => /void Start\(\)\s*\{[^}]*int lives = 3;\s*Debug\.Log\("hi " \+ lives\);\s*\}/.test(code)));
  await ev(() => ws.undo(false));
  check('貼り付けは取り消せる', await ev(() => { update(); return !code.includes('int lives'); }));
  await ev(() => Blockly.common.setSelected(ws.getAllBlocks(false).find(b => b.type === 'class_def' && f(b, 'BASE') === 'MonoBehaviour')));
  await paste('public int score;\nvoid AddScore(int n) { score += n; }');
  check('メンバーの C# を貼り付けると、選んだクラスに入る', await ev(() => code.includes('public int score;') && /void AddScore\(int n\)/.test(code) && !issues.some(i => i.level === 'error')));
  await ev(() => Blockly.common.setSelected(null));
  await paste('public class Coin : MonoBehaviour { void Start() { Destroy(gameObject, 2f); } }');
  check('クラスの C# を貼り付けられる', await ev(() => code.includes('public class Coin : MonoBehaviour')));
  check('ブロックの C# をコピーできる', await ev(() => blockCs(ws.getAllBlocks(false).find(b => b.type === 'debug_log')).startsWith('Debug.Log(')));
  await ev(() => document.getElementById('sample').click());

  // ⑥ 折りたたみ・整列
  await ev(() => collapseAll(true));
  check('メソッドをまとめて折りたためる', await ev(() => ws.getAllBlocks(false).filter(b => b.isCollapsed()).length >= 2));
  await ev(() => ws.undo(false));
  check('折りたたみは 1 回の取り消しで戻る', await ev(() => !ws.getAllBlocks(false).some(b => b.isCollapsed())));
  await ev(() => { collapseAll(true); collapseAll(false); tidyUp(); });
  check('すべて開く・整列ができる', await ev(() => !ws.getAllBlocks(false).some(b => b.isCollapsed())));

  // ⑦ Unity バージョン
  const tpl = await ev(() => TEMPLATES.findIndex(t => t.code.includes('rb.velocity')));
  await ev(i => { importCs(tr(TEMPLATES[i].code), false); update(); }, tpl);
  check('Unity 6 では古い API (velocity) を警告する', await ev(() => issues.some(i => i.level === 'warn' && /linearVelocity/.test(i.msg) && i.fixes)));
  await ev(() => adaptUnityVersion(true));
  check('Unity 6 の書き方にそろえられる', await ev(() => { update(); return code.includes('rb.linearVelocity') && !/\.velocity\b/.test(code) && !issues.some(i => /linearVelocity/.test(i.msg)); }));
  await ev(() => { importCs('using UnityEngine;\npublic class B : MonoBehaviour\n{\n    void Update()\n    {\n        GetComponent<Rigidbody2D>().velocity = Vector2.zero;\n    }\n}\n', false); update(); });
  check('GetComponent<Rigidbody2D>().velocity のような書き方も警告して直せる', await ev(() => { const w = issues.some(i => /linearVelocity/.test(i.msg)); adaptUnityVersion(true); update(); return w && code.includes('GetComponent<Rigidbody2D>().linearVelocity'); }));
  await ev(i => { importCs(tr(TEMPLATES[i].code), false); adaptUnityVersion(true); update(); }, tpl);
  await ev(() => setUnityVer('2022'));
  check('Unity 2022 では linearVelocity をエラーにする', await ev(() => issues.some(i => i.level === 'error' && /linearVelocity/.test(i.msg))));
  check('ツールボックスの例も選んだバージョンに合わせる', await ev(() => JSON.stringify(activeToolbox).includes('"rb.velocity"')));
  await ev(() => setUnityVer('6'));
  await ev(i => { document.getElementById('templates').click(); document.querySelector(`.tpl[data-i="${i}"]`).click(); }, tpl);
  await p.waitForTimeout(300);
  check('テンプレートは選んだバージョンの書き方で開く', await ev(() => code.includes('linearVelocity') && !/\.velocity\b/.test(code)));
  await ev(() => closeTab(project.active));

  // ⑧ 性能のヒント
  await ev(() => { importCs('using UnityEngine;\npublic class A : MonoBehaviour\n{\n    void Update()\n    {\n        GetComponent<Rigidbody>().AddForce(Vector3.up);\n        GetComponent<Rigidbody>().mass = 2;\n    }\n}\n', false); ws.clearUndo(); update(); renderHints(); });
  await ev(() => document.querySelector('#hints [data-fix]').click());
  check('Update の GetComponent を「Start で 1 回だけ取得」に書き換える', await ev(() => { update(); return /private Rigidbody rb;\s*void Start\(\)\s*\{\s*rb = GetComponent<Rigidbody>\(\);/.test(code) && (code.match(/GetComponent/g) || []).length === 1 && !issues.length; }));
  await ev(() => ws.undo(false));
  check('書き換えは 1 回の取り消しで戻る', await ev(() => { update(); return (code.match(/GetComponent<Rigidbody>\(\)/g) || []).length === 2 && !code.includes('private Rigidbody'); }));

  // ⑨ 変更点の比較
  await ev(() => showDiff('a\nb\nc', 'a\nB\nc\nd', ['before', 'after']));
  check('変更点を比較できる', await ev(() => [...document.querySelectorAll('#diffDlg .df')].map(d => d.className.replace('df', '').trim() || '=').join(',') === '=,del,add,=,add'));
  await ev(() => diffDlg.close());
  await ev(() => { document.getElementById('sample').click(); takeSnapshot('test', true); document.getElementById('clear').click(); openHistory(); });
  await p.click('#historyDlg [data-h="diff"][data-i="0"]');
  check('履歴と今の状態を比較できる', await ev(() => diffDlg.open && document.querySelectorAll('#diffDlg .df.del').length > 10));
  await ev(() => { diffDlg.close(); historyDlg.close(); document.getElementById('sample').click(); });
  await p.waitForTimeout(200);

  // C# 編集の反映を取り消せる
  await ev(() => { setEditMode(true); const t = document.querySelector('#csEditor textarea'); t.value = t.value.replace(/(void Start\(\)\s*\{)/, '$1\n        int x = 1;'); checkEditor(); applyEditor(); setEditMode(false); });
  await p.waitForTimeout(100);   // ブロックの変更は少し遅れて取り消しの記録に入る
  const n = await ev(() => ws.getAllBlocks(false).length);
  await ev(() => ws.undo(false));
  check('C# 編集の反映を取り消すと元に戻る (ブロックが重ならない)', await ev(n => { update(); return !code.includes('int x = 1;') && ws.getAllBlocks(false).length < n; }, n));

  // ⑫ タブ
  await ev(() => duplicateTab());
  check('タブを複製できる (クラス名が重ならない)', await ev(() => project.files.length === 2 && project.files[1].name === 'PlayerControllerCopy.cs' && code.includes('class PlayerControllerCopy')));
  await ev(() => closeTab(project.active));
  await p.keyboard.press('Alt+Shift+T'); await p.waitForTimeout(200);
  check('閉じたタブを開き直せる (Alt+Shift+T)', await ev(() => project.files.length === 2 && project.active === 1 && fileName === 'PlayerControllerCopy.cs'));
  await ev(() => moveTab(1, 0));
  check('タブを並べ替えられる', await ev(() => project.files[0].name === 'PlayerControllerCopy.cs' && project.active === 0));
  await p.click('.tab[data-i="1"]', { button: 'right' });
  check('タブの右クリックメニューが出る', await ev(() => !document.getElementById('tabMenu').hidden && document.querySelectorAll('#tabMenu [data-tab]').length === 5));
  await p.click('#tabMenu [data-tab="dup"]');
  check('右クリックメニューから複製できる', await ev(() => project.files.length === 3));

  // ⑬ 表示
  await ev(() => { setDisplay('code', 16); setDisplay('blocks', 1.25); });
  check('C# の文字サイズとブロックの大きさを変えられる', await ev(() => getComputedStyle(document.getElementById('code')).fontSize === '16px' && ws.scale === 1.25));
  await ev(() => openSettings());
  check('設定画面に Unity バージョン・Assets・表示の欄がある', await ev(() => ['data-set="unityVer"', 'data-assets="choose"', 'data-display="code"', 'data-display="blocks"'].every(s => document.getElementById('settingsBody').innerHTML.includes(s))));
  await ev(() => settingsDlg.close());

  check('テスト中にエラーがない', !p.errors.length, p.errors.join(' / '));
  await p.context().close();

  // キーボードでのコピー・貼り付け (本物のクリップボードを使う)
  const p3 = await open(browser, base, 'ja', {}, { permissions: ['clipboard-read', 'clipboard-write'] });
  const pos = await p3.evaluate(() => { const r = ws.getAllBlocks(false).find(x => x.type === 'debug_log').getSvgRoot().getBoundingClientRect(); return { x: r.x + 12, y: r.y + 10 }; });
  await p3.mouse.click(pos.x, pos.y); await p3.keyboard.press('Control+c'); await p3.waitForTimeout(200);
  check('ブロックを Ctrl+C すると C# もクリップボードに入る', /^Debug\.Log\(/.test(await p3.evaluate(() => navigator.clipboard.readText())));
  const before = await p3.evaluate(() => ws.getAllBlocks(false).length);
  await p3.keyboard.press('Control+v'); await p3.waitForTimeout(300);
  check('Ctrl+V でコピーしたブロックを貼り付けられる', await p3.evaluate(n => ws.getAllBlocks(false).length > n, before));
  await p3.evaluate(() => navigator.clipboard.writeText('float boost = 2f;'));
  await p3.mouse.click(pos.x, pos.y); await p3.keyboard.press('Control+v'); await p3.waitForTimeout(300);
  check('ほかでコピーした C# を Ctrl+V でブロックにできる', await p3.evaluate(() => code.includes('float boost = 2f;')));
  await p3.click('#search'); await p3.keyboard.press('Control+v');
  check('入力欄ではふつうに文字が貼り付けられる', await p3.evaluate(() => document.getElementById('search').value === 'float boost = 2f;'));
  check('テスト中にエラーがない (キーボード)', !p3.errors.length, p3.errors.join(' / '));
  await p3.context().close();

  // ⑩ 新しくなった点 (前の版を使っていた人にだけ出る)
  const p2 = await open(browser, base, 'en', { 'unity-block-coder-seen-version': '0.0.1' });
  await p2.waitForTimeout(1000);
  check('更新したあとに「新しくなった点」を表示する', await p2.evaluate(() => document.getElementById('whatsNewDlg').open && document.querySelectorAll('#whatsNewDlg li').length > 0 && !/[\u3040-\u30ff]/.test(document.getElementById('whatsNewDlg').innerText)));
  check('一度見たら次からは出ない', await p2.evaluate(() => localStorage.getItem('unity-block-coder-seen-version') === APP_VERSION));
  await p2.context().close();
}

(async () => {
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const lang of ['ja', 'en']) await langTests(browser, base, lang);
    await featureTests(browser, base);
    await qolTests(browser, base);
  } catch (e) { failed++; console.log('  ✖ ' + e.stack); if (process.env.GITHUB_ACTIONS) console.log(`::error title=テストが止まりました::${String(e.stack).replace(/\n/g, ' ').slice(0, 900)}`); }
  await browser.close(); server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} 件成功 / ${failed} 件失敗`);
  process.exit(failed ? 1 : 0);
})();
