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

/* 表示（枚数まとめ） */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  const grouped = {};

  results.forEach(r => {
    if (!grouped[r.account]) {
      grouped[r.account] = {
        name: r.name,
        account: r.account,
        roomId: r.roomId,
        files: []
      };
    }
    grouped[r.account].files.push(r.file);
  });

  Object.values(grouped).forEach((g, i) => {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div class="title">${g.name}</div>
      <div>口座番号: <span class="ok">${g.account}</span></div>
      <div>枚数: ${g.files.length}枚</div>
    `;

    list.appendChild(div);
  });
}

/* モーダル */
function openSettings() {
  document.getElementById("settings").style.display = "block";
}
function closeSettings() {
  document.getElementById("settings").style.display = "none";
}
function openSend() {
  document.getElementById("sendBox").style.display = "block";

  // デフォルト文章入れる
  document.getElementById("msg").value =
`お世話になっております。
昨日到着分の振込は完了致しました。
お手すきの際にご確認のほど宜しくお願いいたします。`;
}
function closeSend() {
  document.getElementById("sendBox").style.display = "none";
}

/* =========================
   送信（グループ送信）
========================= */
async function send() {

  const msg = document.getElementById("msg").value;

  // 🔥 ローディング表示
  showLoading(true);

  const grouped = {};

  results.forEach(r => {
    if (!grouped[r.roomId]) {
      grouped[r.roomId] = [];
    }
    grouped[r.roomId].push(r);
  });

  for (let roomId in grouped) {

    const items = grouped[roomId];

    if (!roomId) {
      alert("ルームID未設定あり");
      showLoading(false);
      return;
    }

    // ① 画像を全部送る
    for (let r of items) {
      const formData = new FormData();
      formData.append("file", r.file);
      formData.append("roomId", roomId);
      formData.append("message", msg);

      await fetch("/send", {
        method: "POST",
        body: formData
      });
    }

    // ② 待機（順序安定）
    await new Promise(r => setTimeout(r, 3000));

    // ③ メッセージ1回
    await fetch("/sendMessageOnly", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId,
        message: msg
      })
    });
  }

  showLoading(false);

  alert("送信完了");

  results = [];
  document.getElementById("list").innerHTML = "";
  document.getElementById("files").value = "";
}

/* =========================
   ローディングUI
========================= */
function showLoading(flag) {
  let el = document.getElementById("loading");

  if (flag) {
    if (!el) {
      el = document.createElement("div");
      el.id = "loading";
      el.innerHTML = "送信中...";
      document.body.appendChild(el);
    }
    el.style.display = "flex";
  } else {
    if (el) el.style.display = "none";
  }
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

/* グローバル */
window.upload = upload;
window.send = send;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openSend = openSend;
window.closeSend = closeSend;
window.addSetting = addSetting;
window.saveSettings = saveSettings;
