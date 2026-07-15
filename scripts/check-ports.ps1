Write-Host "Checking ports 8089, 5173, 5434"
Get-NetTCPConnection -LocalPort 8089,5173,5434 -ErrorAction SilentlyContinue | Format-Table -AutoSize
