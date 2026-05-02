/* =========================
   グローバル
========================= */
let results = [];
let settings = [];

/* =========================
   OCR実行
========================= */
async function upload() {
  const files = document.getElementById("files").files;

  if (!files.length) {
    alert("ファイル選択して");
    return;
  }

  results = [];
  document.getElementById("list").innerHTML = "読み取り中...";

  for (let file of files) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/ocr", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      results.push({
        file,
        text: data.text || "取得失敗",
        account: data.account || "不明"
      });

    } catch (err) {
      console.error(err);
      results.push({
        file,
        text: "エラー",
        account: "取得失敗"
      });
    }
  }

  render();
}

/* =========================
   表示
========================= */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  results.forEach((r, i) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <div style="padding:10px;border:1px solid #ccc;margin-bottom:10px;">
        <b>${r.file.name}</b><br>
        口座番号: <span style="color:green">${r.account}</span><br><br>
        <button onclick="show(${i})">表示</button>
        <button onclick="removeItem(${i})">削除</button>
      </div>
    `;

    list.appendChild(div);
  });
}

function show(i) {
  alert(results[i].text);
}

function removeItem(i) {
  results.splice(i, 1);
  render();
}

/* =========================
   モーダル
========================= */
function openSettings() {
  document.getElementById("settings").style.display = "block";
}

function closeSettings() {
  document.getElementById("settings").style.display = "none";
}

function openSend() {
  document.getElementById("sendBox").style.display = "block";
}

function closeSend() {
  document.getElementById("sendBox").style.display = "none";
}

/* =========================
   設定管理
========================= */
function addSetting() {
  const account = document.getElementById("account").value;
  const name = document.getElementById("name").value;

  if (!account || !name) {
    alert("入力して");
    return;
  }

  settings.push({ account, name });
  renderSettings();

  document.getElementById("account").value = "";
  document.getElementById("name").value = "";
}

function renderSettings() {
  const box = document.getElementById("settingsList");
  box.innerHTML = "";

  settings.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML = `
      ${s.name} : ${s.account}
      <button onclick="deleteSetting(${i})">削除</button>
    `;
    box.appendChild(div);
  });
}

function deleteSetting(i) {
  settings.splice(i, 1);
  renderSettings();
}

function saveSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
  alert("保存した");
}

/* =========================
   Chatwork送信
========================= */
async function send() {
  const msg = document.getElementById("msg").value;
  const roomId = document.getElementById("room").value;

  if (!roomId) {
    alert("ルームID入れて");
    return;
  }

  let text = msg + "\n\n";

  results.forEach(r => {
    text += `口座番号: ${r.account}\n`;
  });

  try {
    await fetch("/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: text,
        roomId: roomId
      })
    });

    alert("送信完了");
    closeSend();

  } catch (e) {
    console.error(e);
    alert("送信失敗");
  }
}

/* =========================
   初期ロード
========================= */
window.onload = () => {
  const saved = localStorage.getItem("settings");
  if (saved) {
    settings = JSON.parse(saved);
    renderSettings();
  }
};

/* =========================
   HTMLから呼べるようにする（超重要）
========================= */
window.upload = upload;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openSend = openSend;
window.closeSend = closeSend;
window.addSetting = addSetting;
window.saveSettings = saveSettings;
window.show = show;
window.removeItem = removeItem;
window.send = send;
