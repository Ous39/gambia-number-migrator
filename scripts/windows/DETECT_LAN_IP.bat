@echo off
set "PC_IP="
for /f "usebackq tokens=*" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip=(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Docker|WSL|VirtualBox|VMware' } | Sort-Object InterfaceMetric | Select-Object -First 1 -ExpandProperty IPAddress); if ($ip) { $ip }"`) do set "PC_IP=%%I"
if "%PC_IP%"=="" (
  for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /C:"IPv4"') do (
    for /f "tokens=*" %%B in ("%%A") do (
      if not defined PC_IP set "PC_IP=%%B"
    )
  )
)
if "%PC_IP%"=="" set "PC_IP=localhost"
exit /b 0
