let results = [];
let settings = [];

/* OCR */
async function upload() {

  showLoading("OCR解析中...");

  const files =
    document.getElementById("files").files;

  results = [];

  for (let file of files) {

    const formData =
      new FormData();

    formData.append("file", file);

    const res =
      await fetch("/ocr", {
        method: "POST",
        body: formData
      });

    const data =
      await res.json();

    /* 型違い対策 */
    const match =
      settings.find(
        s =>
          String(s.account).trim() ===
          String(data.account).trim()
      );

    results.push({
      file,
      text: data.text,
      account: data.account,
      name:
        match ? match.name : "未登録",
      roomId:
        match ? match.roomId : "",
      isUnknown: !match
    });

  }

  hideLoading();

  render();

}

/* 表示 */
function render() {

  const list =
    document.getElementById("list");

  list.innerHTML = "";

  const grouped = {};

  results.forEach(r => {

    if (!grouped[r.account]) {

      grouped[r.account] = {
        ...r,
        items: []
      };

    }

    grouped[r.account]
      .items.push(r);

  });

  Object.values(grouped)
    .forEach(group => {

      const div =
        document.createElement("div");

      div.className =
        group.isUnknown
          ? "card unknown-card"
          : "card";

      div.innerHTML = `

        <div class="row">

          <div>

            <div class="title">
              ${group.name}
            </div>

            <div>
              口座番号:
              <span class="${
                group.isUnknown
                  ? "error"
                  : "ok"
              }">
                ${group.account}
              </span>
            </div>

            <div>
              枚数:
              ${group.items.length}枚
            </div>

          </div>

          <button
            class="preview-btn"
            onclick='previewImages(${JSON.stringify(group.items.map(i => URL.createObjectURL(i.file)))})'
          >
            表示
          </button>

        </div>

      `;

      list.appendChild(div);

    });

}

/* プレビュー */
function previewImages(images) {

  let current = 0;

  const modal =
    document.createElement("div");

  modal.className =
    "preview-modal";

  modal.innerHTML = `

    <button class="close-preview">
      ✕
    </button>

    <img
      id="preview-img"
      src="${images[0]}"
    >

    <div class="preview-actions">
      <button id="prev-btn">←</button>
      <button id="next-btn">→</button>
    </div>

  `;

  document.body.appendChild(modal);

  const img =
    modal.querySelector("#preview-img");

  modal.querySelector("#prev-btn")
    .onclick = () => {

      current--;

      if (current < 0)
        current = images.length - 1;

      img.src = images[current];

    };

  modal.querySelector("#next-btn")
    .onclick = () => {

      current++;

      if (current >= images.length)
        current = 0;

      img.src = images[current];

    };

  modal.querySelector(".close-preview")
    .onclick = () => {

      modal.remove();

    };

}

/* 送信 */
async function send() {

  /* 未登録チェック */
  const unknown =
    results.find(r => !r.roomId);

  if (unknown) {

    alert(
      `未登録の口座があります\n\n口座番号: ${unknown.account}`
    );

    return;

  }

  showLoading("送信中...");

  const msg =
    document.getElementById("msg").value;

  const grouped = {};

  results.forEach(r => {

    if (!grouped[r.roomId]) {

      grouped[r.roomId] = [];

    }

    grouped[r.roomId].push(r);

  });

  for (let roomId in grouped) {

    const items =
      grouped[roomId];

    for (let r of items) {

      const formData =
        new FormData();

      formData.append("file", r.file);
      formData.append("roomId", roomId);

      await fetch("/send", {
        method: "POST",
        body: formData
      });

    }

    await new Promise(
      r => setTimeout(r, 3000)
    );

    await fetch(
      "/sendMessageOnly",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          roomId,
          message: msg
        })
      }
    );

  }

  hideLoading();

  alert("送信完了");

  results = [];

  document.getElementById("list")
    .innerHTML = "";

  document.getElementById("files")
    .value = "";

}

/* 設定 */
function addSetting() {

  const account =
    document.getElementById("account").value;

  const name =
    document.getElementById("name").value;

  const room =
    document.getElementById("room").value;

  settings.push({
    account,
    name,
    roomId: room
  });

  renderSettings();

}

function renderSettings() {

  const box =
    document.getElementById("settingsList");

  box.innerHTML = "";

  settings.forEach((s, i) => {

    const div =
      document.createElement("div");

    div.innerHTML = `
      ${s.name}
      (${s.account})
      [${s.roomId}]
    `;

    box.appendChild(div);

  });

}

async function saveSettings() {

  await fetch("/settings", {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json"
    },
    body:
      JSON.stringify(settings)
  });

  alert("保存完了");

}

window.onload = async () => {

  const res =
    await fetch("/settings");

  settings =
    await res.json();

  renderSettings();

};

function openSettings() {
  document.getElementById("settings").style.display = "block";
}

function closeSettings() {
  document.getElementById("settings").style.display = "none";
}

function openSend() {

  document.getElementById("sendBox").style.display = "block";

  document.getElementById("msg").value =
`お世話になっております。
昨日到着分の振込は完了致しました。
お手すきの際にご確認のほど宜しくお願いいたします。`;

}

function closeSend() {
  document.getElementById("sendBox").style.display = "none";
}

function showLoading(text) {

  let loading =
    document.getElementById("loading");

  if (!loading) {

    loading =
      document.createElement("div");

    loading.id = "loading";

    document.body.appendChild(loading);

  }

  loading.innerHTML = `
    <div class="loading-box">
      <div class="spinner"></div>
      <div>${text}</div>
    </div>
  `;

  loading.style.display = "flex";

}

function hideLoading() {

  const loading =
    document.getElementById("loading");

  if (loading)
    loading.style.display = "none";

}

window.upload = upload;
window.send = send;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.openSend = openSend;
window.closeSend = closeSend;
window.addSetting = addSetting;
window.saveSettings = saveSettings;
