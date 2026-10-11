# Скрипт для автоматической настройки локальной нейросети для проекта "Свой Гараж"
# Запускать в PowerShell

$ErrorActionPreference = "Stop"

Write-Host "=== Настройка локальной нейросети Qwen 2.5 Coder для проекта Свой Гараж ===" -ForegroundColor Cyan
Write-Host ""

# Проверка Ollama
Write-Host "[1/5] Проверка Ollama..." -ForegroundColor Yellow
try {
    $ollamaStatus = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -ErrorAction Stop
    Write-Host "✓ Ollama запущен" -ForegroundColor Green
}
catch {
    Write-Host "✗ Ollama не запущен" -ForegroundColor Red
    Write-Host "  Установите Ollama с https://ollama.com/download/windows" -ForegroundColor Yellow
    exit 1
}

# Проверка моделей
Write-Host "[2/5] Проверка моделей..." -ForegroundColor Yellow
$modelsOutput = ollama list
$has7b = $modelsOutput -match "qwen2.5-coder:7b"
$has14b = $modelsOutput -match "qwen2.5-coder:14b"

if ($has14b) {
    Write-Host "✓ Модель qwen2.5-coder:14b установлена" -ForegroundColor Green
    $chatModel = "qwen2.5-coder:14b"
}
elseif ($has7b) {
    Write-Host "✓ Модель qwen2.5-coder:7b установлена" -ForegroundColor Green
    $chatModel = "qwen2.5-coder:7b"
}
else {
    Write-Host "✗ Модели не установлены. Устанавливаем qwen2.5-coder:7b..." -ForegroundColor Yellow
    ollama pull qwen2.5-coder:7b
    Write-Host "✓ Модель qwen2.5-coder:7b установлена" -ForegroundColor Green
    $chatModel = "qwen2.5-coder:7b"
}

# Проверка Continue
Write-Host "[3/5] Проверка расширения Continue..." -ForegroundColor Yellow
$continueDir = "$env:APPDATA\Continue"
if (Test-Path $continueDir) {
    Write-Host "✓ Continue установлен" -ForegroundColor Green
}
else {
    Write-Host "✗ Continue не установлен" -ForegroundColor Red
    Write-Host "  Установите расширение 'Continue' из VS Code Extensions marketplace" -ForegroundColor Yellow
    exit 1
}

# Создание конфигурации
Write-Host "[4/5] Создание конфигурации Continue..." -ForegroundColor Yellow
$configPath = "$continueDir\config.json"

$configJson = @"
{
  "models": [
    {
      "title": "Qwen2.5-Coder (Chat)",
      "provider": "ollama",
      "model": "$chatModel",
      "apiKey": "ollama",
      "contextLength": 32768,
      "temperature": 0.2,
      "systemPrompt": "You are an expert developer working on the SvoyGarage project. ALWAYS adhere to the architectural rules, code style, and constraints defined in AGENTS.md located in the project root. Project: FastAPI + SQLAlchemy 2.0 + Pydantic v2 + React 19 + Redux Toolkit. Rules: no comments unless asked, compact code, follow existing patterns, filter by organization_id, use model_validate() not parse_obj(), use .filter() not .filter_by()."
    },
    {
      "title": "Qwen2.5-Coder 7B (Autocomplete)",
      "provider": "ollama",
      "model": "qwen2.5-coder:7b",
      "apiKey": "ollama",
      "contextLength": 8192,
      "temperature": 0.1
    }
  ],
  "tabAutocompleteModel": {
    "title": "Qwen2.5-Coder 7B (Autocomplete)",
    "provider": "ollama",
    "model": "qwen2.5-coder:7b",
    "apiKey": "ollama"
  },
  "contextProviders": {
    "open": true,
    "directory": true,
    "githubIssues": false,
    "googleSearch": false
  },
  "allowAnonymousTelemetry": false
}
"@

$configJson | Out-File -FilePath $configPath -Encoding UTF8
Write-Host "✓ Конфигурация создана: $configPath" -ForegroundColor Green

# Проверка AGENTS.md
Write-Host "[5/5] Проверка AGENTS.md..." -ForegroundColor Yellow
$agentsPath = "C:\Users\khram\OneDrive\Рабочий стол\autoparts\AGENTS.md"
if (Test-Path $agentsPath) {
    Write-Host "✓ AGENTS.md найден" -ForegroundColor Green
}
else {
    Write-Host "⚠ AGENTS.md не найден по пути: $agentsPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Настройка завершена! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Дальнейшие шаги:" -ForegroundColor Cyan
Write-Host "1. Перезапустите VS Code" -ForegroundColor White
Write-Host "2. Откройте панель Continue (иконка слева)" -ForegroundColor White
Write-Host "3. Протестируйте: попросите написать простую функцию на Python" -ForegroundColor White
Write-Host "4. Для работы с планом:" -ForegroundColor White
Write-Host "   Прочитай файл C:\Users\khram\.devin\plans\plan-56e11ddf1cb87079.md" -ForegroundColor Gray
Write-Host "   Выполни ЭТАП 1 из плана" -ForegroundColor Gray
Write-Host ""
Write-Host "Документация: docs/LOCAL_AI_SETUP.md" -ForegroundColor Cyan
