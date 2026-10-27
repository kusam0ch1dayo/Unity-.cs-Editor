// 変更点の比較 (2 つの C# を行ごとに比べて、増えた行・消えた行を色付きで表示する)
function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n'), n = A.length, m = B.length;
  // 最長共通部分列 (LCS) の表。スクリプトは長くても数千行なので、この方法で十分速い
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: ' ', s: A[i], a: ++i, b: ++j }); }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', s: A[i], a: ++i });
    else out.push({ t: '+', s: B[j], b: ++j });
  }
  while (i < n) out.push({ t: '-', s: A[i], a: ++i });
  while (j < m) out.push({ t: '+', s: B[j], b: ++j });
  return out;
}
const diffDlg = document.body.appendChild(Object.assign(document.createElement('dialog'), { id: 'diffDlg' }));
// before / after: 比べる C#。labels: [前の名前, 後の名前]
function showDiff(before, after, labels) {
  const d = diffLines(before, after), add = d.filter(x => x.t === '+').length, del = d.filter(x => x.t === '-').length;
  // 変わった行の前後 3 行だけ表示し、ほかは折りたたむ
  const show = d.map((x, k) => d.slice(Math.max(0, k - 3), k + 4).some(y => y.t !== ' '));
  let html = '', skipped = 0;
  d.forEach((x, k) => {
    if (!show[k]) { skipped++; return; }
    if (skipped) { html += `<div class="df-skip">⋯ ${pick([`${skipped} 行は同じ`, `${skipped} unchanged lines`])}</div>`; skipped = 0; }
    html += `<div class="df ${x.t === '+' ? 'add' : x.t === '-' ? 'del' : ''}"><span class="df-n">${x.a || ''}</span><span class="df-n">${x.b || ''}</span><span class="df-m">${x.t}</span><span>${hl(x.s) || ' '}</span></div>`;
  });
  if (skipped) html += `<div class="df-skip">⋯ ${pick([`${skipped} 行は同じ`, `${skipped} unchanged lines`])}</div>`;
  diffDlg.innerHTML = `<div class="settings-head"><h2>⇄ ${pick(['変更点の比較', 'Compare changes'])}</h2><button data-diff="close">${tr('閉じる')}</button></div>`
    + `<p class="hint"><span class="df-legend del">− ${esc(labels[0])}</span> → <span class="df-legend add">+ ${esc(labels[1])}</span>`
    + ` &nbsp; <b class="df-count add">+${add}</b> <b class="df-count del">−${del}</b></p>`
    + `<div class="df-body">${add || del ? html : `<div class="df-skip">${pick(['違いはありません', 'No differences'])}</div>`}</div>`;
  diffDlg.showModal();
}
diffDlg.onclick = e => { if (e.target.closest('[data-diff="close"]') || e.target === diffDlg) diffDlg.close(); };
// 保存データ (JSON) から C# を作る (今のタブ以外の状態や履歴と比べるため)
function stateCs(state) {
  const tmp = new Blockly.Workspace();
  try { Blockly.serialization.workspaces.load(state || {}, tmp); return generate(tmp).code; } finally { tmp.dispose(); }
}
