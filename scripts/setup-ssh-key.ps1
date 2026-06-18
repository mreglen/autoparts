# Настройка входа на сервер svoygarage по SSH-ключу (Windows + OpenSSH)
# Запуск: powershell -ExecutionPolicy Bypass -File .\scripts\setup-ssh-key.ps1

param(
    [string]$Server = "195.24.65.251",
    [string]$User = "root",
    [string]$KeyPath = "$env:USERPROFILE\.ssh\id_ed25519_svoygarage"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path "$KeyPath.pub")) {
    Write-Host "Ключ не найден. Создаю ed25519..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -C "svoygarage-$(hostname)" -f $KeyPath -N '""'
}

$pub = (Get-Content "$KeyPath.pub" -Raw).Trim()
Write-Host "Публичный ключ:" -ForegroundColor Cyan
Write-Host $pub
Write-Host ""

$password = Read-Host "Пароль root на сервере (ввод скрыт)" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
)

$remoteCmd = @"
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys
echo KEY_OK
"@

if (Get-Command plink -ErrorAction SilentlyContinue) {
    $result = plink -batch -ssh "${User}@${Server}" -pw $plain $remoteCmd
} else {
    throw "Нужен PuTTY plink или выполните команду вручную через консоль VPS (см. ниже)."
}

if ($result -notmatch "KEY_OK") {
    throw "Не удалось добавить ключ. Ответ сервера: $result"
}

Write-Host "Ключ добавлен на сервер." -ForegroundColor Green

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${User}@${Server}" "echo SSH_KEY_LOGIN_OK"

$sshDir = "$env:USERPROFILE\.ssh"
$configPath = Join-Path $sshDir "config"
$block = @"

Host svoygarage
  HostName $Server
  User $User
  IdentityFile $KeyPath
  IdentitiesOnly yes

"@

if (-not (Test-Path $configPath)) {
    Set-Content -Path $configPath -Value $block.TrimStart() -Encoding utf8
} elseif ((Get-Content $configPath -Raw) -notmatch "(?m)^Host svoygarage\s*$") {
    Add-Content -Path $configPath -Value $block -Encoding utf8
}

Write-Host ""
Write-Host "Готово. Подключение:" -ForegroundColor Green
Write-Host "  ssh svoygarage"
Write-Host ""
Write-Host "После проверки можно отключить пароль на сервере (опционально):" -ForegroundColor Yellow
Write-Host "  ssh svoygarage"
Write-Host "  sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
Write-Host "  sudo systemctl reload sshd"
