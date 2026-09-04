from __future__ import annotations

CATEGORY_LABELS: dict[str, str] = {
    "auth": "Авторизация",
    "warehouse": "Склад",
    "sales": "Продажи",
    "products": "Товары",
    "employees": "Сотрудники",
    "integrations": "Интеграции",
    "finance": "Финансы",
    "moderation": "Модерация",
    "orders": "Заказы",
    "settings": "Настройки",
    "system": "Система",
    "users": "Пользователи",
}

EVENT_TYPE_LABELS: dict[str, str] = {
    "registration_started": "Начало регистрации",
    "user_registered": "Регистрация пользователя",
    "user_logged_in": "Вход в систему",
    "user_logged_out": "Выход из системы",
    "seller_registration_submitted": "Заявка продавца отправлена",
    "seller_approved": "Продавец одобрен",
    "seller_rejected": "Продавец отклонён",
    "employee_created": "Сотрудник создан",
    "employee_updated": "Сотрудник обновлён",
    "employee_deleted": "Сотрудник удалён",
    "employee_permissions_changed": "Права сотрудника изменены",
    "stock_in_created": "Поступление на склад",
    "stock_out_created": "Расход со склада",
    "stock_out_return": "Возврат на склад",
    "product_created": "Товар создан",
    "product_updated": "Товар обновлён",
    "product_deleted": "Товар удалён",
    "product_quantity_changed": "Изменено количество товара",
    "order_created": "Заказ создан",
    "order_status_changed": "Статус заказа изменён",
    "order_fulfilled": "Заказ проведён на склад",
    "finance_export": "Экспорт финансов XLSX",
    "organization_updated": "Организация обновлена",
    "site_settings_updated": "Настройки сайта обновлены",
    "vpn_bot_credentials_updated": "Токен VPN Telegram-бота обновлён",
    "vpn_bot_settings_updated": "Настройки VPN Telegram-бота обновлены",
    "storage_location_changed": "Склад изменён",
    "integration_updated": "Интеграция обновлена",
    "avito_sync": "Синхронизация Авито",
    "avito_export": "Экспорт в Авито",
    "drom_export": "Экспорт в Drom",
    "inventory_session_created": "Инвентаризация создана",
    "inventory_session_completed": "Инвентаризация завершена",
    "avito_warehouse_retry": "Повтор проведения Авито на склад",
    "product_moderation_approved": "Товар одобрен модерацией",
    "product_moderation_rejected": "Товар отклонён модерацией",
    "pending_product_created": "Черновик товара создан",
    "pending_product_updated": "Черновик товара обновлён",
    "pending_product_deleted": "Черновик товара удалён",
    "printer_label_settings_updated": "Настройки этикетки принтера",
    "storage_location_created": "Склад создан",
    "storage_location_updated": "Склад обновлён",
    "storage_location_deleted": "Склад удалён",
    "password_reset_requested": "Запрос сброса пароля",
    "user_avatar_uploaded": "Аватар загружен",
    "user_avatar_removed": "Аватар удалён",
    "admin_user_viewed": "Просмотр пользователя (админ)",
    "admin_user_sessions_revoked": "Сессии пользователя завершены (админ)",
    "admin_user_updated": "Пользователь изменён (админ)",
    "rossko_settings_updated": "Настройки Rossko обновлены",
    "rossko_credentials_updated": "Ключи Rossko обновлены",
    "rossko_order_created": "Заказ Rossko создан",
    "rossko_order_failed": "Ошибка отправки заказа в Rossko",
}


def label_for_category(code: str | None) -> str:
    if not code:
        return "—"
    return CATEGORY_LABELS.get(code, code)


def label_for_event_type(code: str | None) -> str:
    if not code:
        return "—"
    return EVENT_TYPE_LABELS.get(code, code)
