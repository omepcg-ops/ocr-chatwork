let results = [];
let settings = [];

/* OCR */
async function upload() {
  const files = document.getElementById("files").files;

  results = [];

  for (let file of files) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/ocr", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    const match = settings.find(s => s.account === data.account);

    results.push({
      file,
      text: data.text,
      account: data.account,
      name: match ? match.name : "未登録",
      roomId: match ? match.roomId : ""
    });
  }

  render();
}

/* 表示 */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  results.forEach((r, i) => {
    const div = document.createElement("div");

    div.innerHTML = `
      <b>${r.file.name}</b><br>
      会社名: <span style="color:blue">${r.name}</span><br>
      口座番号: <span style="color:green">${r.account}</span><br><br>
      <button onclick="show(${i})">表示</button>
      <button onclick="removeItem(${i})">削除</button>
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
   モーダル制御（これ抜けてる）
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

/* 送信 */
async function send() {

  for (let r of results) {

    if (!r.roomId) {
      alert("ルームID未設定");
      return;
    }

    const formData = new FormData();
    formData.append("file", r.file);
    formData.append("roomId", r.roomId);
    formData.append("message",
`お世話になっております。
昨日到着分の振込は完了致しました。
お手すきの際にご確認のほど宜しくお願いいたします。`
    );

    await fetch("/send", {
      method: "POST",
      body: formData
    });
  }

  alert("送信完了");

  // 初期化
  results = [];
  document.getElementById("list").innerHTML = "";
  document.getElementById("files").value = "";
}

/* 設定 */
function addSetting() {
  const account = document.getElementById("account").value;
  const name = document.getElementById("name").value;
  const room = document.getElementById("room").value;

  settings.push({ account, name, roomId: room });
  renderSettings();
}

function renderSettings() {
  const box = document.getElementById("settingsList");
  box.innerHTML = "";

  settings.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML =
`${s.name} (${s.account}) [${s.roomId}]
<button onclick="deleteSetting(${i})">削除</button>`;
    box.appendChild(div);
  });
}

function deleteSetting(i) {
  settings.splice(i, 1);
  renderSettings();
}

async function saveSettings() {
  await fetch("/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });

  alert("保存完了");
}

/* 初期ロード */
window.onload = async () => {
  const res = await fetch("/settings");
  settings = await res.json();
  renderSettings();
};

/* グローバル公開 */
window.upload = upload;
window.send = send;
window.show = show;
window.removeItem = removeItem;

window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openSend = openSend;
window.closeSend = closeSend;

window.addSetting = addSetting;
window.saveSettings = saveSettings;
