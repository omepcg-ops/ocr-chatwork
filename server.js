const FormData = require("form-data");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const fetch = require("node-fetch");
const sharp = require("sharp");

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbw9-UyNbZac8RJ_iyLz-OFwFyQa4nB4o7FSqzgrOkpBWjf8dyppHXLrP1nh_Xt22HlRhw/exec";

const app = express();

const upload = multer({
  dest: os.tmpdir()
});

app.use(express.json());
app.use(express.static("public"));

/* =========================
   OCR
========================= */
app.post("/ocr", upload.single("file"), async (req, res) => {

  try {

    const jpgPath =
      path.join(os.tmpdir(), `${Date.now()}.jpg`);

    await sharp(req.file.path)
      .jpeg({ quality: 90 })
      .toFile(jpgPath);

    const image =
      fs.readFileSync(jpgPath);

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content:
                  image.toString("base64")
              },
              features: [
                {
                  type:
                    "TEXT_DETECTION"
                }
              ]
            }
          ]
        })
      }
    );

    const data =
      await response.json();

    const text =
      data.responses?.[0]
        ?.fullTextAnnotation?.text || "";

    let account = "不明";

    const lines =
      text.split("\n");

    for (let i = 0; i < lines.length; i++) {

      if (/口座|普通|当座/.test(lines[i])) {

        for (let j = i; j < i + 3; j++) {

          if (!lines[j]) continue;

          const match =
            lines[j].match(/\d{6,8}/);

          if (match) {

            account = match[0];
            break;

          }

        }

      }

    }

    fs.unlinkSync(req.file.path);
    fs.unlinkSync(jpgPath);

    res.json({
      text,
      account
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: "OCR失敗"
    });

  }

});

/* =========================
   設定取得
========================= */
app.get("/settings", async (req, res) => {

  try {

    const response =
      await fetch(SHEETS_URL);

    const data =
      await response.json();

    res.json(data);

  } catch (e) {

    console.error(e);

    res.json([]);

  }

});

/* =========================
   設定保存
========================= */
app.post("/settings", async (req, res) => {

  try {

    await fetch(SHEETS_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body:
        JSON.stringify(req.body)
    });

    res.json({
      success: true
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: "保存失敗"
    });

  }

});

/* =========================
   画像送信
========================= */
app.post("/send", upload.single("file"), async (req, res) => {

  try {

    const { roomId } =
      req.body;

    const jpgPath =
      path.join(os.tmpdir(), `${Date.now()}.jpg`);

    await sharp(req.file.path)
      .jpeg({ quality: 90 })
      .toFile(jpgPath);

    const formData =
      new FormData();

    formData.append(
      "file",
      fs.createReadStream(jpgPath),
      {
        filename: "image.jpg",
        contentType:
          "image/jpeg"
      }
    );

    await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/files`,
      {
        method: "POST",
        headers: {
          "X-ChatWorkToken":
            process.env.CHATWORK_TOKEN,
          ...formData.getHeaders()
        },
        body: formData
      }
    );

    fs.unlinkSync(req.file.path);
    fs.unlinkSync(jpgPath);

    res.json({
      success: true
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error: "画像送信失敗"
    });

  }

});

/* =========================
   メッセージ送信
========================= */
app.post("/sendMessageOnly", async (req, res) => {

  try {

    const {
      message,
      roomId
    } = req.body;

    await fetch(
      `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
      {
        method: "POST",
        headers: {
          "X-ChatWorkToken":
            process.env.CHATWORK_TOKEN,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body:
          new URLSearchParams({
            body: message
          })
      }
    );

    res.json({
      success: true
    });

  } catch (e) {

    console.error(e);

    res.status(500).json({
      error:
        "メッセージ送信失敗"
    });

  }

});

app.listen(10000, () => {
  console.log("Server started");
});
