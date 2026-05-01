require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ★uploads公開
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({ dest: 'uploads/' });

/* ===== mappingファイルのパス固定 ===== */
const mappingPath = path.join(__dirname, 'mapping.json');

/* ===== 初期ファイル作成 ===== */
if (!fs.existsSync(mappingPath)) {
  fs.writeFileSync(mappingPath, '[]');
}

/* ===== 設定 ===== */
function loadMapping() {
  try {
    const data = fs.readFileSync(mappingPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error("読み込みエラー:", e);
    return [];
  }
}

function saveMapping(data) {
  try {
    fs.writeFileSync(mappingPath, JSON.stringify(data, null, 2));
    console.log("保存成功:", data);
  } catch (e) {
    console.error("保存失敗:", e);
  }
}

let mapping = loadMapping();

/* ===== OCR ===== */
async function runOCR(imagePath) {
  try {
    const processed = imagePath + "_cut.jpg";

    const img = sharp(imagePath);
    const meta = await img.metadata();

    await img
      .extract({
        left: 0,
        top: Math.floor(meta.height * 0.4),
        width: meta.width,
        height: Math.floor(meta.height * 0.6)
      })
      .grayscale()
      .normalize()
      .sharpen()
      .toFile(processed);

    const result = await Tesseract.recognize(processed, 'eng');
    return result.data.text;

  } catch (e) {
    console.log("OCR error", e);
    return "";
  }
}

/* ===== 数字補正 ===== */
function normalizeNumber(str) {
  return str
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/I/g, '1')
    .replace(/l/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

/* ===== 口座抽出 ===== */
function extractAccountCandidates(text) {
  if (!text) return [];

  text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  const keywords = ["口座","銀行","振込","普通","当座","番号"];
  let candidates = [];

  for (let k of keywords) {
    const matches = text.match(new RegExp(`${k}.{0,60}`, 'g'));
    if (matches) {
      matches.forEach(area => {
        let nums = area.match(/\d{6,8}/g) || [];
        nums = nums.map(n => normalizeNumber(n))
                   .filter(n => Number(n) > 100000);
        candidates.push(...nums);
      });
    }
  }

  let all = text.match(/\d{6,8}/g) || [];
  all = all.map(n => normalizeNumber(n))
           .filter(n => Number(n) > 100000);

  candidates.push(...all);

  return [...new Set(candidates)];
}

/* ===== OCR処理 ===== */
app.post('/upload', upload.array('images'), async (req, res) => {
  const results = [];

  for (let file of req.files) {
    const text = await runOCR(file.path);
    const nums = extractAccountCandidates(text);

    let found = null;

    for (let n of nums) {
      found = mapping.find(m =>
        n === m.account ||
        n.includes(m.account) ||
        m.account.includes(n)
      );
      if (found) break;
    }

    results.push({
      file: file.filename,
      company: found ? found.name : "不明",
      status: found ? "ok" : "error",
      roomId: found ? found.roomId : null
    });
  }

  res.json(results);
});

/* ===== 送信 ===== */
app.post('/send', async (req, res) => {
  try {
    const { list, message } = req.body;

    const groups = {};

    list.forEach(item => {
      if (!item.roomId) return;
      if (!groups[item.roomId]) groups[item.roomId] = [];
      groups[item.roomId].push(item);
    });

    for (let roomId in groups) {

      for (let item of groups[roomId]) {
        const filePath = path.join(__dirname, 'uploads', item.file);

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), {
          filename: `${item.company || 'invoice'}.jpg`,
          contentType: 'image/jpeg'
        });

        await axios.post(
          `https://api.chatwork.com/v2/rooms/${roomId}/files`,
          form,
          {
            headers: {
              'X-ChatWorkToken': process.env.CHATWORK_TOKEN,
              ...form.getHeaders()
            }
          }
        );

        await new Promise(r => setTimeout(r, 800));
      }

      await new Promise(r => setTimeout(r, 2000));

      await axios.post(
        `https://api.chatwork.com/v2/rooms/${roomId}/messages`,
        `body=${encodeURIComponent(message)}`,
        {
          headers: {
            'X-ChatWorkToken': process.env.CHATWORK_TOKEN,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("送信エラー:", err);
    res.status(500).json({ error: "送信失敗" });
  }
});

/* ===== 設定 ===== */
app.get('/settings', (req, res) => {
  mapping = loadMapping();
  res.json(mapping);
});

app.post('/settings', (req, res) => {
  try {
    console.log("受信データ:", req.body);

    mapping = req.body;
    saveMapping(mapping);

    res.json({ success: true });

  } catch (e) {
    console.error("保存エラー:", e);
    res.status(500).json({ error: "保存失敗" });
  }
});

/* ===== 起動 ===== */
app.listen(3000, () => {
  console.log("Server started");
});