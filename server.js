const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");
const FormData = require("form-data");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   🔥 口座番号抽出ロジック（ここが今回の本命）
========================= */
function extractAccountNumber(text) {
  if (!text) return "不明";

  const lines = text.split("\n");

  const keywords = ["口座", "口座番号", "当座", "普通"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (keywords.some(k => line.includes(k))) {

      // 同じ行
      let match = line.match(/\d{6,8}/);
      if (match) return match[0];

      // 次の行
      if (lines[i + 1]) {
        match = lines[i + 1].match(/\d{6,8}/);
        if (match) return match[0];
      }

      // 前の行
      if (lines[i - 1]) {
        match = lines[i - 1].match(/\d{6,8}/);
        if (match) return match[0];
      }
    }
  }

  return "不明";
}

/* =========================
   OCR
========================= */
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "TEXT_DETECTION" }]
          }
        ]
      }
    );

    const text =
      response.data.responses[0].fullTextAnnotation?.text || "";

    // 🔥ここが変更ポイント
    const account = extractAccountNumber(text);

    res.json({ text, account });

  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: "OCR失敗" });
  }
});

/* =========================
   ファイル送信（Chatwork）
========================= */
app.post("/send", upload.single("file"), async (req, res) => {
  try {
    const roomId = req.body.roomId;

    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);

    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/files`,
      form,
      {
        headers: {
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
          ...form.getHeaders()
        }
      }
    );

    res.json({ success: true });

  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: "ファイル送信失敗" });
  }
});

/* =========================
   メッセージ送信
========================= */
app.post("/sendMessage", async (req, res) => {
  try {
    const { roomId, message } = req.body;

    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      new URLSearchParams({ body: message }),
      {
        headers: {
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    res.json({ success: true });

  } catch (e) {
    console.error(e.response?.data || e.message);
    res.status(500).json({ error: "メッセージ送信失敗" });
  }
});

/* =========================
   起動
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server started:", PORT);
});
