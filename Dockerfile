FROM node:18-alpine

# 設定時區為台灣時區
ENV TZ=Asia/Taipei

# 安裝 Chromium 和必要的依賴
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    tzdata

# 設定 Puppeteer 使用系統 Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 設定工作目錄
WORKDIR /app

# 複製 package 檔案
COPY package*.json ./

# 安裝依賴
RUN npm ci --only=production

# 複製原始碼
COPY src/ ./src/
COPY tsconfig.json ./

# 編譯 TypeScript
RUN npm run build:web

# 暴露端口
EXPOSE 3000

# 啟動命令
CMD ["node", "dist/web-service.js"] 