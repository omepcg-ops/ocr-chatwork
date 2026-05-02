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

      // 🔥ここで会社名に変換
      const match = settings.find(s => s.account === data.account);

      results.push({
        file,
        text: data.text || "取得失敗",
        account: data.account || "不明",
        name: match ? match.name : "未登録",
        roomId: match ? match.roomId : ""
      });

    } catch (err) {
      console.error(err);
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
        会社名: <span style="color:blue">${r.name}</span><br>
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
   設定管理（🔥修正ポイント）
========================= */
function addSetting() {
  const account = document.getElementById("account").value;
  const name = document.getElementById("name").value;
  const roomId = document.getElementById("room").value;

  if (!account || !name || !roomId) {
    alert("全部入力して");
    return;
  }

  settings.push({ account, name, roomId });
  renderSettings();

  document.getElementById("account").value = "";
  document.getElementById("name").value = "";
  document.getElementById("room").value = "";
}

function renderSettings() {
  const box = document.getElementById("settingsList");
  box.innerHTML = "";

  settings.forEach((s, i) => {
    const div = document.createElement("div");
    div.innerHTML = `
      ${s.name} : ${s.account} (room:${s.roomId})
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
   Chatwork送信（🔥ここも修正）
========================= */
async function send() {

  if (!results.length) {
    alert("データなし");
    return;
  }

  try {
    for (let r of results) {

      if (!r.roomId) {
        alert(`${r.name} のルームIDが未設定`);
        return;
      }

      // 🔥 ①メッセージ先に送る
      await fetch("/sendMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roomId: r.roomId,
          message: document.getElementById("msg").value
        })
      });

      // 🔥 ②画像を後に送る（これが上に表示される）
      const formData = new FormData();
      formData.append("file", r.file);
      formData.append("roomId", r.roomId);

      await fetch("/send", {
        method: "POST",
        body: formData
      });
    }

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

  document.getElementById("msg").value =
`お世話になっております。
昨日到着分の振込は完了致しました。
お手すきの際にご確認のほど宜しくお願いいたします。`;
};

/* =========================
   HTML連携
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
