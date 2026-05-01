let dataList = [];
let settings = [];

/* ===== 初期ロード（ここ超重要） ===== */
window.onload = async () => {
  await loadSettings();
};

/* ===== 設定ロード ===== */
async function loadSettings() {
  try {
    const res = await fetch('/settings');
    settings = await res.json();
    console.log("設定読み込み:", settings);
  } catch (e) {
    console.log("設定読み込み失敗");
    settings = [];
  }
}

/* ===== アップロード（OCR） ===== */
async function upload() {
  const files = document.getElementById('files').files;

  if (files.length === 0) {
    alert("ファイル選択して");
    return;
  }

  dataList = [];

  for (let file of files) {

    console.log("OCR開始:", file.name);

    const text = await Tesseract.recognize(file, 'jpn')
      .then(res => res.data.text)
      .catch(() => "");

    console.log("OCR結果:", text);

    const nums = extractAccountCandidates(text);

    console.log("抽出数字:", nums);

    let found = null;

    for (let n of nums) {
      found = settings.find(m =>
        n === m.account ||
        n.includes(m.account) ||
        m.account.includes(n)
      );
      if (found) break;
    }

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

/* ===== 表示 ===== */
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

    for (let item of groups[roomId]) {

      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('roomId', roomId);
      fd.append('company', item.company);

      await fetch('/send-image', {
        method: 'POST',
        body: fd
      });

      await new Promise(r => setTimeout(r, 500));
    }

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
  await loadSettings();
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
  const account = document.getElementById('account').value.trim();
  const name = document.getElementById('name').value.trim();
  const roomId = document.getElementById('room').value.trim();

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

/* ===== 閉じる ===== */
function closeSettings() {
  document.getElementById('settings').style.display = 'none';
}

function closeSend() {
  document.getElementById('sendBox').style.display = 'none';
}

/* ===== 数字補正 ===== */
function normalizeNumber(str) {
  return str
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/I/g, '1')
    .replace(/l/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

/* ===== 数字抽出（強化版） ===== */
function extractAccountCandidates(text) {
  if (!text) return [];

  text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  let nums = text.match(/\d{6,8}/g) || [];

  nums = nums.map(n => normalizeNumber(n))
             .filter(n => Number(n) > 100000);

  return [...new Set(nums)];
}
