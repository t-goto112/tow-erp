# OWASP ZAP 脆弱性診断実行スクリプト (TOWMEI ERP用)
# このスクリプトは、指定されたURLに対してベースラインスキャンを実行します。

# 設定: 診断対象のURL (localhost等)
$TARGET_URL = "http://localhost:3000"
$REPORT_DIR = "$(Get-Location)/security/reports"
$ZAP_CONFIG = "$(Get-Location)/security/zap_baseline.conf"

if (!(Test-Path $REPORT_DIR)) {
    New-Item -ItemType Directory -Path $REPORT_DIR -Force
}

Write-Host "--- セキュリティ診断 (OWASP ZAP) を開始します ---" -ForegroundColor Cyan
Write-Host "Target: $TARGET_URL"
Write-Host "Config: $ZAP_CONFIG"

# 1. Docker がインストールされているか確認
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[Info] Docker を使用して ZAP を実行します..." -ForegroundColor Green
    
    # 最新の Docker ZAP ベースラインイメージを使用
    docker run --rm -v ${REPORT_DIR}:/zap/wrk/:rw `
        ghcr.io/zaproxy/zaproxy:baseline `
        zap-baseline.py -t $TARGET_URL `
        -c /zap/wrk/../zap_baseline.conf `
        -r report.html

    Write-Host "[Success] 診断が完了しました。レポート: security/reports/report.html" -ForegroundColor Green
}
# 2. ローカルに ZAP がインストールされているか確認 (Windows標準パス)
elseif (Test-Path "C:\Program Files\ZAP\Zed Attack Proxy\zap.bat") {
    Write-Host "[Info] ローカルの ZAP を使用して CLI モードで実行します..." -ForegroundColor Green
    & "C:\Program Files\ZAP\Zed Attack Proxy\zap.bat" -cmd -quickurl $TARGET_URL -quickout "$REPORT_DIR/report.html"
    Write-Host "[Success] 診断が完了しました。レポート: security/reports/report.html" -ForegroundColor Green
}
else {
    Write-Host "[Error] OWASP ZAP または Docker が検出されませんでした。" -ForegroundColor Red
    Write-Host "脆弱性診断を実行するには、以下のいずれかを導入してください："
    Write-Host "1. Docker Desktop (推奨: セットアップが容易です)"
    Write-Host "2. OWASP ZAP 本体 (https://www.zaproxy.org/download/)"
    Write-Host ""
    Write-Host "導入後、このスクリプトを再度実行してください。"
}

Write-Host "--- 診断終了 ---" -ForegroundColor Cyan
