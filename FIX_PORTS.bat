@echo off
setlocal EnableExtensions
title GNM Fix Busy Ports

echo This will kill processes using common project ports: 8089, 5173, 8081, 8082, 5434.
echo.
for %%P in (8089 5173 8081 8082 5434) do (
  echo Checking port %%P...
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P') do (
    echo Killing PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>nul
  )
)
echo.
echo Done. Try START_ALL.bat again.
pause
