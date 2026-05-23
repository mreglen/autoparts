# Manual checks for Yandex Webmaster API.
# Recommended: use scripts/yandex-webmaster-check.py on Windows (more reliable JSON handling).

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [ValidateSet("check", "sync")]
    [string]$Command = "check",

    [string]$HostId = "https:svoygarage.ru:443",
    [string]$FeedUrl = "https://svoygarage.ru/api/feeds/yandex/used.yml",
    [string]$FeedType = "GOODS",
    [string]$RegionIds = "225",
    [int]$PollSeconds = 180,
    [int]$PollInterval = 5
)

$ErrorActionPreference = "Stop"
$ApiBase = "https://api.webmaster.yandex.net/v4"

function Invoke-YandexJson {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body = $null
    )

    $headers = @{
        Authorization = "OAuth $Token"
        Accept        = "application/json"
    }

    $params = @{
        Method  = $Method
        Uri     = "$ApiBase$Path"
        Headers = $headers
    }

    if ($null -ne $Body) {
        $json = ($Body | ConvertTo-Json -Depth 10 -Compress)
        $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($json)
        $params["ContentType"] = "application/json;charset=UTF-8"
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $details = $_.ErrorDetails.Message
        if (-not $details) { $details = $_.Exception.Message }
        throw "Yandex API error on $Method $Path`: $details"
    }
}

function Get-UserId {
    $user = Invoke-YandexJson -Method GET -Path "/user"
    return [int64]$user.user_id
}

function Invoke-Check {
    $userId = Get-UserId

    Write-Host "=== GET /user ==="
    $user | ConvertTo-Json -Depth 10

    Write-Host "`n=== GET /user/{user-id}/hosts ==="
    $hosts = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts"
    $hosts | ConvertTo-Json -Depth 10

    Write-Host "`n=== GET /verification ($HostId) ==="
    $verification = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts/$HostId/verification"
    $verification | ConvertTo-Json -Depth 10

    Write-Host "`n=== GET /feeds/list ($HostId) ==="
    $feeds = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts/$HostId/feeds/list"
    $feeds | ConvertTo-Json -Depth 10

    Write-Host "`nSummary:"
    Write-Host "  user_id: $userId"
    Write-Host "  host_id: $HostId"
    Write-Host "  verified: $($verification.verification_state -eq 'VERIFIED')"
    Write-Host "  feeds_count: $($feeds.feeds.Count)"
}

function Invoke-Sync {
    $userId = Get-UserId
    $verification = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts/$HostId/verification"
    if ($verification.verification_state -ne "VERIFIED") {
        throw "Host is not verified. Confirm rights in Webmaster first."
    }

    $regionIdList = @()
    foreach ($part in $RegionIds.Split(",")) {
        $trimmed = $part.Trim()
        if ($trimmed) { $regionIdList += [int]$trimmed }
    }
    if ($regionIdList.Count -eq 0) { $regionIdList = @(225) }

    Write-Host "=== POST /feeds/add/start ==="
    $start = Invoke-YandexJson -Method POST -Path "/user/$userId/hosts/$HostId/feeds/add/start" -Body @{
        feed = @{
            url       = $FeedUrl
            type      = $FeedType
            regionIds = $regionIdList
        }
    }
    $start | ConvertTo-Json -Depth 10

    $requestId = [string]$start.requestId
    if (-not $requestId) {
        throw "Yandex did not return requestId"
    }

    Write-Host "`n=== GET /feeds/add/info (requestId=$requestId) ==="
    $deadline = (Get-Date).AddSeconds($PollSeconds)
    $processStatus = "IN_PROGRESS"
    while ((Get-Date) -lt $deadline) {
        $info = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts/$HostId/feeds/add/info" -Body @{
            requestId = $requestId
        }
        $processStatus = [string]$info.processStatus
        $info | ConvertTo-Json -Depth 10
        if ($processStatus -in @("OK", "FAILED", "ERROR")) { break }
        Start-Sleep -Seconds $PollInterval
    }

    Write-Host "`n=== GET /feeds/list ==="
    $feeds = Invoke-YandexJson -Method GET -Path "/user/$userId/hosts/$HostId/feeds/list"
    $feeds | ConvertTo-Json -Depth 10

    if ($processStatus -ne "OK") {
        throw "Sync finished with status: $processStatus"
    }

    Write-Host "`nSync finished successfully (processStatus=OK)"
}

switch ($Command) {
    "check" { Invoke-Check }
    "sync"  { Invoke-Sync }
}
