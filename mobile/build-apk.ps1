# Сборка release APK «Свой Гараж · Автосервис».
# Копирует исходники mobile/app в ASCII-каталог C:\s (кириллица/пробелы в пути
# ломают prebuild/Gradle), при необходимости патчит подпись релиза и запускает
# gradlew assembleRelease. Готовый APK копируется в mobile/releases/.
#
# Использование:  powershell -File mobile\build-apk.ps1 [-SkipSync]
param(
    [switch]$SkipSync,
    [string]$BuildDir = "C:\s"
)

$ErrorActionPreference = "Stop"
$mobileDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $mobileDir "app"
$keysDir = Join-Path $mobileDir "keys"
$releasesDir = Join-Path $mobileDir "releases"

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
    Set-Content $gradleFile $gradle -NoNewline
    $gradle = Get-Content $gradleFile -Raw
    if ($gradle -notmatch "signingConfigs\.release[\s\S]*?signingConfig signingConfigs\.release") {
        throw "Не удалось пропатчить build.gradle: добавьте signingConfigs.release вручную"
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
