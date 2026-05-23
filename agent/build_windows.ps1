$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$AppSpecPath = Join-Path $ScriptDir "AutoParts_PrinterAgent.spec"
$SetupSpecPath = Join-Path $ScriptDir "AutoParts_PrinterAgent_Setup.spec"
$AppExe = Join-Path $ScriptDir "dist\AutoParts_PrinterAgent.exe"
$SetupExe = Join-Path $ScriptDir "dist\AutoParts_PrinterAgent_Setup.exe"
$DownloadExe = Join-Path $RepoRoot "frontend\my-autoparts\public\downloads\AutoParts_PrinterAgent_Setup.exe"

$PyInstallerCheck = python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    python -m pip install pyinstaller
}

Push-Location $ScriptDir
try {
    Write-Host "Building AutoParts_PrinterAgent.exe ..."
    python -m PyInstaller --clean --noconfirm $AppSpecPath
    if (-not (Test-Path $AppExe)) {
        throw "Build failed: $AppExe was not created."
    }

    Write-Host "Building AutoParts_PrinterAgent_Setup.exe (installer) ..."
    python -m PyInstaller --clean --noconfirm $SetupSpecPath
}
finally {
    Pop-Location
}

if (-not (Test-Path $SetupExe)) {
    throw "Build failed: $SetupExe was not created."
}

$DownloadDir = Split-Path -Parent $DownloadExe
if (-not (Test-Path $DownloadDir)) {
    New-Item -ItemType Directory -Path $DownloadDir | Out-Null
}

Copy-Item -Path $SetupExe -Destination $DownloadExe -Force
Write-Host "Built app: $AppExe"
Write-Host "Built installer and copied to: $DownloadExe"
