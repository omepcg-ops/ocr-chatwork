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

    const accountMatch = text.match(/\d{6,8}/);
    const account = accountMatch ? accountMatch[0] : "不明";

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
