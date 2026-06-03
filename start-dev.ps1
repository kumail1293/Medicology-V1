#!/usr/bin/env pwsh
# Medicology Local Development Starter Script
# This script helps verify and start your local dev environment

Write-Host "`n🚀 MEDICOLOGY LOCAL DEVELOPMENT SETUP`n" -ForegroundColor Cyan

# Check Prerequisites
Write-Host "📋 Checking prerequisites...`n" -ForegroundColor Yellow

$nodeVersion = node --version
$pnpmVersion = pnpm --version
$gitVersion = git --version

Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
Write-Host "✅ pnpm: $pnpmVersion" -ForegroundColor Green
Write-Host "✅ Git: $gitVersion" -ForegroundColor Green

# Check if .env.local files exist
Write-Host "`n📝 Checking configuration files...`n" -ForegroundColor Yellow

$backendEnv = Test-Path "C:\Medicology\Question-Bank\artifacts\api-server\.env.local"
$frontendEnv = Test-Path "C:\Medicology\Question-Bank\artifacts\medicology\.env.local"

if ($backendEnv) {
    Write-Host "✅ Backend .env.local exists" -ForegroundColor Green
} else {
    Write-Host "❌ Backend .env.local NOT found" -ForegroundColor Red
}

if ($frontendEnv) {
    Write-Host "✅ Frontend .env.local exists" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend .env.local NOT found" -ForegroundColor Red
}

# Check if node_modules exist
Write-Host "`n📦 Checking dependencies...`n" -ForegroundColor Yellow

$backendModules = Test-Path "C:\Medicology\Question-Bank\artifacts\api-server\node_modules"
$frontendModules = Test-Path "C:\Medicology\Question-Bank\artifacts\medicology\node_modules"

if ($backendModules) {
    Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Backend dependencies missing - will install" -ForegroundColor Yellow
}

if ($frontendModules) {
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Frontend dependencies missing - will install" -ForegroundColor Yellow
}

# Menu
Write-Host "`n`n📌 WHAT DO YOU WANT TO DO?`n" -ForegroundColor Cyan
Write-Host "1. Start FRONTEND only (http://localhost:5173)" -ForegroundColor White
Write-Host "2. Start BACKEND only (http://localhost:5000)" -ForegroundColor White
Write-Host "3. Setup DATABASE (Neon cloud - free)" -ForegroundColor White
Write-Host "4. Start BOTH servers" -ForegroundColor White
Write-Host "5. Exit" -ForegroundColor White
Write-Host "`n"

$choice = Read-Host "Enter your choice (1-5)"

switch ($choice) {
    "1" {
        Write-Host "`n🎨 Starting Frontend...`n" -ForegroundColor Green
        Write-Host "Opening: http://localhost:5173`n" -ForegroundColor Cyan
        cd "C:\Medicology\Question-Bank\artifacts\medicology"
        pnpm run dev
    }
    "2" {
        Write-Host "`n🔧 Starting Backend...`n" -ForegroundColor Green
        Write-Host "Opening: http://localhost:5000`n" -ForegroundColor Cyan
        cd "C:\Medicology\Question-Bank\artifacts\api-server"
        pnpm start
    }
    "3" {
        Write-Host "`n📊 DATABASE SETUP INSTRUCTIONS`n" -ForegroundColor Cyan
        Write-Host @"
Follow these steps:

1. Go to: https://neon.tech
2. Sign up with GitHub (free)
3. Create project: 'medicology'
4. Copy your connection string
5. Paste into: artifacts/api-server/.env.local
   Replace: DATABASE_URL=postgresql://...

Then run:
  cd C:\Medicology\Question-Bank
  npx drizzle-kit migrate

See QUICK_CLOUD_DB_SETUP.md for detailed steps!
"@
        Write-Host "`nOpening Neon website in browser...`n" -ForegroundColor Green
        Start-Process "https://neon.tech"
    }
    "4" {
        Write-Host "`n🚀 Starting BOTH Frontend and Backend...`n" -ForegroundColor Green
        Write-Host "Frontend will open in browser (http://localhost:5173)" -ForegroundColor Cyan
        Write-Host "Backend will start on http://localhost:5000`n" -ForegroundColor Cyan
        
        # Start backend in background
        Write-Host "Starting backend..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList {
            cd "C:\Medicology\Question-Bank\artifacts\api-server"
            pnpm start
        }
        
        # Wait a moment
        Start-Sleep -Seconds 3
        
        # Start frontend
        Write-Host "Starting frontend..." -ForegroundColor Yellow
        cd "C:\Medicology\Question-Bank\artifacts\medicology"
        pnpm run dev
    }
    "5" {
        Write-Host "`nGoodbye! 👋`n" -ForegroundColor Green
        exit
    }
    default {
        Write-Host "`n❌ Invalid choice. Please run again and choose 1-5.`n" -ForegroundColor Red
    }
}
