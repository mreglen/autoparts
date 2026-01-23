import random
import string


def random_id(length: int = 10) -> str:
    """
    Генератор id случайных символов

    length:int длина id
    
    Возвращает id из указанного количество символов, \n 
    по умолчанию 10
    """
    characters = string.ascii_letters + string.digits  

    return ''.join(random.choice(characters) for _ in range(length))


def generate_internal_code() -> str:
    """
    Генератор внутреннего кода продукта
    
    Возвращает уникальный внутренний код в формате PRD-XXXXXX
    где XXXXXX - случайные символы
    """
    prefix = "PRD"
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{prefix}-{suffix}"