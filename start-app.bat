@echo off
REM Quick Start Script for Medicology App
REM This script installs dependencies and starts both servers

echo.
echo ════════════════════════════════════════════════════════════════
echo           Medicology App - Quick Start Setup
echo ════════════════════════════════════════════════════════════════
echo.

REM Check if pnpm is installed
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm is not installed. Installing now...
    npm install -g pnpm
)

echo ✓ Installing dependencies...
pnpm install

echo.
echo ════════════════════════════════════════════════════════════════
echo           Starting Servers (Opening two windows)
echo ════════════════════════════════════════════════════════════════
echo.

REM Start API Server in a new window
echo Starting API Server...
start cmd /k "cd artifacts\api-server && pnpm dev"

REM Wait a moment for API to start
timeout /t 3 /nobreak

REM Start Frontend in a new window
echo Starting Frontend...
start cmd /k "cd artifacts\medicology && pnpm dev"

echo.
echo ✓ Both servers are starting in separate windows
echo ✓ The app will open on http://localhost:5173
echo ✓ API is running on http://localhost:3000
echo.
pause
