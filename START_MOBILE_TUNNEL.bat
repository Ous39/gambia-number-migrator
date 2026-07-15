@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM Mobile - Expo Tunnel

where pnpm >nul 2>nul || goto :missing_pnpm

call "%~dp0scripts\windows\DETECT_LAN_IP.bat"
set "EXPO_NO_DEPENDENCY_VALIDATION=1"
set "EXPO_PUBLIC_API_BASE_URL=http://%PC_IP%:8089/api"
set "EXPO_NO_TELEMETRY=1"

echo ====================================================
echo  Starting Mobile App with Expo Tunnel
echo ====================================================
echo.
echo Use this only if normal START_MOBILE.bat QR does not open on your phone.
echo API for phone: %EXPO_PUBLIC_API_BASE_URL%
echo.
call pnpm --filter @gnm/mobile start -- --host tunnel --port 8082 --clear
pause
exit /b 0

:missing_pnpm
echo ERROR: pnpm is not installed or not in PATH.
echo Run: npm install -g pnpm
pause
exit /b 1
