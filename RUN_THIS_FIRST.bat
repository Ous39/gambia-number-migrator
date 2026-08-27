@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Gambia Number Migrator - First Setup

echo ====================================================
echo  GAMBIA NUMBER MIGRATOR - FIRST SETUP
echo ====================================================
echo.

echo Checking and repairing local environment configuration...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\ENSURE_LOCAL_ENV.ps1"
if errorlevel 1 goto :error
echo.

echo Checking Node.js...
where node >nul 2>nul || goto :missing_node
node --version

echo.
echo Checking pnpm...
where pnpm >nul 2>nul || goto :missing_pnpm
call pnpm --version
if errorlevel 1 goto :error

echo.
echo Checking the exact locked dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 (
  echo.
  echo Dependency installation was interrupted. Waiting for Windows to release package files...
  timeout /t 4 /nobreak >nul
  call pnpm install --frozen-lockfile
  if errorlevel 1 goto :dependency_locked
)

echo.
echo Building shared package...
call pnpm --filter @gnm/shared build
if errorlevel 1 goto :error

echo.
echo Checking Docker Desktop...
where docker >nul 2>nul || goto :missing_docker
docker info >nul 2>nul
if errorlevel 1 goto :docker_not_running

docker container inspect gambia_number_migrator_postgres >nul 2>nul
if not errorlevel 1 (
  echo Existing PostgreSQL container found. Reusing it without deleting data...
  docker start gambia_number_migrator_postgres >nul
  if errorlevel 1 goto :docker_start_failed
) else (
  echo Creating PostgreSQL database with Docker Compose...
  docker compose up -d postgres
  if errorlevel 1 goto :docker_start_failed
)

call :wait_db
if errorlevel 1 goto :db_not_ready

echo Running database migrations...
call pnpm --filter @gnm/api db:migrate
if errorlevel 1 goto :error

echo.
echo Running seed data...
call pnpm --filter @gnm/api db:seed
if errorlevel 1 goto :error

echo.
echo ====================================================
echo  SETUP COMPLETE
echo ====================================================
echo.
echo Next steps:
echo  1. Double-click START_ALL.bat to run API, Admin and Mobile.
echo  2. Admin: http://localhost:5173
echo  3. Login with username admin and ADMIN_INITIAL_PASSWORD from .env
echo.
echo You can also run only one service:
echo  - START_API.bat
echo  - START_ADMIN.bat
echo  - START_MOBILE.bat
echo  - STOP_ALL.bat when you finish testing
echo.
pause
exit /b 0

:wait_db
echo Waiting for PostgreSQL on port 5434...
for /l %%i in (1,1,30) do (
  docker exec gambia_number_migrator_postgres pg_isready -U gnm_user -d gambia_number_migrator >nul 2>nul
  if not errorlevel 1 (
    echo PostgreSQL is ready.
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)
exit /b 1

:missing_node
echo ERROR: Node.js is not installed or not in PATH.
echo Install Node.js LTS, then run this file again.
pause
exit /b 1

:missing_pnpm
echo ERROR: pnpm is not installed.
echo Run this first:
echo npm install -g pnpm
pause
exit /b 1

:missing_docker
echo ERROR: Docker is not installed or not in PATH.
echo Install Docker Desktop, open it, then run this file again.
pause
exit /b 1

:docker_not_running
echo ERROR: Docker Desktop is installed but not running.
echo Open Docker Desktop and wait until it says Docker is running, then run this file again.
pause
exit /b 1

:docker_start_failed
echo ERROR: Docker could not start the PostgreSQL container.
echo Check Docker Desktop, then run this file again.
pause
exit /b 1

:db_not_ready
echo ERROR: PostgreSQL did not become ready on port 5434.
echo Keep Docker Desktop open and run this file again.
pause
exit /b 1

:error
echo.
echo SETUP FAILED. Read the error above.
echo You can screenshot the error and send it to OceanBrown support.
pause
exit /b 1

:dependency_locked
echo.
echo SETUP STOPPED: Windows is still locking a generated dependency folder.
echo Close VS Code and all old GNM/Expo windows, then run CLEAN_INSTALL_WINDOWS.bat once.
echo After it says CLEAN INSTALL COMPLETE, run RUN_THIS_FIRST.bat again.
pause
exit /b 1
