/**
 * Адрес backend'а. Пилот работает на боевых данных (mobile/docs/decisions.md, 0.9),
 * поэтому продакшн-URL — константа, а не переменная сборки: собрать приложение с другим
 * сервером можно, только отредактировав эту строку, и это видно в diff.
 */
export const API_BASE_URL = 'https://svoygarage.ru/server/api';

export const REQUEST_TIMEOUT_MS = 15000;
export const GET_RETRY_LIMIT = 2;
