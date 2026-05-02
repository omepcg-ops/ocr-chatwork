const express = require("express");
const multer = require("multer");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   Google Vision OCR
========================= */
app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "ファイルなし" });
    }

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
      response.data.responses[0]?.fullTextAnnotation?.text || "";

    console.log("OCR結果:", text);

    const account = extractAccountNumber(text);

    res.json({
      text,
      account
    });

  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: "OCR失敗" });
  }
});

/* =========================
   口座番号抽出（超強化版）
========================= */
function extractAccountNumber(text) {
  if (!text) return "未判定";

  // 丸数字 → 通常数字
  const circleMap = {
    "①": "1","②": "2","③": "3","④": "4","⑤": "5",
    "⑥": "6","⑦": "7","⑧": "8","⑨": "9","⑩": "10",
    "⓪": "0"
  };

  let normalized = text;

  Object.keys(circleMap).forEach(k => {
    normalized = normalized.split(k).join(circleMap[k]);
  });

  // 全角→半角
  normalized = normalized.replace(/[０-９]/g, s =>
    String.fromCharCode(s.charCodeAt(0) - 65248)
  );

  // スペース削除（重要）
  const noSpace = normalized.replace(/\s/g, "");

  console.log("正規化:", noSpace);

  // 「口座番号」周辺を最優先で取る
  const keywordIndex = noSpace.indexOf("口座番号");

  let best = null;

  if (keywordIndex !== -1) {
    const area = noSpace.slice(keywordIndex, keywordIndex + 50);

    const match = area.match(/\d{6,10}/);
    if (match) {
      best = match[0];
      console.log("キーワード一致:", best);
      return best;
    }
  }

  // fallback（全体から候補）
  const candidates = noSpace.match(/\d{6,10}/g) || [];
  console.log("候補:", candidates);

  if (candidates.length === 0) return "未判定";

  // 最も長い数字を採用
  return candidates.sort((a, b) => b.length - a.length)[0];
}

/* =========================
   Chatwork送信
========================= */
app.post("/send", upload.single("file"), async (req, res) => {
  const { message, roomId } = req.body;

  try {
    // =========================
    // ① ファイル送信
    // =========================
    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);
    form.append("message", "納品書");

    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/files`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN
        }
      }
    );

    // =========================
    // ② メッセージ送信
    // =========================
    await axios.post(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      `body=${encodeURIComponent(message)}`,
      {
        headers: {
          "X-ChatWorkToken": process.env.CHATWORK_TOKEN,
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    res.json({ success: true });

  } catch (e) {
    console.error(e.response?.data || e);
    res.status(500).json({ error: "送信失敗" });
  }
});

/* =========================
   起動
========================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server started:", PORT);
});
