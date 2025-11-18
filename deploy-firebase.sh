#!/bin/bash

echo "🚀 Firebase 部署腳本"
echo "===================="

# 檢查 Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI 未安裝"
    echo "請執行: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI 已安裝"

# 檢查是否已登入
if ! firebase projects:list &> /dev/null; then
    echo "❌ 尚未登入 Firebase"
    echo "請執行: firebase login"
    exit 1
fi

echo "✅ 已登入 Firebase"

# 安裝依賴
echo ""
echo "📦 安裝依賴..."
npm install

# 編譯 TypeScript
echo ""
echo "🔨 編譯 TypeScript..."
npm run build:web

if [ $? -ne 0 ]; then
    echo "❌ 編譯失敗"
    exit 1
fi

echo "✅ 編譯成功"

# 部署到 Firebase
echo ""
echo "🚀 部署到 Firebase Functions..."
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "你的 API 端點："
    echo "https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api"
else
    echo "❌ 部署失敗"
    exit 1
fi
