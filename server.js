const FormData = require("form-data");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.static("public"));

const SETTINGS_FILE = "settings.json";

/* =========================
   OCR（Google Vision）
========================= */
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const image = fs.readFileSync(req.file.path);

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image.toString("base64") },
              features: [{ type: "TEXT_DETECTION" }]
            }
          ]
        })
      }
    );

    const data = await response.json();

    const text =
      data.responses?.[0]?.fullTextAnnotation?.text || "";

    /* =========================
       口座番号抽出（改良版）
    ========================= */
    const lines = text.split("\n");

    let account = "不明";

    for (let i = 0; i < lines.length; i++) {
      if (/口座|当座|普通/.test(lines[i])) {

        for (let j = i; j < i + 3; j++) {
          if (!lines[j]) continue;

          const match = lines[j].match(/\d{6,8}/);
          if (match) {
            account = match[0];
            break;
          }
        }
      }
    }

    fs.unlinkSync(req.file.path);

    res.json({ text, account });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "OCR失敗" });
  }
});

/* =========================
   設定取得
========================= */
app.get("/settings", (req, res) => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return res.json([]);
    }

    const data = fs.readFileSync(SETTINGS_FILE);
    res.json(JSON.parse(data));

  } catch {
    res.json([]);
  }
});

/* =========================
   設定保存
========================= */
app.post("/settings", (req, res) => {
  try {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(req.body, null, 2)
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "保存失敗" });
  }
});

/* =========================
   Chatwork送信（画像 + メッセージ）
========================= */
app.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { message, roomId } = req.body;

    // ① 画像送信
    if (req.file) {
      const formData = new FormData();
      formData.append("file", fs.createReadStream(req.file.path));

      await fetch(
        `https://api.chatwork.com/v2/rooms/${roomId}/files`,
        {
          method: "POST",
          headers: {
            "X-ChatWorkToken": process.env.CHATWORK_TOKEN
          },
          body: formData
        }
      );

      fs.unlinkSync(req.file.path);
    }

    // ② 少し待つ（順番対策）
    await new Promise(r => setTimeout(r, 1000));

    // ③ メッセージ送信
    await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: {
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ body: message })
      }
    );

    res.json({ success: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "送信失敗" });
  }
});

app.listen(10000, () => console.log("Server started"));
