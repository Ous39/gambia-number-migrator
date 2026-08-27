$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$envPath = Join-Path $projectRoot '.env'
$examplePath = Join-Path $projectRoot '.env.example'

if (-not (Test-Path $envPath)) {
  Copy-Item $examplePath $envPath
  Write-Host 'Created .env from .env.example.'
}

$content = [IO.File]::ReadAllText($envPath)

function Set-EnvValue([string]$Name, [string]$Value) {
  $script:content = $script:content -replace "(?m)^$([regex]::Escape($Name))=.*$", "$Name=$Value"
  if ($script:content -notmatch "(?m)^$([regex]::Escape($Name))=") {
    $script:content = $script:content.TrimEnd() + [Environment]::NewLine + "$Name=$Value" + [Environment]::NewLine
  }
}

function New-RandomHex([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

if ($content -notmatch '(?m)^POSTGRES_PASSWORD=.+$') {
  Set-EnvValue 'POSTGRES_PASSWORD' 'gnm_password'
}

Set-EnvValue 'DATABASE_URL' 'postgres://gnm_user:gnm_password@localhost:5434/gambia_number_migrator'

$jwtMatch = [regex]::Match($content, '(?m)^JWT_SECRET=(.*)$')
if (-not $jwtMatch.Success -or $jwtMatch.Groups[1].Value -match 'replace-with|change-me|dev-only' -or $jwtMatch.Groups[1].Value.Length -lt 32) {
  Set-EnvValue 'JWT_SECRET' (New-RandomHex 32)
}

$adminMatch = [regex]::Match($content, '(?m)^ADMIN_INITIAL_PASSWORD=(.*)$')
if (-not $adminMatch.Success -or $adminMatch.Groups[1].Value -match 'replace-with|change-me|password' -or $adminMatch.Groups[1].Value.Length -lt 12) {
  $adminPassword = 'GNM-' + (New-RandomHex 12) + '!a9'
  Set-EnvValue 'ADMIN_INITIAL_PASSWORD' $adminPassword
  Write-Host ''
  Write-Host 'IMPORTANT - SAVE THIS LOCAL ADMIN LOGIN:' -ForegroundColor Yellow
  Write-Host 'Username: admin'
  Write-Host "Password: $adminPassword" -ForegroundColor Green
  Write-Host ''
}

[IO.File]::WriteAllText($envPath, $content, (New-Object Text.UTF8Encoding($false)))
Write-Host 'Local environment configuration is ready.'
