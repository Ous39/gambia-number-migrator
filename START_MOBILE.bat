@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM Mobile - Expo 8082

where pnpm >nul 2>nul || goto :missing_pnpm
if not exist ".env" goto :setup_required
if not exist "node_modules" goto :setup_required

if not exist "apps\mobile\node_modules\expo-splash-screen\package.json" (
  echo A required Expo package is missing. Repairing dependencies...
  call pnpm install
  if errorlevel 1 goto :install_failed
)

echo Building the shared migration rule engine...
call pnpm --filter @gnm/shared build
if errorlevel 1 goto :build_failed

call "%~dp0scripts\windows\DETECT_LAN_IP.bat"

set "EXPO_NO_DEPENDENCY_VALIDATION=1"
set "EXPO_PUBLIC_API_BASE_URL=http://%PC_IP%:8089/api"
set "EXPO_NO_TELEMETRY=1"

echo ====================================================
echo  Starting Gambia Number Migrator Mobile App
echo ====================================================
echo.
echo API for phone: %EXPO_PUBLIC_API_BASE_URL%
echo Expo port: 8082
echo.
echo Make sure your phone and PC are on the same Wi-Fi or hotspot.
echo Scan the QR code with Expo Go.
echo.
call pnpm --filter @gnm/mobile exec expo start --host lan --port 8082 --clear
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

:install_failed
echo ERROR: Dependency repair failed.
echo Close other GNM windows, check your internet connection, then run RUN_THIS_FIRST.bat again.
pause
exit /b 1

:build_failed
echo ERROR: The shared migration rule engine could not be built.
echo Run RUN_THIS_FIRST.bat again and check the error above.
pause
exit /b 1
