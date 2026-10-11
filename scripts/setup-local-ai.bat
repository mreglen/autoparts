@echo off
chcp 65001 >nul
echo === Настройка локальной нейросети Qwen 2.5 Coder для проекта Свой Гараж ===
echo.

echo [1/5] Проверка Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo ✗ Ollama не запущен
    echo   Установите Ollama с https://ollama.com/download/windows
    pause
    exit /b 1
)
echo ✓ Ollama запущен

echo [2/5] Проверка моделей...
ollama list | findstr "qwen2.5-coder:14b" >nul
if %errorlevel% equ 0 (
    echo ✓ Модель qwen2.5-coder:14b установлена
    set CHAT_MODEL=qwen2.5-coder:14b
) else (
    ollama list | findstr "qwen2.5-coder:7b" >nul
    if %errorlevel% equ 0 (
        echo ✓ Модель qwen2.5-coder:7b установлена
        set CHAT_MODEL=qwen2.5-coder:7b
    ) else (
        echo ✗ Модели не установлены. Устанавливаем qwen2.5-coder:7b...
        ollama pull qwen2.5-coder:7b
        echo ✓ Модель qwen2.5-coder:7b установлена
        set CHAT_MODEL=qwen2.5-coder:7b
    )
)

echo [3/5] Проверка расширения Continue...
if exist "%APPDATA%\Continue" (
    echo ✓ Continue установлен
) else (
    echo ✗ Continue не установлен
    echo   Установите расширение 'Continue' из VS Code Extensions marketplace
    pause
    exit /b 1
)

echo [4/5] Создание конфигурации Continue...
set CONFIG_PATH=%APPDATA%\Continue\config.json

(
echo {
echo   "models": [
echo     {
echo       "title": "Qwen2.5-Coder (Chat)",
echo       "provider": "ollama",
echo       "model": "%CHAT_MODEL%",
echo       "apiKey": "ollama",
echo       "contextLength": 32768,
echo       "temperature": 0.2,
echo       "systemPrompt": "You are an expert developer working on the SvoyGarage project. ALWAYS adhere to the architectural rules, code style, and constraints defined in AGENTS.md located in the project root. Project: FastAPI + SQLAlchemy 2.0 + Pydantic v2 + React 19 + Redux Toolkit. Rules: no comments unless asked, compact code, follow existing patterns, filter by organization_id, use model_validate() not parse_obj(), use .filter() not .filter_by()."
echo     },
echo     {
echo       "title": "Qwen2.5-Coder 7B (Autocomplete)",
echo       "provider": "ollama",
echo       "model": "qwen2.5-coder:7b",
echo       "apiKey": "ollama",
echo       "contextLength": 8192,
echo       "temperature": 0.1
echo     }
echo   ],
echo   "tabAutocompleteModel": {
echo     "title": "Qwen2.5-Coder 7B (Autocomplete)",
echo     "provider": "ollama",
echo     "model": "qwen2.5-coder:7b",
echo     "apiKey": "ollama"
echo   },
echo   "contextProviders": {
echo     "open": true,
echo     "directory": true,
echo     "githubIssues": false,
echo     "googleSearch": false
echo   },
echo   "allowAnonymousTelemetry": false
echo }
) > "%CONFIG_PATH%"

echo ✓ Конфигурация создана: %CONFIG_PATH%

echo [5/5] Проверка AGENTS.md...
if exist "C:\Users\khram\OneDrive\Рабочий стол\autoparts\AGENTS.md" (
    echo ✓ AGENTS.md найден
) else (
    echo ⚠ AGENTS.md не найден
)

echo.
echo === Настройка завершена! ===
echo.
echo Дальнейшие шаги:
echo 1. Перезапустите VS Code
echo 2. Откройте панель Continue (иконка слева)
echo 3. Протестируйте: попросите написать простую функцию на Python
echo 4. Для работы с планом:
echo    Прочитай файл C:\Users\khram\.devin\plans\plan-56e11ddf1cb87079.md
echo    Выполни ЭТАП 1 из плана
echo.
echo Документация: docs\LOCAL_AI_SETUP.md
pause
