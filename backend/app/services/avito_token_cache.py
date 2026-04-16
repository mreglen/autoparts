"""
Сервис для кэширования токенов Avito.
Предотвращает rate limiting за счёт переиспользования токенов.
Токен Avito действителен 30 минут (1800 секунд).
"""
import time
from typing import Optional
from threading import Lock


class AvitoTokenCache:
    """Thread-safe кэш для токенов Avito"""
    
    def __init__(self, ttl: int = 1700):  # 28 минут вместо 30 для запаса
        self._cache: dict[str, dict] = {}
        self._lock = Lock()
        self._ttl = ttl  # Time to live в секундах
    
    def get_token(self, cache_key: str) -> Optional[str]:
        """
        Получить токен из кэша.
        Возвращает None если токен истёк или не найден.
        """
        with self._lock:
            if cache_key in self._cache:
                cached = self._cache[cache_key]
                if time.time() < cached['expires_at']:
                    return cached['token']
                else:
                    # Токен истёк, удаляем
                    del self._cache[cache_key]
            return None
    
    def set_token(self, cache_key: str, token: str, expires_in: int = 1800):
        """
        Сохранить токен в кэш.
        :param cache_key: Уникальный ключ (например, client_id)
        :param token: Access token
        :param expires_in: Время жизни токена в секундах (по умолчанию 30 минут)
        """
        with self._lock:
            self._cache[cache_key] = {
                'token': token,
                'expires_at': time.time() + min(expires_in, self._ttl)
            }
    
    def invalidate(self, cache_key: str):
        """Удалить токен из кэша (например, при ошибке авторизации)"""
        with self._lock:
            if cache_key in self._cache:
                del self._cache[cache_key]
    
    def clear(self):
        """Очистить весь кэш"""
        with self._lock:
            self._cache.clear()


# Глобальный экземпляр кэша
token_cache = AvitoTokenCache()
