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

const SETTINGS_FILE = "settings.json";

/* OCR */
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const ext = req.file.originalname.toLowerCase();

    let imageBuffer;

    // HEICは変換しない（回避）
    if (ext.endsWith(".heic")) {
      console.log("HEICスキップ");
      return res.json({ text: "", account: "不明" });
    }

    const convertedPath = req.file.path + ".jpg";

    await sharp(req.file.path)
      .jpeg({ quality: 90 })
      .toFile(convertedPath);

    imageBuffer = fs.readFileSync(convertedPath);

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBuffer.toString("base64") },
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
    fs.unlinkSync(convertedPath);

    res.json({ text, account });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "OCR失敗" });
  }
});

/* Chatwork送信 */
app.post("/send", upload.single("file"), async (req, res) => {
  try {
    const { message, roomId } = req.body;

    const filePath = req.file.path;

    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));
    formData.append("message", "納品書です");

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

    // 待機（長め）
    await new Promise(r => setTimeout(r, 4000));

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

    fs.unlinkSync(filePath);

    res.json({ success: true });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "送信失敗" });
  }
});

app.listen(10000, () => console.log("Server started"));
