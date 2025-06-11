#!/bin/bash

# 🤖 自動補卡程式 - 一鍵執行腳本（可雙擊執行）
# 適用於 macOS 系統

# 切換到腳本所在的目錄（這就是專案目錄）
cd "$(dirname "$0")"

# 顯示歡迎訊息
echo "🤖 自動補卡程式 - 一鍵執行"
echo "=========================="
echo ""
echo "當前目錄：$(pwd)"
echo ""

# 檢查是否在正確的專案目錄
if [ ! -f "package.json" ]; then
    echo "❌ 錯誤：未找到 package.json 檔案"
    echo "請確認此腳本位於專案根目錄中"
    read -p "按 Enter 鍵關閉視窗..."
    exit 1
fi

# 檢查是否已安裝依賴
if [ ! -d "node_modules" ]; then
    echo "⚠️  警告：未找到 node_modules 資料夾"
    echo "請先執行安裝腳本："
    echo "   - 雙擊 install.command 檔案"
    echo "   - 或在終端機執行 ./install.sh"
    echo ""
    read -p "按 Enter 鍵關閉視窗..."
    exit 1
fi

# 檢查配置檔案
if [ ! -f "data/user-info.txt" ]; then
    echo "⚠️  警告：未找到配置檔案 data/user-info.txt"
    echo "請先設定個人資訊："
    echo "   1. 進入 data 資料夾"
    echo "   2. 編輯 user-info.txt 檔案"
    echo "   3. 填入登入資訊和補卡日期"
    echo ""
    read -p "按 Enter 鍵關閉視窗..."
    exit 1
fi

# 顯示即將執行的動作
echo "🚀 準備執行自動補卡程式..."
echo ""
echo "📋 檢查清單："
echo "   ✅ 專案目錄正確"
echo "   ✅ 依賴套件已安裝" 
echo "   ✅ 配置檔案存在"
echo ""
echo "⚠️  注意事項："
echo "   - 請確保 Google Chrome 已安裝"
echo "   - 程式執行期間請勿關閉瀏覽器"
echo "   - 執行完成後會自動關閉瀏覽器"
echo ""
read -p "按 Enter 鍵開始執行，或按 Ctrl+C 取消..."
echo ""

# 執行程式
echo "🔄 正在啟動自動補卡程式..."
echo "----------------------------------------"
npm start

# 檢查執行結果
EXIT_CODE=$?
echo ""
echo "----------------------------------------"

if [ $EXIT_CODE -eq 0 ]; then
    echo "🎉 程式執行完成！"
    echo ""
    echo "📊 執行結果："
    echo "   - 請檢查終端機輸出的執行結果"
    echo "   - 詳細日誌記錄在 logs/ 資料夾中"
    echo "   - 執行過程截圖在 screenshots/ 資料夾中"
else
    echo "❌ 程式執行時發生錯誤（錯誤代碼：$EXIT_CODE）"
    echo ""
    echo "🔍 故障排除建議："
    echo "   1. 檢查 data/user-info.txt 中的帳號密碼"
    echo "   2. 確認 Google Chrome 已正確安裝"
    echo "   3. 查看 logs/ 資料夾中的最新日誌檔案"
    echo "   4. 參考 README.md 的故障排除章節"
fi

echo ""
echo "💡 提示："
echo "   - 如需查看執行日誌：在終端機執行 npm run logs"
echo "   - 如需重新執行：再次雙擊此檔案"
echo "   - 如遇問題請參考 README.md"
echo ""
read -p "按 Enter 鍵關閉視窗..."
