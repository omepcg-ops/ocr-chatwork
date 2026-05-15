const FormData = require("form-data");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fetch = require("node-fetch");
const sharp = require("sharp");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.json());
app.use(express.static("public"));

/* =========================
   OCR（JPG強制変換）
========================= */
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const jpgPath = req.file.path + ".jpg";

    await sharp(req.file.path)
      .jpeg({ quality: 90 })
      .toFile(jpgPath);

    const image = fs.readFileSync(jpgPath);

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
    const text = data.responses?.[0]?.fullTextAnnotation?.text || "";

    let account = "不明";
    const lines = text.split("\n");

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
    fs.unlinkSync(jpgPath);

    res.json({ text, account });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "OCR失敗" });
  }
});

/* =========================
   Chatwork送信（画像表示確定版）
========================= */
app.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { message, roomId } = req.body;

    const jpgPath = req.file.path + ".jpg";

    // 🔥 必ずJPG変換
    await sharp(req.file.path)
      .jpeg({ quality: 90 })
      .toFile(jpgPath);

    /* ===== 画像送信（ここが重要） ===== */
    const formData = new FormData();

    formData.append("file", fs.createReadStream(jpgPath), {
      filename: "upload.jpg",
      contentType: "image/jpeg"
    });

    await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/files`,
      {
        method: "POST",
        headers: {
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
          ...formData.getHeaders()
        },
        body: formData
      }
    );

    /* ===== 順番制御 ===== */
    await new Promise(r => setTimeout(r, 4000));

    /* ===== メッセージ ===== */
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

    fs.unlinkSync(req.file.path);
    fs.unlinkSync(jpgPath);

    res.json({ success: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "送信失敗" });
  }
});

app.listen(10000, () => console.log("Server started"));
