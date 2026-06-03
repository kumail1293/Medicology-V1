# Quick Start Script for Medicology App (PowerShell)
# Run: .\start-app.ps1

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "           Medicology App - Quick Start Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
$pnpmCheck = pnpm --version 2>$null
if (-not $pnpmCheck) {
    Write-Host "❌ pnpm is not installed. Installing now..." -ForegroundColor Red
    npm install -g pnpm
    Write-Host "✓ pnpm installed" -ForegroundColor Green
}

Write-Host "✓ Installing dependencies..." -ForegroundColor Green
pnpm install

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "           Starting Servers (Opening two windows)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Start API Server in a new PowerShell window
Write-Host "Starting API Server..." -ForegroundColor Yellow
$apiScriptBlock = {
    Set-Location "$PSScriptRoot\artifacts\api-server"
    pnpm dev
    Read-Host "Press Enter to close this window"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiScriptBlock

# Wait for API to start
Start-Sleep -Seconds 3

# Start Frontend in a new PowerShell window
Write-Host "Starting Frontend..." -ForegroundColor Yellow
$webScriptBlock = {
    Set-Location "$PSScriptRoot\artifacts\medicology"
    pnpm dev
    Read-Host "Press Enter to close this window"
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webScriptBlock

Write-Host ""
Write-Host "✓ Both servers are starting in separate windows" -ForegroundColor Green
Write-Host "✓ The app will open on http://localhost:5173" -ForegroundColor Green
Write-Host "✓ API is running on http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to close this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
