let dataList = [];
let settings = [];

/* =========================
   OCR 実行
========================= */
async function upload() {
  const files = document.getElementById('files').files;
  if (!files.length) return alert("ファイル選んで");

  dataList = [];

  for (let file of files) {
    const result = await runOCR(file);
    dataList.push(result);
  }

  render();
}

/* =========================
   OCR本体（軽量＋安定）
========================= */
async function runOCR(file) {
  const worker = await Tesseract.createWorker('jpn+eng');

  const { data } = await worker.recognize(file);

  await worker.terminate();

  console.log("OCR結果:", data.text);

  const accountCandidates = extractAccountCandidates(data.text);
  const company = extractCompany(data.text);

  return {
    file: URL.createObjectURL(file),
    account: accountCandidates[0] || "",
    company: company || "未判定",
    status: accountCandidates.length ? "ok" : "error"
  };
}

/* =========================
   表示
========================= */
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
          ${item.status === 'ok' ? item.account : '未判定'}
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

function preview(f) {
  window.open(f);
}

function del(i) {
  if (confirm("削除しますか？")) {
    dataList.splice(i, 1);
    render();
  }
}

/* =========================
   口座番号抽出（超重要）
========================= */
function extractAccountCandidates(text) {
  if (!text) return [];

  // 丸数字 → 通常数字
  const map = {
    '①':'1','②':'2','③':'3','④':'4','⑤':'5',
    '⑥':'6','⑦':'7','⑧':'8','⑨':'9','⓪':'0'
  };

  let cleaned = text;

  for (let k in map) {
    cleaned = cleaned.split(k).join(map[k]);
  }

  // 全角数字 → 半角
  cleaned = cleaned.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248)
  );

  // 範囲絞る（神ポイント）
  const area = cleaned.match(/振込先([\s\S]{0,200})名義/);
  if (area) cleaned = area[1];

  console.log("抽出対象:", cleaned);

  // 口座番号優先
  let match = cleaned.match(/口座番号[:：]?\s*([0-9\s]{4,15})/);

  let target = match ? match[1] : cleaned;

  // 数字のみ抽出
  const nums = (target.match(/\d{6,8}/g) || []);

  console.log("口座候補:", nums);

  return [...new Set(nums)];
}

/* =========================
   会社名抽出
========================= */
function extractCompany(text) {
  if (!text) return "";

  const lines = text.split("\n");

  for (let line of lines) {
    if (line.includes("会社名")) {
      return line.replace(/会社名[:：]/, "").trim();
    }
  }

  // fallback
  for (let line of lines) {
    if (line.includes("株式会社")) {
      return line.trim();
    }
  }

  return "";
}

/* =========================
   送信
========================= */
function openSend() {
  if (dataList.some(d => d.status === 'error')) {
    alert("未判定があります");
    return;
  }
  document.getElementById('sendBox').style.display = 'block';
}

async function send() {
  const msg = document.getElementById('msg').value;

  for (let item of dataList) {
    const match = settings.find(s => s.account === item.account);

    if (!match) {
      console.log("未登録:", item.account);
      continue;
    }

    await fetch('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: match.roomId,
        message: `${match.name}\n${msg}`
      })
    });
  }

  alert("送信完了");
}

/* =========================
   設定
========================= */
function openSettings() {
  document.getElementById('settings').style.display = 'block';
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

function removeSetting(i) {
  settings.splice(i, 1);
  renderSettings();
}

function addSetting() {
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

function saveSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
  alert("保存完了");
}

function loadSettings() {
  const saved = localStorage.getItem("settings");
  if (saved) settings = JSON.parse(saved);
}

function closeSettings() {
  document.getElementById('settings').style.display = 'none';
}

function closeSend() {
  document.getElementById('sendBox').style.display = 'none';
}

/* =========================
   初期化
========================= */
window.onload = () => {
  loadSettings();
};
