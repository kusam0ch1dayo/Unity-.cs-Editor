// 初心者向けの機能: ブロックの説明パネル・エラーのやさしい説明・Unity のヒント・チュートリアル・かんたんモード・はじめての案内

// ---------- エラーのやさしい説明 ----------
const ERROR_HELP = [
  [/は定義されていません/, ['その名前の変数やメソッドがまだ作られていないか、つづりが違います (大文字と小文字も区別されます)。先に「フィールド」や「変数を作る」ブロックで作りましょう。',
    'No variable or method has that name yet, or it is misspelled (upper/lower case matters). Create it first with a "Field" or "Create a variable" block.']],
  [/^型 '/, ['型の名前が正しくありません。int (整数)・float (小数)・string (文字)・bool (true/false)・GameObject などから選びます。入力欄で Tab を押すと候補が出ます。',
    'The type name is wrong. Choose from int (whole number), float (decimal), string (text), bool (true/false), GameObject and more. Press Tab in the field for suggestions.']],
  [/に変換できません/, ['入れようとしている値の種類 (型) が合っていません。例: int の変数に "abc" (文字列) は入れられません。', 'The kind (type) of the value does not fit. For example, text like "abc" cannot go into an int variable.']],
  [/空いているスロット/, ['ブロックに穴 (入力) が空いています。値のブロックをはめ込みましょう。', 'The block has an empty slot. Snap a value block into it.']],
  [/1 ファイルに MonoBehaviour/, ['Unity では 1 つの .cs ファイルに MonoBehaviour のクラスは 1 つで、ファイル名とクラス名を同じにします。もう 1 つは「＋」で新しいタブに作りましょう。',
    'In Unity, one .cs file holds one MonoBehaviour class, and the file name matches the class name. Create the other one in a new tab with "+".']],
  [/の中に置いてください|の中には case|の下にクラス/, ['このブロックは置ける場所が決まっています。Debug.Log などの命令は Start や Update などのメソッドの中に、フィールドはクラスの中に入れます。',
    'This block can only go in certain places. Commands like Debug.Log go inside methods such as Start or Update; fields go inside a class.']],
  [/return/, ['値を返すメソッドは、return で値を返す必要があります。返す値がないなら、戻り値の型を void にします。', 'A method with a return type must return a value with return. If it returns nothing, set the type to void.']],
  [/yield/, ['yield (待つ) はコルーチンの中でだけ使えます。「コルーチン」ブロックの中に入れましょう。', 'yield (wait) only works inside a coroutine. Put it inside a "Coroutine" block.']],
  [/既に定義されています|重複/, ['同じ名前がすでに使われています。別の名前にしましょう。', 'The same name is already used. Choose another name.']],
  [/構文エラー/, ['C# の書き方として正しくない部分があります。「C# 文」など直接書いたブロックの中身を確認しましょう。', 'Part of the code is not valid C#. Check the contents of blocks where you wrote C# directly.']],
  [/MonoBehaviour は new/, ['MonoBehaviour は new では作れません。GameObject に AddComponent するか、プレハブを Instantiate します。', 'A MonoBehaviour cannot be created with new. Use AddComponent on a GameObject or Instantiate a prefab.']],
  [/はありません/, ['その型には、その名前のメンバー (値やメソッド) がありません。つづりを確認するか、入力欄で Tab を押して候補から選びましょう。', 'That type has no member with that name. Check the spelling, or press Tab in the field and pick a suggestion.']],
  [/は使えません/, ['名前に使えるのは英字・数字・_ で、数字から始めることはできません。', 'Names can use letters, digits and _, and cannot start with a digit.']],
  [/どこにもつながっていない/, ['値のブロックが単独で置かれています。ほかのブロックの穴にはめましょう。いらなければ削除します。', 'This value block is not connected. Snap it into another block, or delete it.']],
];
function explainError(msg) { const e = ERROR_HELP.find(([re]) => re.test(msg)); return e ? pick(e[1]) : ''; }

