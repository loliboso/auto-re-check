#!/bin/bash

# 🤖 自動補卡程式 - 一鍵安裝腳本（可雙擊執行版本）
# 適用於 macOS 系統

# 切換到腳本所在的目錄
cd "$(dirname "$0")"

# 顯示歡迎訊息
echo "🤖 自動補卡程式 - 一鍵安裝腳本"
echo "=================================="
echo ""
echo "此腳本將自動安裝所需的環境，包括："
echo "- Xcode Command Line Tools"
echo "- Homebrew"
echo "- Node.js"
echo "- 專案依賴套件"
echo ""
read -p "按 Enter 鍵開始安裝，或按 Ctrl+C 取消..."
echo ""

set -e  # 遇到錯誤立即停止

echo "🚀 開始安裝自動補卡程式環境..."
echo ""

# 檢查是否為 macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ 錯誤：此腳本僅支援 macOS 系統"
    read -p "按 Enter 鍵關閉視窗..."
    exit 1
fi

# 函數：檢查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. 安裝 Xcode Command Line Tools (如果尚未安裝)
echo "🔧 檢查 Xcode Command Line Tools..."
if ! command_exists git; then
    echo "📦 正在安裝 Xcode Command Line Tools..."
    xcode-select --install
    echo "⏳ 請等待 Xcode Command Line Tools 安裝完成，然後重新執行此腳本"
    read -p "按 Enter 鍵關閉視窗..."
    exit 0
else
    echo "✅ Xcode Command Line Tools 已安裝"
fi

# 2. 安裝 Homebrew (如果尚未安裝)
echo ""
echo "🍺 檢查 Homebrew..."
if ! command_exists brew; then
    echo "📦 正在安裝 Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # 添加 Homebrew 到 PATH
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
    
    echo "✅ Homebrew 安裝完成"
else
    echo "✅ Homebrew 已安裝"
fi

# 3. 安裝 Node.js (如果尚未安裝)
echo ""
echo "🟢 檢查 Node.js..."
if ! command_exists node || ! command_exists npm; then
    echo "📦 正在安裝 Node.js..."
    brew install node
    echo "✅ Node.js 安裝完成"
else
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安裝 (版本: $NODE_VERSION)"
fi

# 4. 檢查 Google Chrome
echo ""
echo "🌐 檢查 Google Chrome..."
if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "⚠️  警告：未找到 Google Chrome"
    echo "📥 請手動安裝 Google Chrome："
    echo "   1. 前往 https://www.google.com/chrome/"
    echo "   2. 下載並安裝 Chrome"
    echo "   3. 確保安裝在 /Applications/Google Chrome.app/"
    echo ""
else
    echo "✅ Google Chrome 已安裝"
fi

# 5. 安裝專案依賴
echo ""
echo "📦 安裝專案依賴套件..."
npm install

# 6. 編譯專案
echo ""
echo "🔨 編譯程式..."
npm run build

# 7. 檢查安裝結果
echo ""
echo "🧪 驗證安裝..."
if npm run check > /dev/null 2>&1; then
    echo "✅ 所有環境檢查通過"
else
    echo "⚠️  部分檢查未通過，請查看上方訊息"
fi

# 8. 處理配置檔案
echo ""
echo "📝 設定配置檔案..."
if [ ! -f "data/user-info.txt" ]; then
    if [ -f "data/user-info.txt.example" ]; then
        cp "data/user-info.txt.example" "data/user-info.txt"
        echo "✅ 已創建 data/user-info.txt 配置檔案"
        echo "💡 請編輯此檔案填入您的登入資訊"
    else
        echo "⚠️  未找到範例配置檔案"
    fi
else
    echo "✅ 配置檔案已存在"
fi

echo ""
echo "🎉 安裝完成！"
echo ""
echo "🚀 程式功能："
echo "   🤖 無頭模式：快速執行（約 34 秒，推薦）"
echo "   🖥️ 有界面模式：可視化過程（約 45 秒）"
echo ""
echo "📝 下一步："
echo "   1. 編輯 data/user-info.txt 設定個人資訊"
echo "      - 填入您的公司代碼、帳號、密碼"
echo "      - 設定需要補卡的日期"
echo "   2. 選擇執行方式："
echo "      🖱️  雙擊 run.command（推薦，支援模式選擇）"
echo "      ⌨️  終端機執行："
echo "         - npm run start:headless（無頭模式）"
echo "         - npm start（有界面模式）"
echo ""
echo "💡 提示："
echo "   - 📁 配置檔案：data/user-info.txt"
echo "   - 📚 詳細說明：README.md"
echo "   - 🐛 故障排除：查看 logs/ 資料夾"
echo "   - 📸 執行截圖：screenshots/ 資料夾"
echo ""
echo "🎯 推薦使用無頭模式，速度提升 5.6 倍！"
echo ""
read -p "按 Enter 鍵關閉視窗..."
