@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM Admin - Port 5173

where pnpm >nul 2>nul || goto :missing_pnpm
if not exist ".env" goto :setup_required
if not exist "node_modules" goto :setup_required

echo ====================================================
echo  Starting Gambia Number Migrator Admin Panel
echo ====================================================
echo.
echo Admin URL: http://localhost:5173
echo Login with admin and your ADMIN_INITIAL_PASSWORD from .env
echo.
call pnpm --filter @gnm/admin dev
pause
exit /b 0

:missing_pnpm
echo ERROR: pnpm is not installed or not in PATH.
echo Run: npm install -g pnpm
pause
exit /b 1

:setup_required
echo ERROR: First-time setup is not complete.
echo Double-click RUN_THIS_FIRST.bat first.
pause
exit /b 1