// ---------- 説明パネル (選んだブロックの説明) ----------
function blockCode(block) {
  try {
    cs.init(ws);
    const c = cs.blockToCode(block, true);
    return (Array.isArray(c) ? c[0] : c).replace(/^\n+/, '').replace(/\s+$/, '');
  } catch (e) { return ''; }
}
function renderHelp() {
  const box = document.getElementById('help'), block = selectedId && ws.getBlockById(selectedId);
  if (!block) {
    box.innerHTML = `<div class="help"><p>${pick(['ブロックを選ぶと、ここに説明と C# での書き方が出ます。', 'Select a block to see what it does and how it looks in C#.'])}</p>`
      + `<p>${pick(['ブロックの上にマウスを乗せても説明が出ます。右クリック →「ヘルプ」で公式ドキュメントが開きます。', 'Hovering over a block also shows its description. Right-click → "Help" opens the official docs.'])}</p>`
      + `<button data-act="learn">📚 ${pick(['チュートリアルを見る', 'Open tutorials'])}</button></div>`;
    return;
  }
  const h = HELP[block.type], url = helpUrl(h);
  const lines = blockCode(block).split('\n');
  const codeText = lines.slice(0, 14).join('\n') + (lines.length > 14 ? '\n…' : '');
  const errs = issues.filter(x => x.block === block);
  box.innerHTML = `<div class="help"><h3>${esc(h ? pick(h.name) : block.type)}</h3>`
    + `<p>${esc(h ? pick(h.desc) : (typeof block.tooltip === 'string' ? block.tooltip : ''))}</p>`
    + (h && h.t ? `<p class="tip">💡 ${esc(pick(h.t))}</p>` : '')
    + errs.map(x => `<div class="help-err ${x.level}"><b>${x.level === 'error' ? '✖' : '⚠'} ${esc(tr(x.msg))}</b>${explainError(x.msg) ? `<br>${esc(explainError(x.msg))}` : ''}</div>`).join('')
    + (codeText ? `<div class="help-sec">${pick(['C# ではこう書きます', 'In C# this is'])}</div><pre class="help-code">${hl(codeText)}</pre>` : '')
    + (url ? `<a href="${url}" target="_blank" rel="noopener">📖 ${pick(['公式ドキュメント', 'Official docs'])}</a>` : '') + '</div>';
}
document.getElementById('help').onclick = e => { if (e.target.closest('[data-act="learn"]')) openLearn(); };

