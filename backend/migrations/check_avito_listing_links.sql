-- Скрипт для проверки связей товаров с Авито и состояния заказов
-- Замените 'YOUR_ORG_ID' на ваш реальный organization_id

-- ============================================================================
-- 1. Проверить связи товаров с Авито (product_avito_listing_links)
-- ============================================================================
SELECT 
    pal.id as link_id,
    pal.organization_id,
    pal.product_id,
    pal.avito_ad_id,      -- internal_code (наш внутренний код)
    pal.avito_id,         -- реальный Avito item_id (например, 8069781522)
    p.article,
    p.name,
    p.internal_code,
    p.quantity,
    pal.created_at
FROM product_avito_listing_links pal
LEFT JOIN products p ON p.id = pal.product_id
WHERE pal.organization_id = 'YOUR_ORG_ID'  -- <-- ЗАМЕНИТЕ!
ORDER BY pal.created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. Проверить заказы Авито (avito_orders_cache)
-- ============================================================================
SELECT 
    id,
    avito_order_id,
    avito_status_code,
    closed_processed,
    total_amount,
    is_paid,
    created_at,
    synced_at
FROM avito_orders_cache
WHERE organization_id = 'YOUR_ORG_ID'  -- <-- ЗАМЕНИТЕ!
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 3. Найти необработанные закрытые заказы
-- ============================================================================
SELECT 
    id,
    avito_order_id,
    avito_status_code,
    closed_processed,
    total_amount,
    created_at
FROM avito_orders_cache
WHERE organization_id = 'YOUR_ORG_ID'  -- <-- ЗАМЕНИТЕ!
  AND avito_status_code = 'closed'
  AND closed_processed = false
ORDER BY created_at DESC;

-- ============================================================================
-- 4. Проверить stock-out записи для Авито заказов
-- ============================================================================
SELECT 
    so.id,
    so.product_id,
    so.quantity,
    so.sale_price,
    so.sale_channel,
    so.avito_order_id,
    so.reason,
    so.movement_date,
    p.article,
    p.name
FROM stock_out so
LEFT JOIN products p ON p.id = so.product_id
WHERE so.organization_id = 'YOUR_ORG_ID'  -- <-- ЗАМЕНИТЕ!
  AND so.sale_channel = 'avito'
ORDER BY so.movement_date DESC
LIMIT 20;

-- ============================================================================
-- 5. Статистика по заказам
-- ============================================================================
SELECT 
    avito_status_code as status,
    COUNT(*) as total_orders,
    SUM(CASE WHEN closed_processed = true THEN 1 ELSE 0 END) as processed,
    SUM(CASE WHEN closed_processed = false THEN 1 ELSE 0 END) as unprocessed
FROM avito_orders_cache
WHERE organization_id = 'YOUR_ORG_ID'  -- <-- ЗАМЕНИТЕ!
GROUP BY avito_status_code
ORDER BY total_orders DESC;
