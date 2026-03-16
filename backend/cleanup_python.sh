#!/bin/bash

################################################################################
# Скрипт очистки мусора для Python проекта на Ubuntu
# Очищает __pycache__, .pyc, .pyo, .pyd файлы и другой мусор
################################################################################

set -e  # Выход при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Очистка Python проекта от мусора${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Определяем директорию проекта (где запущен скрипт)
PROJECT_DIR="${1:-.}"

echo -e "${YELLOW}📁 Рабочая директория: ${PROJECT_DIR}${NC}"
echo ""

# Функция подсчета размера файлов перед удалением
get_dir_size() {
    du -sh "$1" 2>/dev/null | cut -f1
}

# 1. Очистка __pycache__ директорий
echo -e "${YELLOW}[1/7] 🔍 Поиск __pycache__ директорий...${NC}"
PYCACHE_COUNT=$(find "$PROJECT_DIR" -type d -name "__pycache__" 2>/dev/null | wc -l)
PYCACHE_SIZE=$(du -sch $(find "$PROJECT_DIR" -type d -name "__pycache__" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$PYCACHE_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$PYCACHE_COUNT${NC} директорий (__pycache__)"
    echo -e "   Размер: ${GREEN}$PYCACHE_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет __pycache__${NC}"
fi
echo ""

# 2. Очистка .pyc файлов
echo -e "${YELLOW}[2/7] 🔍 Поиск .pyc файлов...${NC}"
PYC_COUNT=$(find "$PROJECT_DIR" -type f -name "*.pyc" 2>/dev/null | wc -l)
PYC_SIZE=$(du -sch $(find "$PROJECT_DIR" -type f -name "*.pyc" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$PYC_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$PYC_COUNT${NC} файлов (.pyc)"
    echo -e "   Размер: ${GREEN}$PYC_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type f -name "*.pyc" -delete 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет .pyc файлов${NC}"
fi
echo ""

# 3. Очистка .pyo файлов
echo -e "${YELLOW}[3/7] 🔍 Поиск .pyo файлов...${NC}"
PYO_COUNT=$(find "$PROJECT_DIR" -type f -name "*.pyo" 2>/dev/null | wc -l)
PYO_SIZE=$(du -sch $(find "$PROJECT_DIR" -type f -name "*.pyo" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$PYO_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$PYO_COUNT${NC} файлов (.pyo)"
    echo -e "   Размер: ${GREEN}$PYO_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type f -name "*.pyo" -delete 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет .pyo файлов${NC}"
fi
echo ""

# 4. Очистка .pyd файлов (для Windows совместимости)
echo -e "${YELLOW}[4/7] 🔍 Поиск .pyd файлов...${NC}"
PYD_COUNT=$(find "$PROJECT_DIR" -type f -name "*.pyd" 2>/dev/null | wc -l)
PYD_SIZE=$(du -sch $(find "$PROJECT_DIR" -type f -name "*.pyd" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$PYD_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$PYD_COUNT${NC} файлов (.pyd)"
    echo -e "   Размер: ${GREEN}$PYD_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type f -name "*.pyd" -delete 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет .pyd файлов${NC}"
fi
echo ""

# 5. Очистка .egg-info директорий
echo -e "${YELLOW}[5/7] 🔍 Поиск .egg-info директорий...${NC}"
EGG_COUNT=$(find "$PROJECT_DIR" -type d -name "*.egg-info" 2>/dev/null | wc -l)
EGG_SIZE=$(du -sch $(find "$PROJECT_DIR" -type d -name "*.egg-info" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$EGG_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$EGG_COUNT${NC} директорий (*.egg-info)"
    echo -e "   Размер: ${GREEN}$EGG_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет .egg-info директорий${NC}"
fi
echo ""

# 6. Очистка .eggs директорий
echo -e "${YELLOW}[6/7] 🔍 Поиск .eggs директорий...${NC}"
EGGS_COUNT=$(find "$PROJECT_DIR" -type d -name ".eggs" 2>/dev/null | wc -l)
EGGS_SIZE=$(du -sch $(find "$PROJECT_DIR" -type d -name ".eggs" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$EGGS_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$EGGS_COUNT${NC} директорий (.eggs)"
    echo -e "   Размер: ${GREEN}$EGGS_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -type d -name ".eggs" -exec rm -rf {} + 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет .eggs директорий${NC}"
fi
echo ""

# 7. Очистка .pytest_cache и .tox
echo -e "${YELLOW}[7/7] 🔍 Поиск тестовых кэшей...${NC}"
TEST_CACHE_COUNT=$(find "$PROJECT_DIR" -maxdepth 2 -type d \( -name ".pytest_cache" -o -name ".tox" -o -name ".coverage" -o -name "htmlcov" \) 2>/dev/null | wc -l)
TEST_CACHE_SIZE=$(du -sch $(find "$PROJECT_DIR" -maxdepth 2 -type d \( -name ".pytest_cache" -o -name ".tox" -o -name ".coverage" -o -name "htmlcov" \) 2>/dev/null) 2>/dev/null | tail -1 | cut -f1 || echo "0")

if [ "$TEST_CACHE_COUNT" -gt 0 ]; then
    echo -e "   Найдено: ${GREEN}$TEST_CACHE_COUNT${NC} директорий (тестовые кэши)"
    echo -e "   Размер: ${GREEN}$TEST_CACHE_SIZE${NC}"
    read -p "   Удалить? (y/n): " confirm
    if [ "$confirm" = "y" ]; then
        find "$PROJECT_DIR" -maxdepth 2 -type d \( -name ".pytest_cache" -o -name ".tox" -o -name ".coverage" -o -name "htmlcov" \) -exec rm -rf {} + 2>/dev/null
        echo -e "   ${GREEN}✓ Удалено${NC}"
    else
        echo -e "   ${YELLOW}⊗ Пропущено${NC}"
    fi
else
    echo -e "   ${GREEN}✓ Нет тестовых кэшей${NC}"
fi
echo ""

# Итоговая статистика
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Очистка завершена!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Показываем итоговый размер освобожденного места
TOTAL_FREED="0"
if [ -n "$PYCACHE_SIZE" ] && [ "$PYCACHE_SIZE" != "0" ]; then
    TOTAL_FREED="$PYCACHE_SIZE"
fi

echo -e "Освобождено места: ~${GREEN}$TOTAL_FREED${NC}"
echo ""
echo -e "${YELLOW}💡 Совет:${NC}"
echo "   Добавьте эти пути в .gitignore чтобы они не попадали в репозиторий:"
echo ""
cat << 'EOF'
   __pycache__/
   *.py[cod]
   *$py.class
   *.so
   .Python
   build/
   develop-eggs/
   dist/
   downloads/
   eggs/
   .eggs/
   lib/
   lib64/
   parts/
   sdist/
   var/
   wheels/
   *.egg-info/
   .installed.cfg
   *.egg
   .pytest_cache/
   .tox/
   .coverage
   htmlcov/
EOF
echo ""
