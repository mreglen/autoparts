from telegram import InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup

MAIN_KEYBOARD = ReplyKeyboardMarkup(
    [["📋 История ошибок", "📊 Статус"], ["🚪 Выйти"]],
    resize_keyboard=True,
)


def history_keyboard(page: int, total_pages: int) -> InlineKeyboardMarkup | None:
    if total_pages <= 1:
        return None
    buttons = []
    if page > 0:
        buttons.append(InlineKeyboardButton("◀️ Назад", callback_data=f"history:{page - 1}"))
    if page < total_pages - 1:
        buttons.append(InlineKeyboardButton("Вперёд ▶️", callback_data=f"history:{page + 1}"))
    return InlineKeyboardMarkup([buttons]) if buttons else None
