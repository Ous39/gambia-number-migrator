@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM - Clean Dependency Installation

echo ====================================================
echo  GNM CLEAN DEPENDENCY INSTALLATION
echo ====================================================
echo.
echo This removes only generated dependency/cache folders.
echo Source code, .env and PostgreSQL data are preserved.
echo.

where node >nul 2>nul || goto :missing_node
where pnpm >nul 2>nul || goto :missing_pnpm

echo Closing old Node and Expo processes for this repair...
taskkill /FI "WINDOWTITLE eq GNM API - 8089*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq GNM Admin - 5173*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq GNM Mobile - Expo 8082*" /T /F >nul 2>nul

echo Removing stale generated dependencies and Expo cache...
if exist "node_modules" rmdir /s /q "node_modules"
if exist "apps\mobile\node_modules" rmdir /s /q "apps\mobile\node_modules"
if exist "apps\mobile\.expo" rmdir /s /q "apps\mobile\.expo"
if exist "apps\api\node_modules" rmdir /s /q "apps\api\node_modules"
if exist "apps\admin\node_modules" rmdir /s /q "apps\admin\node_modules"
if exist "packages\shared\node_modules" rmdir /s /q "packages\shared\node_modules"

echo Installing only dependencies declared by this release lockfile...
call pnpm store prune
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo Windows kept a generated file locked. Waiting and retrying once...
  timeout /t 5 /nobreak >nul
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :locked
)

echo Verifying required local executables...
call pnpm --filter @gnm/shared exec tsc --version
if errorlevel 1 goto :failed
call pnpm --filter @gnm/mobile exec expo --version
if errorlevel 1 goto :failed

echo Building the shared migration engine...
call pnpm --filter @gnm/shared build
if errorlevel 1 goto :failed

echo.
echo CLEAN INSTALL COMPLETE.
echo Now run START_ALL.bat. Use START_MOBILE_TUNNEL.bat only if LAN cannot work.
pause
exit /b 0

:missing_node
echo ERROR: Node.js is not installed or not in PATH.
pause
exit /b 1

:missing_pnpm
echo ERROR: pnpm is not installed. Run: npm install -g pnpm
pause
exit /b 1

:failed
echo.
echo ERROR: Clean dependency installation failed. Read the first error above.
pause
exit /b 1

:locked
echo.
echo ERROR: Windows is locking a dependency folder.
echo Close VS Code, File Explorer windows inside this project, and all Node/Expo terminals.
echo Restart Windows, then run this CLEAN_INSTALL_WINDOWS.bat before opening the project in VS Code.
pause
exit /b 1
