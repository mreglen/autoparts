$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$SpecPath = Join-Path $ScriptDir "AutoParts_PrinterAgent.spec"
$DistExe = Join-Path $ScriptDir "dist\AutoParts_PrinterAgent_Setup.exe"
$DownloadExe = Join-Path $RepoRoot "frontend\my-autoparts\public\downloads\AutoParts_PrinterAgent_Setup.exe"

$PyInstallerCheck = python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    python -m pip install pyinstaller
}

Push-Location $ScriptDir
try {
    python -m PyInstaller --clean --noconfirm $SpecPath
}
finally {
    Pop-Location
}

if (-not (Test-Path $DistExe)) {
    throw "Build failed: $DistExe was not created."
}

$DownloadDir = Split-Path -Parent $DownloadExe
if (-not (Test-Path $DownloadDir)) {
    New-Item -ItemType Directory -Path $DownloadDir | Out-Null
}

Copy-Item -Path $DistExe -Destination $DownloadExe -Force
Write-Host "Built and copied $DownloadExe"
