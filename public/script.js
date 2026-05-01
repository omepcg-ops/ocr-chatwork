let results = [];

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
        text: data.text,
        account: data.account
      });

    } catch (err) {
      console.error(err);
    }
  }

  render();
}

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
   Chatwork送信
========================= */
async function send() {
  const msg = document.getElementById("msg").value;
  const roomId = document.getElementById("room").value;

  let text = msg + "\n\n";

  results.forEach(r => {
    text += `口座番号: ${r.account}\n`;
  });

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
}
