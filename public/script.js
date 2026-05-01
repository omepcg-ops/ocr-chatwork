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
   画像前処理（超重要）
========================= */
function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // グレースケール＋2値化
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i]*0.3 + data[i+1]*0.59 + data[i+2]*0.11;
        const v = gray > 150 ? 255 : 0;

        data[i] = v;
        data[i+1] = v;
        data[i+2] = v;
      }

      ctx.putImageData(imageData, 0, 0);

      resolve(canvas);
    };
  });
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

  const processed = await preprocessImage(file);

  const { data } = await worker.recognize(processed);

  await worker.terminate();

  console.log("OCR結果:", data.text);

  const nums = extractAccountCandidates(data.text);
  const best = pickBestAccount(data.text, nums);
  const company = extractCompany(data.text);

  return {
    file: URL.createObjectURL(file),
    account: best || "",
    company: company || "未判定",
    status: best ? "ok" : "error"
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
   口座番号抽出（最強版）
========================= */
function extractAccountCandidates(text) {
  if (!text) return [];

  // 丸数字変換
  const map = {
    '①':'1','②':'2','③':'3','④':'4','⑤':'5',
    '⑥':'6','⑦':'7','⑧':'8','⑨':'9','⓪':'0'
  };

  let cleaned = text;

  for (let k in map) {
    cleaned = cleaned.split(k).join(map[k]);
  }

  // 全角→半角
  cleaned = cleaned.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248)
  );

  console.log("正規化:", cleaned);

  const keywords = ["口座番号", "口座", "番号", "普通"];

  let results = [];

  for (let key of keywords) {
    const idx = cleaned.indexOf(key);
    if (idx !== -1) {
      const slice = cleaned.slice(idx, idx + 120);

      console.log("範囲:", slice);

      const nums = slice.match(/\d{6,8}/g);
      if (nums) {
        results = nums;
        break;
      }
    }
  }

  if (!results.length) {
    results = cleaned.match(/\d{6,8}/g) || [];
  }

  console.log("候補:", results);

  return [...new Set(results)];
}

/* =========================
   最も近い口座番号
========================= */
function pickBestAccount(text, nums) {
  if (!nums.length) return "";

  const base = text.indexOf("口座");
  if (base === -1) return nums[0];

  let best = "";
  let min = Infinity;

  for (let n of nums) {
    const i = text.indexOf(n);
    const dist = Math.abs(i - base);

    if (dist < min) {
      min = dist;
      best = n;
    }
  }

  console.log("選択:", best);

  return best;
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
    alert("未判定あり");
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
