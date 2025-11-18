const functions = require('firebase-functions');
const fs = require('fs');
const path = require('path');

// 導入完整的 web service
const { app } = require('./web-service-core');

// 前端頁面路由
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'frontend.html');
  
  if (fs.existsSync(htmlPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.send(html);
  } else {
    res.json({
      service: '雲端自動補卡服務',
      status: 'running',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    });
  }
});

// 導出為 Firebase Function
exports.api = functions
  .region('asia-east1')
  .runWith({
    timeoutSeconds: 540,
    memory: '4GB',
    maxInstances: 10
  })
  .https.onRequest(app);
