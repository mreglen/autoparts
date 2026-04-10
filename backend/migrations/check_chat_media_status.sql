-- =====================================================
-- Диагностика и исправление проблем с медиа в чатах
-- =====================================================

-- 1. Показать общую статистику
SELECT 
    COUNT(*) as total_media,
    SUM(CASE WHEN is_processing = TRUE THEN 1 ELSE 0 END) as processing_count,
    SUM(CASE WHEN is_processing = FALSE THEN 1 ELSE 0 END) as completed_count,
    SUM(CASE WHEN is_processing IS NULL THEN 1 ELSE 0 END) as null_status_count
FROM chat_media;

-- 2. Показать все медиа в статусе processing (возможно застряли)
SELECT 
    id,
    message_id,
    media_type,
    original_filename,
    file_path,
    thumbnail_path,
    is_processing,
    created_at,
    CASE 
        WHEN file_path IS NULL THEN '❌ NO FILE PATH'
        WHEN file_path = '' THEN '❌ EMPTY FILE PATH'
        ELSE '✅ Has path'
    END as file_status
FROM chat_media
WHERE is_processing = TRUE
ORDER BY created_at DESC;

-- 3. Показать последние 20 медиа записей
SELECT 
    id,
    media_type,
    original_filename,
    file_size,
    is_processing,
    created_at,
    LEFT(file_path, 60) as file_path_short
FROM chat_media
ORDER BY id DESC
LIMIT 20;

-- 4. Найти медиа без file_path
SELECT 
    id,
    media_type,
    original_filename,
    is_processing,
    created_at
FROM chat_media
WHERE file_path IS NULL OR file_path = ''
ORDER BY created_at DESC;

-- 5. Проверить медиа с NULL is_processing
SELECT 
    id,
    media_type,
    original_filename,
    is_processing,
    created_at
FROM chat_media
WHERE is_processing IS NULL
ORDER BY created_at DESC;

-- =====================================================
-- ИСПРАВЛЕНИЯ (раскомментируйте нужные запросы)
-- =====================================================

-- ИСПРАВЛЕНИЕ 1: Сбросить статус processing для всех застрявших медиа
-- ВНИМАНИЕ: Это сбросит статус для ВСЕХ медиа в processing
-- UPDATE chat_media 
-- SET is_processing = FALSE 
-- WHERE is_processing = TRUE;

-- ИСПРАВЛЕНИЕ 2: Сбросить статус только для старых медиа (старше 1 часа)
-- UPDATE chat_media 
-- SET is_processing = FALSE 
-- WHERE is_processing = TRUE 
-- AND created_at < NOW() - INTERVAL 1 HOUR;

-- ИСПРАВЛЕНИЕ 3: Установить is_processing=FALSE для NULL значений
-- UPDATE chat_media 
-- SET is_processing = FALSE 
-- WHERE is_processing IS NULL;

-- =====================================================
-- Дополнительная информация
-- =====================================================

-- 6. Показать распределение по типам медиа
SELECT 
    media_type,
    COUNT(*) as count,
    SUM(CASE WHEN is_processing = TRUE THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN is_processing = FALSE THEN 1 ELSE 0 END) as completed
FROM chat_media
GROUP BY media_type;

-- 7. Показать медиа по дням (последние 7 дней)
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total,
    SUM(CASE WHEN is_processing = TRUE THEN 1 ELSE 0 END) as processing,
    SUM(CASE WHEN is_processing = FALSE THEN 1 ELSE 0 END) as completed
FROM chat_media
WHERE created_at >= NOW() - INTERVAL 7 DAY
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 8. Проверить сообщения с медиа
SELECT 
    cm.id as media_id,
    cm.media_type,
    cm.is_processing,
    m.id as message_id,
    m.chat_id,
    m.sender_id,
    LEFT(m.message, 50) as message_text,
    cm.created_at
FROM chat_media cm
JOIN messages m ON cm.message_id = m.id
ORDER BY cm.id DESC
LIMIT 20;

-- 9. Проверить чаты с медиа
SELECT 
    c.id as chat_id,
    c.buyer_id,
    c.seller_id,
    COUNT(cm.id) as media_count,
    SUM(CASE WHEN cm.is_processing = TRUE THEN 1 ELSE 0 END) as processing_count
FROM chat_media cm
JOIN messages m ON cm.message_id = m.id
JOIN chats c ON m.chat_id = c.id
GROUP BY c.id, c.buyer_id, c.seller_id
HAVING media_count > 0
ORDER BY media_count DESC
LIMIT 20;
