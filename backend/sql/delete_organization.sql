-- =============================================================================
-- Полное удаление организации из БД PostgreSQL
-- =============================================================================
-- 1. Сделайте бэкап перед запуском.
-- 2. Подставьте ID организации в v_org_id ниже.
-- 3. Выполните весь скрипт целиком (BEGIN … COMMIT).
-- 4. Если уже видите ошибку 25P02 — сначала выполните: ROLLBACK;
--
-- Файлы uploads/ (логотипы, фото, видео) скрипт НЕ удаляет — только БД.
-- =============================================================================

-- При ошибке в прошлом запуске раскомментируйте и выполните один раз:
-- ROLLBACK;

BEGIN;

DO $$
DECLARE
    -- >>> ПОДСТАВЬТЕ ID ОРГАНИЗАЦИИ СЮДА <<<
    v_org_id TEXT := 'X5P5g5ImsF';

    v_org_name TEXT;
    v_users_count INT;
    v_products_count INT;
BEGIN
    IF v_org_id IS NULL OR btrim(v_org_id) = '' OR v_org_id = 'PASTE_ORG_ID_HERE' THEN
        RAISE EXCEPTION 'Укажите реальный ID организации в переменной v_org_id (строка 16)';
    END IF;

    SELECT name INTO v_org_name FROM organizations WHERE id = v_org_id;
    IF v_org_name IS NULL THEN
        RAISE EXCEPTION 'Организация % не найдена', v_org_id;
    END IF;

    CREATE TEMP TABLE tmp_org_users ON COMMIT DROP AS
        SELECT id AS user_id FROM users WHERE organization_id = v_org_id;

    CREATE TEMP TABLE tmp_org_products ON COMMIT DROP AS
        SELECT id AS product_id FROM products WHERE organization_id = v_org_id;

    CREATE TEMP TABLE tmp_org_vehicles ON COMMIT DROP AS
        SELECT id AS vehicle_id FROM vehicles WHERE organization_id = v_org_id;

    CREATE TEMP TABLE tmp_org_storage_locations ON COMMIT DROP AS
        SELECT id AS storage_location_id FROM storage_locations WHERE organization_id = v_org_id;

    CREATE TEMP TABLE tmp_org_storage_cells ON COMMIT DROP AS
        SELECT sc.id AS storage_cell_id
        FROM storage_cells sc
        JOIN tmp_org_storage_locations sl ON sl.storage_location_id = sc.storage_location_id;

    CREATE TEMP TABLE tmp_org_pending_products ON COMMIT DROP AS
        SELECT id AS pending_product_id FROM pending_products WHERE organization_id = v_org_id;

    CREATE TEMP TABLE tmp_org_acquired_products ON COMMIT DROP AS
        SELECT id AS acquired_product_id FROM acquired_products WHERE organization_id = v_org_id;

    -- Чаты, которые удаляем целиком (группа организации, директ, товар, buyer/seller)
    CREATE TEMP TABLE tmp_org_chats ON COMMIT DROP AS
        SELECT DISTINCT c.id AS chat_id
        FROM chats c
        LEFT JOIN tmp_org_users u ON u.user_id IN (c.buyer_id, c.seller_id)
        LEFT JOIN tmp_org_products p ON p.product_id = c.product_id
        LEFT JOIN chat_participants cp ON cp.chat_id = c.id
        LEFT JOIN tmp_org_users u2 ON u2.user_id = cp.user_id
        WHERE c.organization_id = v_org_id
           OR u.user_id IS NOT NULL
           OR p.product_id IS NOT NULL
           OR u2.user_id IS NOT NULL;

    CREATE TEMP TABLE tmp_org_printer_agents ON COMMIT DROP AS
        SELECT id AS agent_id FROM printer_agents WHERE organization_id = v_org_id;

    SELECT COUNT(*) INTO v_users_count FROM tmp_org_users;
    SELECT COUNT(*) INTO v_products_count FROM tmp_org_products;

    IF EXISTS (
        SELECT 1
        FROM products p
        JOIN tmp_org_users u ON u.user_id = p.created_by
        WHERE p.organization_id IS DISTINCT FROM v_org_id
    ) THEN
        RAISE EXCEPTION 'Сотрудники организации % создавали товары других организаций — удаление остановлено', v_org_id;
    END IF;

    RAISE NOTICE 'Удаление организации % (%)', v_org_id, v_org_name;
    RAISE NOTICE 'Пользователей: %, товаров: %', v_users_count, v_products_count;

    -- SEO-выгрузки URL товаров
    DELETE FROM seo_product_url_exports e
    USING tmp_org_products p
    WHERE e.product_id = p.product_id;

    -- Корзины: позиции с товарами этой организации
    DELETE FROM used_parts_cart upc
    USING tmp_org_products p
    WHERE upc.product_id = p.product_id;

    DELETE FROM guest_used_parts_cart guc
    USING tmp_org_products p
    WHERE guc.product_id = p.product_id;

    -- Заказы «Гараж»
    DELETE FROM garage_used_order_items i
    USING garage_used_orders o
    WHERE i.order_id = o.id
      AND o.organization_id = v_org_id;

    DELETE FROM garage_used_orders WHERE organization_id = v_org_id;

    DELETE FROM garage_new_order_items i
    USING garage_new_orders o
    WHERE i.order_id = o.id
      AND o.organization_id = v_org_id;

    DELETE FROM garage_new_orders WHERE organization_id = v_org_id;

    -- Ссылки на маркетплейсы
    DELETE FROM product_avito_listing_links WHERE organization_id = v_org_id;
    DELETE FROM product_drom_listing_link WHERE organization_id = v_org_id;
    DELETE FROM avito_autoload_jobs WHERE organization_id = v_org_id;
    DELETE FROM avito_orders_cache WHERE organization_id = v_org_id;

    -- Складские движения
    DELETE FROM stock_out
    WHERE organization_id = v_org_id
       OR product_id IN (SELECT product_id FROM tmp_org_products)
       OR acquired_product_id IN (SELECT acquired_product_id FROM tmp_org_acquired_products);

    DELETE FROM stock_in
    WHERE organization_id = v_org_id
       OR product_id IN (SELECT product_id FROM tmp_org_products)
       OR acquired_product_id IN (SELECT acquired_product_id FROM tmp_org_acquired_products);

    -- Ячейки / товары
    DELETE FROM product_storage_cells psc
    USING tmp_org_products p
    WHERE psc.product_id = p.product_id;

    DELETE FROM product_storage_cells psc
    USING tmp_org_storage_cells sc
    WHERE psc.storage_cell_id = sc.storage_cell_id;

    DELETE FROM pending_product_storage_cells ppsc
    USING tmp_org_pending_products pp
    WHERE ppsc.pending_product_id = pp.pending_product_id;

    DELETE FROM product_vehicle_association pva
    USING tmp_org_products p
    WHERE pva.product_id = p.product_id;

    DELETE FROM product_vehicle_association pva
    USING tmp_org_vehicles v
    WHERE pva.vehicle_id = v.vehicle_id;

    DELETE FROM product_photos WHERE organization_id = v_org_id
        OR product_id IN (SELECT product_id FROM tmp_org_products);

    DELETE FROM product_videos WHERE organization_id = v_org_id
        OR product_id IN (SELECT product_id FROM tmp_org_products);

    DELETE FROM rejected_products WHERE organization_id = v_org_id;
    DELETE FROM pending_products WHERE organization_id = v_org_id;
    DELETE FROM acquired_products WHERE organization_id = v_org_id;
    DELETE FROM products WHERE organization_id = v_org_id;

    -- Автомобили
    DELETE FROM vehicle_transmissions vt
    USING tmp_org_vehicles v
    WHERE vt.vehicle_id = v.vehicle_id;

    DELETE FROM vehicle_mileages vm
    USING tmp_org_vehicles v
    WHERE vm.vehicle_id = v.vehicle_id;

    DELETE FROM vehicle_vins vv
    USING tmp_org_vehicles v
    WHERE vv.vehicle_id = v.vehicle_id;

    DELETE FROM vehicle_photos
    WHERE organization_id = v_org_id
       OR vehicle_id IN (SELECT vehicle_id FROM tmp_org_vehicles);

    DELETE FROM vehicles WHERE organization_id = v_org_id;

    -- Адресное хранение
    DELETE FROM storage_cells sc
    USING tmp_org_storage_locations sl
    WHERE sc.storage_location_id = sl.storage_location_id;

    DELETE FROM storage_locations WHERE organization_id = v_org_id;
    DELETE FROM pickup_locations WHERE organization_id = v_org_id;

    -- Клиенты и интеграции
    DELETE FROM clients WHERE organization_id = v_org_id;
    DELETE FROM organization_avito_autoload_cache WHERE organization_id = v_org_id;
    DELETE FROM organization_drom_autoload_cache WHERE organization_id = v_org_id;
    DELETE FROM organization_avito_integration WHERE organization_id = v_org_id;
    DELETE FROM organization_drom_integration WHERE organization_id = v_org_id;
    DELETE FROM organization_delivery_methods WHERE organization_id = v_org_id;

    -- Печать
    DELETE FROM printer_permissions pp
    USING printer_agent_printers pap, tmp_org_printer_agents pa
    WHERE pp.printer_id = pap.id
      AND pap.agent_id = pa.agent_id;

    DELETE FROM printer_permissions pp
    USING tmp_org_users u
    WHERE pp.user_id = u.user_id;

    DELETE FROM printer_agent_printers pap
    USING tmp_org_printer_agents pa
    WHERE pap.agent_id = pa.agent_id;

    DELETE FROM printer_agents WHERE organization_id = v_org_id;

    -- Чаты организации и с участниками/товарами организации
    UPDATE messages m
    SET reply_to_id = NULL
    FROM tmp_org_chats c
    WHERE m.chat_id = c.chat_id
      AND m.reply_to_id IS NOT NULL;

    DELETE FROM chat_media cm
    USING messages m, tmp_org_chats c
    WHERE cm.message_id = m.id
      AND m.chat_id = c.chat_id;

    DELETE FROM messages m
    USING tmp_org_chats c
    WHERE m.chat_id = c.chat_id;

    DELETE FROM chat_participants cp
    USING tmp_org_chats c
    WHERE cp.chat_id = c.chat_id;

    DELETE FROM chat_blocked_users cb
    USING tmp_org_chats c
    WHERE cb.chat_id = c.chat_id;

    DELETE FROM chats c
    USING tmp_org_chats t
    WHERE c.id = t.chat_id;

    -- Участие сотрудников в других чатах (например, общий чат директоров)
    UPDATE messages m
    SET reply_to_id = NULL
    FROM messages parent, tmp_org_users u
    WHERE m.reply_to_id = parent.id
      AND parent.sender_id = u.user_id;

    DELETE FROM chat_media cm
    USING messages m, tmp_org_users u
    WHERE cm.message_id = m.id
      AND m.sender_id = u.user_id;

    DELETE FROM messages m
    USING tmp_org_users u
    WHERE m.sender_id = u.user_id;

    DELETE FROM chat_participants cp
    USING tmp_org_users u
    WHERE cp.user_id = u.user_id;

    DELETE FROM chat_blocked_users cb
    USING tmp_org_users u
    WHERE cb.blocked_by_id = u.user_id
       OR cb.blocked_user_id = u.user_id;

    UPDATE chats
    SET buyer_id = NULL
    WHERE buyer_id IN (SELECT user_id FROM tmp_org_users);

    UPDATE chats
    SET seller_id = NULL
    WHERE seller_id IN (SELECT user_id FROM tmp_org_users);

    -- Пользователи организации
    DELETE FROM push_subscriptions ps
    USING tmp_org_users u
    WHERE ps.user_id = u.user_id;

    DELETE FROM user_permissions up
    USING tmp_org_users u
    WHERE up.user_id = u.user_id;

    DELETE FROM user_sessions us
    USING tmp_org_users u
    WHERE us.user_id = u.user_id;

    DELETE FROM new_parts_cart npc
    USING tmp_org_users u
    WHERE npc.user_id = u.user_id;

    DELETE FROM used_parts_cart upc
    USING tmp_org_users u
    WHERE upc.user_id = u.user_id;

    DELETE FROM carts c
    USING tmp_org_users u
    WHERE c.user_id = u.user_id;

    UPDATE site_reviews sr
    SET user_id = NULL
    FROM tmp_org_users u
    WHERE sr.user_id = u.user_id;

    DELETE FROM users WHERE organization_id = v_org_id;

    -- Журнал и прочие записи по organization_id
    DELETE FROM event_log WHERE organization_id = v_org_id;

    DELETE FROM organizations WHERE id = v_org_id;

    RAISE NOTICE 'Организация % успешно удалена из БД', v_org_id;
END $$;

-- Проверка: должно вернуть 0 строк
-- SELECT * FROM organizations WHERE id = 'X5P5g5ImsF';

COMMIT;