// ---------- Unity のヒント (よくある落とし穴) ----------
let hints = [];
function unityHints() {
  const out = [], push = (block, text) => out.push({ block, text: pick(text) });
  const eventOf = b => { for (let p = b.getSurroundParent(); p; p = p.getSurroundParent()) if (p.type === 'unity_event') return f(p, 'EVENT').split('(')[0]; return null; };
  const usesDelta = b => b.getDescendants(false).some(d => (d.type === 'time_value' && /deltaTime/.test(f(d, 'PROP'))) || (d.type === 'var_get' && /deltaTime/.test(f(d, 'NAME'))));
  for (const b of ws.getAllBlocks(true)) {
    if (!b.isEnabled() || b.isShadow()) continue;
    const ev = eventOf(b);
    if (ev === 'Update' && b.type === 'transform_action' && f(b, 'ACTION') !== 'LookAt' && !usesDelta(b))
      push(b, ['Update の中の移動・回転に Time.deltaTime を掛けると、パソコンの速さ (フレームレート) に関係なく同じ速さで動きます。',
        'Multiply movement/rotation in Update by Time.deltaTime so the speed is the same at any frame rate.']);
    if (ev === 'Update' && (b.type === 'get_component' || (b.type === 'generic_call' && /^GetComponent/.test(f(b, 'NAME'))) || b.type === 'find_object'))
      push(b, ['GetComponent や Find は重いので、毎フレーム (Update) ではなく Start で 1 回だけ呼び、変数に入れておきましょう。',
        'GetComponent and Find are slow. Call them once in Start and keep the result in a variable instead of every frame.']);
    if (ev === 'Update' && b.type === 'debug_log')
      push(b, ['Update の中の Debug.Log は毎フレーム表示されるので、Console が大量のメッセージで埋まります。', 'Debug.Log in Update prints every frame and floods the Console.']);
    if (ev === 'FixedUpdate' && ((b.type === 'input_key' && f(b, 'MODE') !== 'GetKey') || (b.type === 'input_button' && f(b, 'MODE') !== 'GetButton')
        || (b.type === 'mouse_button' && f(b, 'MODE') !== 'GetMouseButton')))
      push(b, ['「押した瞬間」の入力は FixedUpdate だと取りこぼすことがあります。入力は Update で受け取りましょう。', 'Press-moment input can be missed in FixedUpdate. Read input in Update.']);
    if (ev === 'Update' && ['rb_addforce', 'rb2d_addforce'].includes(b.type) && f(b, 'MODE') === 'Force')
      push(b, ['押し続ける力 (Force) は物理の更新に合わせて FixedUpdate で加えると安定します。', 'A continuous Force is more stable when added in FixedUpdate.']);
    if (b.type === 'unity_event' && !b.getInputTargetBlock('BODY'))
      push(b, ['中身が空の Unity イベントです。使わないなら消してもかまいません。', 'This Unity event is empty. You can delete it if you do not need it.']);
    if (b.type === 'logic_compare' && ['EQ', 'NEQ'].includes(f(b, 'OP'))
        && ['A', 'B'].some(n => { const x = b.getInputTargetBlock(n); return x && x.type === 'var_get' && /\.tag$/.test(f(x, 'NAME')); }))
      push(b, ['タグの比較は == より CompareTag を使う方が速く、つづり間違いにも気づけます。', 'CompareTag is faster than == for tags and catches misspelled tags.']);
    if (b.type === 'class_def' && f(b, 'BASE').trim() === 'MonoBehaviour') {
      const members = []; for (let m = b.getInputTargetBlock('MEMBERS'); m; m = m.getNextBlock()) members.push(m);
      if (!members.some(m => ['unity_event', 'method_def', 'coroutine_def'].includes(m.type)))
        push(b, ['Start や Update などの「Unity イベント」を入れないと、スクリプトは何もしません。', 'Without Unity events such as Start or Update, the script does nothing.']);
      const refs = members.filter(m => m.type === 'field_def' && /^public|SerializeField/.test(f(m, 'ACCESS')) && !m.getInputTargetBlock('VALUE')
        && !['int', 'float', 'double', 'bool', 'string', 'Vector2', 'Vector3', 'Color', 'LayerMask'].includes(f(m, 'TYPE').trim())).map(m => f(m, 'NAME'));
      if (refs.length)
        push(b, [`${refs.join(', ')} は Unity のインスペクターでドラッグして設定します。設定しないと実行時に NullReferenceException になります。`,
          `Set ${refs.join(', ')} by dragging in the Unity Inspector. Otherwise you get a NullReferenceException at runtime.`]);
    }
  }
  return out;
}
function renderHints() {
  hints = unityHints();
  document.getElementById('tabHints').textContent = pick(['ヒント', 'Hints']) + (hints.length ? ` (${hints.length})` : '');
  document.getElementById('hints').innerHTML = hints.length
    ? hints.map((x, i) => `<div class="issue hint" data-i="${i}"><b>💡</b> ${esc(x.text)}<small>${esc(x.block.toString(28))}</small></div>`).join('')
    : `<div class="ok">${pick(['✔ 気になる点はありません', '✔ Nothing to point out'])}</div>`;
}
document.getElementById('hints').onclick = e => {
  const d = e.target.closest('.hint'); if (!d) return;
  const b = hints[+d.dataset.i].block;
  ws.centerOnBlock(b.id); Blockly.common.setSelected(b);
};

