let dataList = [];
let settings = [];

/* ===== アップロード（OCRはフロントでやる） ===== */
async function upload() {
  const files = document.getElementById('files').files;

  dataList = [];

  for (let file of files) {

    // OCR（ブラウザ側）
    const text = await Tesseract.recognize(file, 'eng+jpn')
      .then(res => res.data.text)
      .catch(() => "");

    // 数字抽出
    const nums = extractAccountCandidates(text);

    let found = null;

    for (let n of nums) {
      found = settings.find(m =>
        n === m.account ||
        n.includes(m.account) ||
        m.account.includes(n)
      );
      if (found) break;
    }

    // 一時URL（表示用）
    const url = URL.createObjectURL(file);

    dataList.push({
      file: file,
      preview: url,
      company: found ? found.name : "未判定",
      status: found ? "ok" : "error",
      roomId: found ? found.roomId : null
    });
  }

  render();
}

/* ===== OCR表示 ===== */
function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  dataList.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = "card";

    div.innerHTML = `
      <div class="row">
        <div class="title">${item.company}</div>
        <div class="${item.status === 'ok' ? 'ok' : 'error'}">
          ${item.status === 'ok' ? '準備完了' : '未判定'}
        </div>
      </div>

      <div class="actions">
        <button onclick="preview(${i})">表示</button>
        <button onclick="del(${i})">削除</button>
      </div>
    `;

    list.appendChild(div);
  });
}

/* ===== プレビュー ===== */
function preview(i){
  window.open(dataList[i].preview);
}

/* ===== 削除 ===== */
function del(i){
  if(confirm("削除しますか？")){
    dataList.splice(i,1);
    render();
  }
}

/* ===== 送信 ===== */
function openSend(){
  if(dataList.some(d=>d.status==='error')){
    alert("未判定があります");
    return;
  }
  document.getElementById('sendBox').style.display='block';
}

async function send(){
  const msg = document.getElementById('msg').value;

  const groups = {};

  dataList.forEach(item => {
    if (!item.roomId) return;
    if (!groups[item.roomId]) groups[item.roomId] = [];
    groups[item.roomId].push(item);
  });

  for (let roomId in groups) {

    // ===== 画像1枚ずつ送信 =====
    for (let item of groups[roomId]) {

      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('roomId', roomId);
      fd.append('company', item.company);

      await fetch('/send-image', {
        method: 'POST',
        body: fd
      });

      // 安定のため待機
      await new Promise(r => setTimeout(r, 500));
    }

    // ===== 最後にメッセージ =====
    await fetch('/send-message', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        roomId,
        message: msg
      })
    });
  }

  alert("送信完了");
}

/* ===== 設定 ===== */
async function openSettings(){
  document.getElementById('settings').style.display='block';

  const res = await fetch('/settings');
  settings = await res.json();

  renderSettings();
}

function renderSettings() {
  const box = document.getElementById('settingsList');
  box.innerHTML = '';

  settings.forEach((m, i) => {
    const div = document.createElement('div');

    div.innerHTML = `
      ${m.account} - ${m.name}
      <button onclick="removeSetting(${i})">削除</button>
    `;

    box.appendChild(div);
  });
}

function removeSetting(i){
  settings.splice(i,1);
  renderSettings();
}

function addSetting(){
  const account = document.getElementById('account').value;
  const name = document.getElementById('name').value;
  const roomId = document.getElementById('room').value;

  if (!account || !name || !roomId) {
    alert("全部入力して");
    return;
  }

  settings.push({ account, name, roomId });

  renderSettings();

  document.getElementById('account').value = '';
  document.getElementById('name').value = '';
  document.getElementById('room').value = '';
}

async function saveSettings() {
  await fetch('/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });

  alert("保存完了");
}

function closeSettings() {
  document.getElementById('settings').style.display = 'none';
}

function closeSend() {
  document.getElementById('sendBox').style.display = 'none';
}

/* ===== 数字抽出 ===== */
function normalizeNumber(str) {
  return str
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/I/g, '1')
    .replace(/l/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

function extractAccountCandidates(text) {
  if (!text) return [];

  text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const keywords = ["口座","銀行","振込","普通","当座","番号"];
  let candidates = [];

  for (let k of keywords) {
    const matches = text.match(new RegExp(`${k}.{0,60}`, 'g'));
    if (matches) {
      matches.forEach(area => {
        let nums = area.match(/\d{6,8}/g) || [];
        nums = nums.map(n => normalizeNumber(n))
                   .filter(n => Number(n) > 100000);
        candidates.push(...nums);
      });
    }
  }

  let all = text.match(/\d{6,8}/g) || [];
  all = all.map(n => normalizeNumber(n))
           .filter(n => Number(n) > 100000);

  candidates.push(...all);

  return [...new Set(candidates)];
}
