#!/bin/bash

PROJECT_DIR="${1:-.}"

echo "Очистка Python проекта в: $PROJECT_DIR"
echo ""

# Считаем размер до очистки
SIZE_BEFORE=$(du -sh "$PROJECT_DIR" 2>/dev/null | cut -f1)
echo "Размер до: $SIZE_BEFORE"

# Удаляем всё без вопросов
echo "Удаление __pycache__..."
find "$PROJECT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

echo "Удаление *.pyc..."
find "$PROJECT_DIR" -type f -name "*.pyc" -delete 2>/dev/null

echo "Удаление *.pyo..."
find "$PROJECT_DIR" -type f -name "*.pyo" -delete 2>/dev/null

echo "Удаление *.egg-info..."
find "$PROJECT_DIR" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null

echo "Удаление .pytest_cache..."
find "$PROJECT_DIR" -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null

echo "Удаление .tox..."
find "$PROJECT_DIR" -type d -name ".tox" -exec rm -rf {} + 2>/dev/null

echo "Удаление .coverage..."
find "$PROJECT_DIR" -type f -name ".coverage" -delete 2>/dev/null

# Считаем размер после очистки
SIZE_AFTER=$(du -sh "$PROJECT_DIR" 2>/dev/null | cut -f1)
echo ""
echo "Готово"
echo "Размер после: $SIZE_AFTER"
echo ""
echo "Очищено:"
echo " __pycache__/"
echo " *.pyc, *.pyo, *.pyd"
echo " *.egg-info/"
echo " .pytest_cache/"
echo " .tox/"
echo " .coverage/"