// ---------- かんたんモード (よく使うブロックだけ表示) ----------
const BASIC = new Set(['class_def', 'field_def', 'method_def', 'unity_event', 'return_stmt', 'method_call', 'comment_stmt', 'var_local', 'var_set', 'var_get', 'var_incr',
  'debug_log', 'transform_action', 'transform_set', 'transform_get', 'vector3_new', 'vector3_const', 'vector2_new', 'time_value', 'input_key', 'input_axis', 'input_button',
  'get_component', 'instantiate', 'destroy', 'compare_tag', 'set_active', 'rb_addforce', 'rb2d_addforce', 'controls_if', 'logic_compare', 'logic_operation', 'logic_negate',
  'logic_boolean', 'controls_repeat_ext', 'for_range', 'controls_whileUntil', 'math_number', 'number_f', 'math_arithmetic', 'random_range', 'text', 'text_concat',
  'list_new', 'list_add', 'list_get', 'list_count', 'list_foreach', 'coroutine_def', 'yield_wait', 'start_coroutine', 'ui_set_text', 'audio_play', 'audio_oneshot', 'load_scene']);
const BEGINNER_KEY = 'unity-block-coder-beginner';
let beginner = false;
try { beginner = localStorage.getItem(BEGINNER_KEY) === '1'; } catch (e) {}
function setBeginner(on) {
  beginner = on;
  try { localStorage.setItem(BEGINNER_KEY, on ? '1' : '0'); } catch (e) {}
  activeToolbox = on ? { kind: 'categoryToolbox', contents: toolbox.contents.map(c => ({ ...c, contents: c.contents.filter(it => BASIC.has(it.type)) })).filter(c => c.contents.length) } : toolbox;
  ws.updateToolbox(activeToolbox);
  searchIndex = null;
  document.getElementById('beginner').classList.toggle('pressed', on);
}
document.getElementById('beginner').onclick = () => {
  setBeginner(!beginner);
  showToast(beginner ? pick(['🔰 かんたんモード: よく使うブロックだけ表示します', '🔰 Beginner mode: only common blocks are shown'])
    : pick(['すべてのブロックを表示します', 'All blocks are shown']), 3000);
};

