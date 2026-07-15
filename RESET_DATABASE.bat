@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM Reset Database

where pnpm >nul 2>nul || goto :missing_pnpm

echo ====================================================
echo  RESET DATABASE
echo ====================================================
echo.
echo WARNING: This will clear and recreate the local database.
echo.
set /p CONFIRM=Type RESET to continue: 
if /I not "%CONFIRM%"=="RESET" (
  echo Cancelled.
  pause
  exit /b 0
)

where docker >nul 2>nul || goto :missing_docker
docker info >nul 2>nul
if errorlevel 1 goto :docker_not_running

docker compose up -d
if errorlevel 1 goto :docker_start_failed
call :wait_db
if errorlevel 1 goto :db_not_ready

call pnpm --filter @gnm/shared build
if errorlevel 1 goto :error
call pnpm --filter @gnm/api db:reset
if errorlevel 1 goto :error
call pnpm --filter @gnm/api db:migrate
if errorlevel 1 goto :error
call pnpm --filter @gnm/api db:seed
if errorlevel 1 goto :error

echo.
echo Database reset complete.
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

:missing_pnpm
echo ERROR: pnpm is not installed or not in PATH.
echo Run: npm install -g pnpm
pause
exit /b 1

:missing_docker
echo ERROR: Docker is not installed or not in PATH.
echo Install/open Docker Desktop, then try again.
pause
exit /b 1

:docker_not_running
echo ERROR: Docker Desktop is installed but not running.
echo Open Docker Desktop and wait until it is running, then try again.
pause
exit /b 1

:docker_start_failed
echo ERROR: Docker could not start PostgreSQL.
pause
exit /b 1

:db_not_ready
echo ERROR: PostgreSQL did not become ready on port 5434.
pause
exit /b 1

:error
echo Database reset failed. Check the error above.
pause
exit /b 1
