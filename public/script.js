let dataList = [];
let settings = [];

/* =========================
   OCR 実行
========================= */
async function upload() {
  const files = document.getElementById('files').files;
  if (!files.length) return alert("ファイル選択して");

  dataList = [];

  for (let file of files) {
    const result = await runOCR(file);
    dataList.push(result);
  }

  render();
}

/* =========================
   OCR本体
========================= */
async function runOCR(file) {
  const worker = await Tesseract.createWorker();

  await worker.loadLanguage('jpn+eng');
  await worker.initialize('jpn+eng');

  await worker.setParameters({
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: 1
  });

  const { data } = await worker.recognize(file);

  await worker.terminate();

  console.log("OCR結果:", data.text);

  const nums = extractAccountCandidates(data.text);
  const account = nums[0] || "";
  const company = extractCompany(data.text);

  return {
    file: URL.createObjectURL(file),
    account,
    company: company || "未判定",
    status: account ? "ok" : "error"
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
   テキスト正規化（最重要）
========================= */
function normalizeText(text) {
  return text
    .replace(/\s+/g, '') // ★スペース完全除去
    .replace(/①/g,'1').replace(/②/g,'2').replace(/③/g,'3')
    .replace(/④/g,'4').replace(/⑤/g,'5').replace(/⑥/g,'6')
    .replace(/⑦/g,'7').replace(/⑧/g,'8').replace(/⑨/g,'9')
    .replace(/⓪/g,'0')
    .replace(/[０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 65248)
    );
}

/* =========================
   口座番号抽出（最終ロジック）
========================= */
function extractAccountCandidates(text) {
  if (!text) return [];

  const cleaned = normalizeText(text);

  console.log("正規化:", cleaned);

  // ★完全一致（最強）
  const direct = cleaned.match(/口座番号[:：]?(\d{6,8})/);
  if (direct) {
    console.log("完全一致:", direct[1]);
    return [direct[1]];
  }

  // ★少しゆるい一致
  const loose = cleaned.match(/口座(\d{6,8})/);
  if (loose) {
    console.log("準一致:", loose[1]);
    return [loose[1]];
  }

  // fallback
  const nums = cleaned.match(/\d{6,8}/g) || [];

  console.log("候補:", nums);

  return [...new Set(nums)];
}

/* =========================
   会社名抽出
========================= */
function extractCompany(text) {
  const lines = text.split("\n");

  for (let line of lines) {
    if (line.includes("会社名")) {
      return line.replace(/会社名[:：]/, "").trim();
    }
  }

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

    if (!match) continue;

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
