import re

def normalize_to_storage_format(phone: str) -> str | None:
    """
    Приводит любой российский номер к формату: +7 (XXX) XXX-XX-XX
    Возвращает None, если номер недействителен.
    """
    if not phone:
        return None

    digits = re.sub(r'\D', '', phone)

    if len(digits) == 10:
        pass
    elif len(digits) == 11 and digits.startswith('8'):
        digits = digits[1:]
    elif len(digits) == 11 and digits.startswith('7'):
        digits = digits[1:]
    else:
        return None

    if len(digits) != 10:
        return None

    return f"+7 ({digits[:3]}) {digits[3:6]}-{digits[6:8]}-{digits[8:10]}"