@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM API - Port 8089

where pnpm >nul 2>nul || goto :missing_pnpm
if not exist ".env" goto :setup_required
if not exist "node_modules" goto :setup_required

echo ====================================================
echo  Starting Gambia Number Migrator API
echo ====================================================
echo.

call :prepare_database

echo.
echo API URL: http://localhost:8089/api/health
echo.
call pnpm --filter @gnm/api dev
pause
exit /b 0

:prepare_database
echo Checking PostgreSQL database...
where docker >nul 2>nul
if errorlevel 1 (
  echo WARNING: Docker is not installed or not in PATH.
  echo API public routes can use fallback test config, but Admin login needs PostgreSQL.
  exit /b 0
)

docker info >nul 2>nul
if errorlevel 1 (
  echo WARNING: Docker Desktop is installed but the Docker engine is not running.
  echo Open Docker Desktop and wait until it is running.
  echo Skipping database start, migrations and seed.
  exit /b 0
)

echo Starting PostgreSQL database with Docker Compose...
docker compose up -d
if errorlevel 1 (
  echo WARNING: Docker could not start PostgreSQL. Skipping migrations and seed.
  exit /b 0
)

call :wait_db
if errorlevel 1 (
  echo WARNING: PostgreSQL was not ready after waiting. Skipping migrations and seed.
  exit /b 0
)

echo Running safe database migrations...
call pnpm --filter @gnm/api db:migrate
if errorlevel 1 echo WARNING: Migration failed. API will still start.

echo Running safe database seed...
call pnpm --filter @gnm/api db:seed
if errorlevel 1 echo WARNING: Seed failed. Admin login may not be available.
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

:setup_required
echo ERROR: First-time setup is not complete.
echo Double-click RUN_THIS_FIRST.bat first.
pause
exit /b 1
