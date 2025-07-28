# macOS 程式簽名解決方案

## 🔐 方案 1A：Apple Developer 簽名（最完整）

### 所需條件
- Apple Developer Program 會員資格（年費 $99 USD）
- Developer ID Application Certificate

### 實施步驟
1. **申請開發者帳號**
   ```bash
   # 前往 https://developer.apple.com/programs/
   # 申請 Apple Developer Program
   ```

2. **程式簽名**
   ```bash
   # 簽名腳本檔案
   codesign --sign "Developer ID Application: Your Name" install.command
   codesign --sign "Developer ID Application: Your Name" run.command
   
   # 簽名整個應用程式包
   codesign --sign "Developer ID Application: Your Name" --deep auto-re-check.app
   ```

3. **公證（Notarization）**
   ```bash
   # 建立 ZIP 檔案
   ditto -c -k --keepParent auto-re-check.app auto-re-check.zip
   
   # 提交公證
   xcrun notarytool submit auto-re-check.zip \
     --apple-id your-email@example.com \
     --password app-specific-password \
     --team-id YOUR_TEAM_ID
   
   # 裝訂公證票據
   xcrun stapler staple auto-re-check.app
   ```

## 🔓 方案 1B：簡單的程式包裝

### 建立 .app 格式程式包
```bash
# 建立應用程式結構
mkdir -p AutoReCheck.app/Contents/{MacOS,Resources}

# 建立 Info.plist
cat > AutoReCheck.app/Contents/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>自動補卡程式</string>
    <key>CFBundleExecutable</key>
    <string>run</string>
    <key>CFBundleIdentifier</key>
    <string>com.yourname.auto-re-check</string>
    <key>CFBundleName</key>
    <string>AutoReCheck</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
</dict>
</plist>
EOF

# 複製執行檔案
cp run.command AutoReCheck.app/Contents/MacOS/run
chmod +x AutoReCheck.app/Contents/MacOS/run
```

## 🛡️ 方案 1C：用戶端安全設定指導

建立一個詳細的安裝指南，教用戶如何安全地允許程式執行：

### 用戶操作步驟
1. **右鍵點擊** install.command
2. 選擇「**打開**」
3. 在彈出對話框中點擊「**打開**」
4. 或者前往「**系統偏好設定 > 安全性與隱私**」允許執行

這種方法不需要開發者費用，但需要用戶手動操作。
