// 自動テスト: ブラウザ (Chromium) でアプリを開いて、主な機能を確かめる。
// 使い方: npm ci && npx playwright install chromium && npm test
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown' };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ubc-test-'));

let failed = 0, passed = 0;
function check(name, ok, detail = '') {
  if (ok) passed++; else failed++;
  console.log(`${ok ? '  ✔' : '  ✖'} ${name}${ok || !detail ? '' : `\n      ${String(detail).slice(0, 600)}`}`);
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
async function open(browser, base, lang, init = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
  await ctx.addInitScript(([l, extra]) => {
    localStorage.setItem('unity-block-coder-welcomed', '1');
    localStorage.setItem('unity-block-coder-lang', l);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    window.confirm = () => true;
  }, [lang, init]);
  const page = await ctx.newPage();
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
  check('manifest がある (アプリとしてインストール)', await p.evaluate(async () => !!document.querySelector('link[rel=manifest]') && (await (await fetch('manifest.webmanifest')).json()).icons.length > 0));

  check('テスト中にエラーがない', !p.errors.length, p.errors.join(' / '));
  await p.context().close();
}

(async () => {
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const lang of ['ja', 'en']) await langTests(browser, base, lang);
    await featureTests(browser, base);
  } catch (e) { failed++; console.log('  ✖ ' + e.stack); }
  await browser.close(); server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} 件成功 / ${failed} 件失敗`);
  process.exit(failed ? 1 : 0);
})();
