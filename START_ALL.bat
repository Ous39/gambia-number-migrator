@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Gambia Number Migrator - Start All

where node >nul 2>nul || goto :missing_node
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

echo ====================================================
echo  STARTING GAMBIA NUMBER MIGRATOR
echo ====================================================
echo.
echo PC/LAN IP: %PC_IP%
echo API:        http://localhost:8089/api/health
echo Admin:      http://localhost:5173
echo Mobile API: http://%PC_IP%:8089/api
echo.

call :prepare_database

echo.
echo Opening API, Admin and Mobile in separate windows...
start "GNM API - 8089" /D "%~dp0" cmd /k "pnpm --filter @gnm/api dev"
start "GNM Admin - 5173" /D "%~dp0" cmd /k "pnpm --filter @gnm/admin dev"
start "GNM Mobile - Expo 8082" /D "%~dp0" cmd /k "set EXPO_NO_TELEMETRY=1&& set EXPO_PUBLIC_API_BASE_URL=http://%PC_IP%:8089/api&& pnpm --filter @gnm/mobile exec expo start --host lan --port 8082 --clear"

timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo Started. Wait for each window to finish loading.
echo Admin login: admin / ADMIN_INITIAL_PASSWORD from .env
echo.
echo NOTE: If Admin login fails, open Docker Desktop and run START_ALL.bat again.
echo When finished, double-click STOP_ALL.bat.
echo.
pause
exit /b 0

:prepare_database
echo Checking PostgreSQL database...
where docker >nul 2>nul
if errorlevel 1 (
  echo WARNING: Docker is not installed or not in PATH.
  echo Mobile public routes can use fallback test config, but Admin login needs PostgreSQL.
  echo Install/open Docker Desktop or run PostgreSQL manually on port 5434.
  exit /b 0
)

docker info >nul 2>nul
if errorlevel 1 (
  echo WARNING: Docker Desktop is installed but the Docker engine is not running.
  echo Open Docker Desktop and wait until it says "Docker Desktop is running".
  echo Skipping database start, migrations and seed for now.
  echo Mobile public routes can still use fallback test config.
  exit /b 0
)

echo Starting PostgreSQL database with Docker Compose...
docker compose up -d
if errorlevel 1 (
  echo WARNING: Docker could not start PostgreSQL.
  echo Skipping migrations and seed to avoid ECONNREFUSED errors.
  exit /b 0
)

call :wait_db
if errorlevel 1 (
  echo WARNING: PostgreSQL was not ready after waiting.
  echo Skipping migrations and seed to avoid ECONNREFUSED errors.
  echo Admin login needs the database to be ready.
  exit /b 0
)

echo Running safe database migrations...
call pnpm --filter @gnm/api db:migrate
if errorlevel 1 echo WARNING: Migration failed. API will still start, but Admin may need database repair.

echo Running safe database seed...
call pnpm --filter @gnm/api db:seed
if errorlevel 1 echo WARNING: Seed failed. Admin login may not be available until seed succeeds.
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

:missing_pnpm
echo ERROR: pnpm is not installed or not in PATH.
echo Run: npm install -g pnpm
pause
exit /b 1

:missing_node
echo ERROR: Node.js is not installed or not in PATH.
echo Install Node.js 20 LTS or newer, then try again.
pause
exit /b 1

:setup_required
echo ERROR: First-time setup is not complete.
echo Double-click RUN_THIS_FIRST.bat, wait for SETUP COMPLETE, then run START_ALL.bat.
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