// ---------- チュートリアル ----------
const LEARNED_KEY = 'unity-block-coder-learned';
const src = (name, body) => `using UnityEngine;\n\npublic class ${name} : MonoBehaviour\n{\n${body}}\n`;
const inEvent = (code, ev) => (code.match(new RegExp(`void ${ev}\\([^)]*\\)\\n\\s*\\{([\\s\\S]*?)\\n    \\}`)) || [, ''])[1];
const TUTORIALS = [
  { id: 'hello', title: ['1. はじめての Hello World', '1. Your first Hello World'], desc: ['Console に文字を表示する', 'Print text to the Console'],
    start: src('Hello', '    void Start()\n    {\n    }\n'), steps: [
      { text: ['Unity のスクリプトは「クラス」の中に書きます。新しいタブにクラス Hello と「Unity イベント Start()」を用意しました。Start はゲームが始まったときに 1 回だけ動きます。右側に、ブロックから作られた C# が表示されています。',
        'Unity scripts are written inside a "class". A new tab has a class Hello with a Unity event Start(). Start runs once when the game starts. The C# made from the blocks is shown on the right.'] },
      { text: ['左の「Unity」カテゴリを開き、「Debug.Log」ブロックを「Start()」の中にドラッグして入れましょう。', 'Open the "Unity" category and drag the "Debug.Log" block into "Start()".'],
        cat: 'Unity', hint: ['ブロックの左上の出っ張りを、Start() の中のくぼみに合わせると「カチッ」とはまります。', 'Line up the notch of the block with the slot inside Start() and it snaps in.'],
        check: c => /Debug\.Log\(/.test(inEvent(c, 'Start')) },
      { text: ['Debug.Log の中の「Hello」をクリックして、好きな言葉に変えてみましょう。', 'Click "Hello" inside Debug.Log and change it to any words you like.'],
        check: c => /Debug\.Log\("(?!Hello")[^"]*"\)/.test(inEvent(c, 'Start')) },
      { text: ['完成です！「.cs 保存」で保存し、Unity の Assets フォルダに入れます。シーンの GameObject にドラッグして付け、▶ (再生) を押すと Console に表示されます。',
        'Done! Save with "Save .cs" and put it in the Assets folder of Unity. Drag it onto a GameObject in the scene and press ▶ (Play) to see it in the Console.'] },
    ] },
  { id: 'move', title: ['2. 変数で動かす', '2. Move with a variable'], desc: ['変数 speed を使ってオブジェクトを動かす', 'Move an object using a speed variable'],
    start: src('Mover', '    void Update()\n    {\n    }\n'), steps: [
      { text: ['変数は値を入れておく「箱」です。「クラス」カテゴリの「フィールド」ブロックを、クラスの中 (Update の上) に入れましょう。型を float、名前を speed、値を 5 にします。',
        'A variable is a "box" that holds a value. Put a "Field" block from the "Class" category inside the class (above Update). Set the type to float, the name to speed and the value to 5.'],
        cat: 'クラス', hint: ['値の穴には「数値・文字」カテゴリの数のブロックをはめます。public にするとインスペクターから値を変えられます。', 'Snap a number block from "Math & Text" into the value slot. public lets you change it in the Inspector.'],
        check: c => /float speed = 5f?;/.test(c) },
      { text: ['「Unity」カテゴリの「transform.Translate」ブロックを Update() の中に入れましょう。Update は毎フレーム (1 秒に何十回も) 動きます。',
        'Put the "transform.Translate" block from the "Unity" category into Update(). Update runs every frame (dozens of times per second).'],
        cat: 'Unity', check: c => /transform\.Translate\(/.test(inEvent(c, 'Update')) },
      { text: ['Translate の中を「Vector3.forward × speed × Time.deltaTime」にしましょう。かけ算は「数値・文字」の計算ブロック、speed は「変数」カテゴリの値ブロック、Time.deltaTime は「Unity」カテゴリにあります。',
        'Make the inside of Translate "Vector3.forward × speed × Time.deltaTime". Multiplication is the arithmetic block in "Math & Text", speed is the value block in "Variables", and Time.deltaTime is in "Unity".'],
        hint: ['計算ブロックの中に計算ブロックを入れると、3 つ以上をかけ算できます。', 'Put an arithmetic block inside another one to multiply three values.'],
        check: c => { const t = (inEvent(c, 'Update').match(/transform\.Translate\(([^;]*)\);/) || [, ''])[1]; return /speed/.test(t) && /Time\.deltaTime/.test(t); } },
      { text: ['Time.deltaTime は「前のフレームからの秒数」です。これを掛けると「1 秒に speed だけ進む」になり、パソコンの速さに関係なく同じ速さで動きます。',
        'Time.deltaTime is the number of seconds since the last frame. Multiplying by it means "move speed units per second", the same on every computer.'] },
    ] },
  { id: 'if', title: ['3. もし〜なら (if)', '3. If statements'], desc: ['キーを押したときだけ動かす', 'Do something only when a key is pressed'],
    start: src('Jumper', '    void Update()\n    {\n    }\n'), steps: [
      { text: ['「ロジック」カテゴリの「もし」ブロックを Update() の中に入れましょう。', 'Put the "if" block from the "Logic" category into Update().'], cat: 'ロジック', check: c => /if \(/.test(inEvent(c, 'Update')) },
      { text: ['「もし」の条件の穴に、「Unity」カテゴリの「Input.GetKeyDown( KeyCode.Space )」をはめましょう。スペースキーを押した瞬間だけ true になります。',
        'Snap "Input.GetKeyDown( KeyCode.Space )" from the "Unity" category into the condition. It is true only at the moment Space is pressed.'],
        cat: 'Unity', check: c => /if \(Input\.GetKeyDown\(KeyCode\.\w+\)\)/.test(c) },
      { text: ['「もし」の中 (実行) に Debug.Log を入れて、「ジャンプ！」と表示させましょう。', 'Put a Debug.Log inside the if (do) and make it print "Jump!".'],
        check: c => /if \(Input\.GetKeyDown\(KeyCode\.\w+\)\)\n\s*\{\n\s*Debug\.Log\(/.test(c) },
      { text: ['これで「スペースキーを押したときだけ」表示されます。歯車アイコンから「そうでなければ (else)」も追加できます。', 'Now it prints only when Space is pressed. Use the gear icon to add "else" too.'] },
    ] },
  { id: 'loop', title: ['4. 繰り返し (for)', '4. Loops (for)'], desc: ['同じ処理を何度も実行する', 'Run the same thing many times'],
    start: src('Counter', '    void Start()\n    {\n    }\n'), steps: [
      { text: ['「ループ」カテゴリの「for int i = 0 ～ 10 未満」ブロックを Start() の中に入れましょう。', 'Put the "for int i = 0 to below 10" block from "Loops" into Start().'], cat: 'ループ', check: c => /for \(int \w+ = /.test(inEvent(c, 'Start')) },
      { text: ['for の中に Debug.Log を入れ、表示する中身を「変数」カテゴリの値ブロックにして、名前を i にしましょう。', 'Put a Debug.Log inside the for, and use the value block from "Variables" with the name i as its content.'],
        cat: '変数', hint: ['Debug.Log の「Hello」のブロックを外して、代わりに値ブロックをはめます。', 'Remove the "Hello" block from Debug.Log and snap the value block in instead.'],
        check: c => /for \(int (\w+)[^)]*\)\n\s*\{[\s\S]*?Debug\.Log\(\1\)/.test(c) },
      { text: ['実行すると 0, 1, 2 … 9 と表示されます。i は 1 回ごとに 1 ずつ増える変数です。', 'When run, it prints 0, 1, 2 … 9. i is a variable that goes up by 1 each round.'] },
    ] },
  { id: 'trigger', title: ['5. 当たり判定', '5. Collisions'], desc: ['プレイヤーが触れたらコインを消す', 'Remove a coin when the player touches it'],
    start: src('Coin', ''), steps: [
      { text: ['「Unity」カテゴリの「Unity イベント」をクラスの中に入れ、種類を OnTriggerEnter(Collider other) にしましょう。何かがぶつかった瞬間に動きます。',
        'Put a "Unity event" from the "Unity" category into the class and set it to OnTriggerEnter(Collider other). It runs when something enters.'],
        cat: 'Unity', check: c => /void OnTriggerEnter\(Collider other\)/.test(c) },
      { text: ['その中に「もし」を入れ、条件に「オブジェクト」カテゴリの「other.CompareTag("Player")」をはめましょう。ぶつかった相手のタグが Player かを調べます。',
        'Put an "if" inside it, with "other.CompareTag("Player")" from "Objects" as the condition. It checks whether the other object is tagged Player.'],
        cat: 'オブジェクト', check: c => /if \(other\.CompareTag\("Player"\)\)/.test(c) },
      { text: ['「もし」の中に「オブジェクト」カテゴリの「Destroy( gameObject )」を入れましょう。', 'Put "Destroy( gameObject )" from "Objects" inside the if.'], cat: 'オブジェクト',
        check: c => /CompareTag\("Player"\)\)\n\s*\{\n\s*Destroy\(gameObject/.test(c) },
      { text: ['Unity 側では、コインの Collider の「Is Trigger」にチェックを入れ、プレイヤーにタグ「Player」と Rigidbody を付けると動きます。',
        'In Unity, check "Is Trigger" on the coin collider, and give the player the "Player" tag and a Rigidbody.'] },
    ] },
  { id: 'read', title: ['6. C# を読んでみよう', '6. Read the C#'], desc: ['ブロックと C# の対応を確かめる', 'See how blocks and C# match'],
    start: src('Reader', '    public float speed = 3f;\n\n    void Update()\n    {\n        if (Input.GetKey(KeyCode.RightArrow))\n        {\n            transform.Translate(Vector3.right * speed * Time.deltaTime);\n        }\n    }\n'), steps: [
      { text: ['右側の C# の行をクリックしてみましょう。その行を作っているブロックが選ばれ、下の「ヘルプ」に説明が出ます。', 'Click a line of the C# on the right. The block that makes it is selected, and "Help" below explains it.'],
        check: () => !!selectedId },
      { text: ['今度はブロックをクリックしてみましょう。対応する C# の行が青く光ります。いろいろなブロックで試して、C# の書き方を覚えましょう。', 'Now click a block. The matching C# lines light up. Try several blocks to learn how C# is written.'] },
      { text: ['C# を自分で書いたら「C# 読込」でブロックに戻せます。ブロックと C# を行き来しながら練習しましょう。', 'When you write C# yourself, "Import C#" turns it back into blocks. Practice by going back and forth.'] },
    ] },
];
let tutor = null;   // { t: チュートリアル, i: 何番目の手順, done: 合格したか }
const learned = () => { try { return JSON.parse(localStorage.getItem(LEARNED_KEY)) || []; } catch (e) { return []; } };
async function startTutorial(t) {
  document.getElementById('learnDlg').close();
  if (!tsParser) { showToast(tr('C# パーサーを読み込み中です…'), 3000); await tsReady; }
  newTab({});
  importCs(t.start, false);
  ws.clearUndo();
  tutor = { t, i: 0, done: false };
  renderTutor();
}
function openCategory(name) {
  const box = ws.getToolbox(), item = box.getToolboxItems().find(it => it.getName && it.getName() === tr(name));
  if (item) box.setSelectedItem(item);
}
function renderTutor() {
  const el = document.getElementById('tutor');
  if (!tutor) { el.hidden = true; return; }
  const { t, i } = tutor, step = t.steps[i], last = i === t.steps.length - 1;
  tutor.done = !step.check || step.check(code);
  el.hidden = false;
  el.innerHTML = `<div class="tutor-head"><b>${esc(pick(t.title))}</b><span>${i + 1} / ${t.steps.length}</span><button data-act="close" title="${pick(['終了', 'Close'])}">✕</button></div>`
    + `<p>${esc(pick(step.text))}</p>`
    + (step.cat ? `<button data-act="cat">📂 ${pick(['カテゴリを開く', 'Open category'])}: ${esc(tr(step.cat))}</button>` : '')
    + (step.hint ? `<details><summary>${pick(['ヒントを見る', 'Show hint'])}</summary>${esc(pick(step.hint))}</details>` : '')
    + `<div class="tutor-foot">${step.check ? (tutor.done ? `<span class="pass">✔ ${pick(['できました！', 'Well done!'])}</span>` : `<span class="wait">${pick(['できたら自動でチェックします…', 'Checked automatically when done…'])}</span>`) : '<span></span>'}`
    + `${i ? `<button data-act="prev">← ${pick(['戻る', 'Back'])}</button>` : ''}<button data-act="next" class="primary" ${tutor.done ? '' : 'disabled'}>${last ? pick(['完了 🎉', 'Finish 🎉']) : pick(['次へ →', 'Next →'])}</button></div>`;
}
document.getElementById('tutor').onclick = e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act || !tutor) return;
  if (act === 'close') tutor = null;
  if (act === 'cat') return openCategory(tutor.t.steps[tutor.i].cat);
  if (act === 'prev') tutor.i--;
  if (act === 'next') {
    if (tutor.i < tutor.t.steps.length - 1) tutor.i++;
    else {
      const ids = new Set(learned()); ids.add(tutor.t.id);
      try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...ids])); } catch (err) {}
      showToast(pick(['🎉 チュートリアル完了！ 次のレッスンにも挑戦してみましょう', '🎉 Tutorial complete! Try the next lesson too']), 4000);
      tutor = null;
    }
  }
  renderTutor();
};

// ---------- 学ぶ (チュートリアル一覧) ----------
function openLearn() {
  const done = new Set(learned());
  document.getElementById('learnBody').innerHTML = `<h2>📚 ${pick(['学ぶ', 'Learn'])}</h2>`
    + `<p class="hint">${pick(['手順どおりにブロックを置くと自動でチェックされます。順番に進めると C# の基本が身につきます。', 'Place blocks as instructed and each step is checked automatically. Go in order to learn the basics of C#.'])}</p>`
    + `<div id="tplList">${TUTORIALS.map((t, i) => `<button class="tpl" data-t="${i}"><b>${done.has(t.id) ? '✅ ' : ''}${esc(pick(t.title))}</b><small>${esc(pick(t.desc))}</small></button>`).join('')}</div>`
    + `<div class="help-sec">${pick(['知っておくと便利', 'Good to know'])}</div><ul class="tips">${[
      ['ブロックを選ぶと、下の「ヘルプ」に説明と C# の書き方が出ます。', 'Select a block to see its explanation and C# in "Help" below.'],
      ['エラーは「問題」に出ます。ブロックを選ぶと、エラーのやさしい説明も「ヘルプ」に出ます。', 'Errors appear in "Problems". Select the block to see an easy explanation in "Help".'],
      ['「ヒント」には、Unity でよくある失敗を防ぐコツが出ます。', '"Hints" shows tips that prevent common Unity mistakes.'],
      ['入力欄で Tab を押すと、変数名や型の候補から選べます。', 'Press Tab in a field to pick variable names and types from suggestions.'],
      ['Ctrl+K でブロックを検索できます。「音」「ジャンプ」などの言葉でも探せます。', 'Ctrl+K searches blocks, also by words like "sound" or "jump".'],
      ['🔰 かんたんモードでは、よく使うブロックだけが表示されます。', '🔰 Beginner mode shows only common blocks.'],
      ['「テンプレート」から、よく使うスクリプトの完成例を開けます。', '"Templates" opens finished examples of common scripts.'],
    ].map(x => `<li>${esc(pick(x))}</li>`).join('')}</ul>`;
  document.getElementById('learnDlg').showModal();
}
document.getElementById('learnBody').onclick = e => { const b = e.target.closest('[data-t]'); if (b) startTutorial(TUTORIALS[+b.dataset.t]); };
document.getElementById('learnClose').onclick = () => document.getElementById('learnDlg').close();
document.getElementById('learn').onclick = openLearn;

// ---------- はじめての案内 ----------
const WELCOME_KEY = 'unity-block-coder-welcomed';
function openWelcome() {
  document.getElementById('welcomeBody').innerHTML = `<h2>👋 ${pick(['ようこそ Unity Block Coder へ', 'Welcome to Unity Block Coder'])}</h2>`
    + `<p>${pick(['ブロックを組み合わせて、Unity の C# スクリプトを作れます。右側には本物の C# がリアルタイムで表示されるので、ブロックで作りながら C# の書き方も覚えられます。',
      'Build Unity C# scripts by snapping blocks together. Real C# appears on the right as you go, so you learn how to write C# while building with blocks.'])}</p>`
    + `<label class="row"><input type="checkbox" id="welcomeBeginner" checked> 🔰 ${pick(['かんたんモードで始める (よく使うブロックだけ表示)', 'Start in beginner mode (show only common blocks)'])}</label>`
    + `<div class="welcome-actions"><button class="primary" data-w="learn">📚 ${pick(['チュートリアルで学ぶ (おすすめ)', 'Learn with tutorials (recommended)'])}</button>`
    + `<button data-w="tpl">${pick(['テンプレートから始める', 'Start from a template'])}</button><button data-w="free">${pick(['自由に作る', 'Build freely'])}</button></div>`;
  document.getElementById('welcomeDlg').showModal();
}
document.getElementById('welcomeBody').onclick = e => {
  const w = e.target.closest('[data-w]')?.dataset.w;
  if (!w) return;
  setBeginner(document.getElementById('welcomeBeginner').checked);
  try { localStorage.setItem(WELCOME_KEY, '1'); } catch (err) {}
  document.getElementById('welcomeDlg').close();
  if (w === 'learn') openLearn();
  if (w === 'tpl') document.getElementById('templates').click();
};

// ---------- 画面の更新とつなぐ ----------
function refreshLearn() { renderHelp(); renderHints(); if (tutor) renderTutor(); }
ws.addChangeListener(e => {
  if (e.type === Blockly.Events.SELECTED) {
    renderHelp();
    if (tutor) renderTutor();
    if (beginner && e.newElementId) showPanel('help');
  } else if (!e.isUiEvent) refreshLearn();
});
document.getElementById('tabHelp').textContent = pick(['ヘルプ', 'Help']);
setBeginner(beginner);
refreshLearn();
let firstVisit = false;
try { firstVisit = !localStorage.getItem(WELCOME_KEY); } catch (e) {}
if (firstVisit) openWelcome();
