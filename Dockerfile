FROM node:18-slim

# 安裝 Chromium 和依賴
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# 設定工作目錄
WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝依賴（跳過 Chromium 下載）
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --only=production

# 複製程式碼
COPY . .

# 編譯
RUN npm run build:web

# 設定環境變數
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# 暴露端口
EXPOSE 3000

# 啟動
CMD ["npm", "run", "start:web"]
