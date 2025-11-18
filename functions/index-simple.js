const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

// 創建 Express app
const app = express();

// 中間件
app.use(cors());
app.use(express.json());

// 健康檢查
app.get('/', (req, res) => {
  res.json({
    service: '雲端自動補卡服務',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works!' });
});

// 導出為 Firebase Function
exports.api = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540,
    memory: '2GB'
  })
  .https.onRequest(app);
