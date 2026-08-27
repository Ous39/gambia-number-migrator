@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM Website - Port 5174

where pnpm >nul 2>nul || goto :missing_pnpm
if not exist ".env" goto :setup_required
if not exist "node_modules" goto :setup_required

echo ====================================================
echo  Starting Gambia Number Migrator Public Website
echo ====================================================
echo.
echo Website URL: http://localhost:5174
echo.
call pnpm --filter @gnm/web dev
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
