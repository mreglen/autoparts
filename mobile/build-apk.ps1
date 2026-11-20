# Сборка release APK «Свой Гараж · Автосервис».
# Копирует исходники mobile/app в ASCII-каталог C:\s (кириллица/пробелы в пути
# ломают prebuild/Gradle), при необходимости патчит подпись релиза и запускает
# gradlew assembleRelease. Готовый APK копируется в mobile/releases/.
#
# Использование:  powershell -File mobile\build-apk.ps1 [-SkipSync] [-Bump]
#   -Bump  увеличить patch-версию в app.json (1.0.1 -> 1.0.2) и versionCode
#          в android/app/build.gradle перед сборкой
param(
    [switch]$SkipSync,
    [switch]$Bump,
    [string]$BuildDir = "C:\s"
)

$ErrorActionPreference = "Stop"
$mobileDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $mobileDir "app"
$keysDir = Join-Path $mobileDir "keys"
$releasesDir = Join-Path $mobileDir "releases"
$appJsonPath = Join-Path $appDir "app.json"

if ($Bump) {
    $raw = Get-Content $appJsonPath -Raw
    if ($raw -notmatch '"version":\s*"(\d+)\.(\d+)\.(\d+)"') {
        throw "Не удалось прочитать версию из app.json"
    }
    $newVersion = "$($Matches[1]).$($Matches[2]).$([int]$Matches[3] + 1)"
    $raw = $raw -replace '"version":\s*"\d+\.\d+\.\d+"', ('"version": "' + $newVersion + '"')
    [System.IO.File]::WriteAllText($appJsonPath, $raw, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "==> Версия app.json: $newVersion"
}

if (-not $SkipSync) {
    Write-Host "==> Синхронизация исходников в $BuildDir"
    robocopy $appDir $BuildDir /MIR /XD node_modules android .expo dist web-build /XF *.log /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed: $LASTEXITCODE" }
}

# Подпись релиза: keystore и properties из mobile/keys -> android/app,
# патч build.gradle добавляет signingConfigs.release (идемпотентно).
$androidApp = Join-Path $BuildDir "android\app"
Copy-Item (Join-Path $keysDir "sg-release.jks") $androidApp -Force
Copy-Item (Join-Path $keysDir "keystore.properties") $androidApp -Force
$gradleFile = Join-Path $androidApp "build.gradle"
$gradle = Get-Content $gradleFile -Raw
if ($gradle -notmatch "signingConfigs\.release") {
    Write-Host "==> Патч build.gradle: release signingConfig"
    $gradle = $gradle.Replace(
        "signingConfigs {`r`n        debug {",
        "signingConfigs {`r`n        debug {"
    )
    $releaseConfig = @"
        release {
            def ksProps = new Properties()
            def ksFile = file('keystore.properties')
            if (ksFile.exists()) {
                ksProps.load(new FileInputStream(ksFile))
                storeFile file(ksProps['storeFile'])
                storePassword ksProps['storePassword']
                keyAlias ksProps['keyAlias']
                keyPassword ksProps['keyPassword']
            }
        }
"@
    $gradle = $gradle -replace "(\n    signingConfigs \{\r?\n        debug \{[^}]+\})", "`$1`n$releaseConfig"
    $gradle = $gradle -replace "release \{\s*// Caution! In production[^\r\n]*\r?\n\s*// see https://reactnative\.dev/docs/signed-apk-android\.\r?\n\s*signingConfig signingConfigs\.debug", "release {`n            signingConfig signingConfigs.release"
    [System.IO.File]::WriteAllText($gradleFile, $gradle, (New-Object System.Text.UTF8Encoding($false)))
    $gradle = Get-Content $gradleFile -Raw
    if ($gradle -notmatch "signingConfigs\.release[\s\S]*?signingConfig signingConfigs\.release") {
        throw "Не удалось пропатчить build.gradle: добавьте signingConfigs.release вручную"
    }
}

# versionCode/versionName в build.gradle должны соответствовать app.json
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$version = [string]$appJson.expo.version
$gradle = Get-Content $gradleFile -Raw
if ($gradle -match "versionCode\s+(\d+)") {
    $code = [int]$Matches[1]
    $needCode = $false
    $targetCode = $code
    # versionCode растёт только вместе с версией: если versionName отстаёт — bump
    if ($gradle -match 'versionName\s+"([^"]+)"' -and $Matches[1] -ne $version) {
        $targetCode = $code + 1
        $needCode = $true
    }
    $newGradle = $gradle -replace 'versionCode\s+\d+', "versionCode $targetCode"
    $newGradle = $newGradle -replace 'versionName\s+"[^"]+"', ('versionName "' + $version + '"')
    if ($newGradle -ne $gradle) {
        [System.IO.File]::WriteAllText($gradleFile, $newGradle, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "==> build.gradle: versionName $version, versionCode $targetCode"
    }
}

Push-Location (Join-Path $BuildDir "android")
try {
    Write-Host "==> gradlew assembleRelease"
    & ".\gradlew.bat" assembleRelease --console=plain
    if ($LASTEXITCODE -ne 0) { throw "gradle failed: $LASTEXITCODE" }
} finally {
    Pop-Location
}

$apk = Join-Path $BuildDir "android\app\build\outputs\apk\release\app-release.apk"
$appJson = Get-Content (Join-Path $appDir "app.json") -Raw | ConvertFrom-Json
$version = $appJson.expo.version
$target = Join-Path $releasesDir "sg-autoservice-$version.apk"
Copy-Item $apk $target -Force
Write-Host "==> Готово: $target"
