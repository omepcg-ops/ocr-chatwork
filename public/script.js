/* =========================
   モーダル制御
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
   設定管理（簡易）
========================= */
let settings = [];

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

  settings.forEach(s => {
    const div = document.createElement("div");
    div.innerText = `${s.name} : ${s.account}`;
    box.appendChild(div);
  });
}

function saveSettings() {
  localStorage.setItem("settings", JSON.stringify(settings));
  alert("保存した");
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
