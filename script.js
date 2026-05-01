let dataList = [];
let settings = [];

/* ===== アップロード ===== */
async function upload() {
  const files = document.getElementById('files').files;
  const fd = new FormData();
  for (let f of files) fd.append('images', f);

  const res = await fetch('/upload', { method:'POST', body:fd });
  dataList = await res.json();

  render();
}

/* ===== OCR表示 ===== */
function render() {
  const list = document.getElementById('list');
  list.innerHTML = '';

  dataList.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = "card";

    const company = item.company && item.company !== "不明"
      ? item.company
      : "未判定";

    div.innerHTML = `
      <div class="row">
        <div class="title">${company}</div>
        <div class="${item.status === 'ok' ? 'ok' : 'error'}">
          ${item.status === 'ok' ? '準備完了' : 'エラー'}
        </div>
      </div>

      <div class="actions">
        <button onclick="preview('${item.file}')">表示</button>
        <button onclick="del(${i})">削除</button>
      </div>
    `;

    list.appendChild(div);
  });
}

function preview(f){ window.open('/uploads/'+f); }

function del(i){
  if(confirm("削除しますか？")){
    dataList.splice(i,1);
    render();
  }
}

/* ===== 送信 ===== */
function openSend(){
  if(dataList.some(d=>d.status==='error')){
    alert("エラーを処理してください");
    return;
  }
  document.getElementById('sendBox').style.display='block';
}

async function send(){
  const msg = document.getElementById('msg').value;

  await fetch('/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({list:dataList,message:msg})
  });

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

  settings.push({
    account,
    name,
    roomId
  });

  renderSettings();

  document.getElementById('account').value = '';
  document.getElementById('name').value = '';
  document.getElementById('room').value = '';
}

async function saveSettings() {
  console.log("送信するデータ:", settings);

  await fetch('/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });

  // ★再取得
  const res = await fetch('/settings');
  settings = await res.json();

  renderSettings();

  alert("保存完了");
}

function closeSettings() {
  document.getElementById('settings').style.display = 'none';
}

function closeSend() {
  document.getElementById('sendBox').style.display = 'none';
}