@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Gambia Number Migrator - Stop All

echo ====================================================
echo  STOPPING GAMBIA NUMBER MIGRATOR
echo ====================================================
echo.

echo Closing API window...
taskkill /FI "WINDOWTITLE eq GNM API - 8089*" /T /F >nul 2>nul

echo Closing Admin window...
taskkill /FI "WINDOWTITLE eq GNM Admin - 5173*" /T /F >nul 2>nul

echo Closing Expo Mobile window...
taskkill /FI "WINDOWTITLE eq GNM Mobile - Expo 8082*" /T /F >nul 2>nul

echo Stopping the local PostgreSQL container...
where docker >nul 2>nul
if not errorlevel 1 (
  docker info >nul 2>nul
  if not errorlevel 1 docker compose stop >nul 2>nul
)

echo.
echo All GNM local services have been stopped.
echo Your database data is preserved. START_ALL.bat will start it again.
echo.
pause
exit /b 0
