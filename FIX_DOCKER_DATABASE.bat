@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title GNM - Repair Local Database Startup

echo ====================================================
echo  GNM LOCAL DATABASE REPAIR
echo ====================================================
echo.

where docker >nul 2>nul || goto :missing_docker
docker info >nul 2>nul || goto :docker_not_running

docker container inspect gambia_number_migrator_postgres >nul 2>nul
if errorlevel 1 (
  echo No existing named container was found. Creating it now...
  docker compose up -d postgres
  if errorlevel 1 goto :failed
) else (
  echo Existing database container found. Starting it without deleting data...
  docker start gambia_number_migrator_postgres >nul
  if errorlevel 1 goto :failed
)

echo Waiting for PostgreSQL...
for /l %%i in (1,1,30) do (
  docker exec gambia_number_migrator_postgres pg_isready -U gnm_user -d gambia_number_migrator >nul 2>nul
  if not errorlevel 1 goto :ready
  timeout /t 2 /nobreak >nul
)

echo ERROR: PostgreSQL did not become ready.
echo Open Docker Desktop and inspect the container logs.
pause
exit /b 1

:ready
echo PostgreSQL is ready and the existing database data was preserved.
echo You can now run START_ALL.bat.
pause
exit /b 0

:missing_docker
echo ERROR: Docker is not installed or is not in PATH.
pause
exit /b 1

:docker_not_running
echo ERROR: Docker Desktop is not running. Open it and wait for the engine to start.
pause
exit /b 1

:failed
echo ERROR: The database container could not be started.
echo Run this command in PowerShell and send the result for diagnosis:
echo docker ps -a --filter "name=gambia_number_migrator_postgres"
pause
exit /b 1
