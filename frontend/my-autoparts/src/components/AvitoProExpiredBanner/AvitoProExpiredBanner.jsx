import { Link } from 'react-router-dom';
import { shouldShowAvitoProExpiredBanner } from '../../utils/avitoProAccess';

export default function AvitoProExpiredBanner({ status }) {
  if (!shouldShowAvitoProExpiredBanner(status)) {
    return null;
  }

  const message = status?.pro_status_message
    || 'Подписка Avito Pro истекла. Функции Avito временно недоступны.';

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-900">Подписка Avito Pro истекла</p>
            <p className="mt-1 text-sm text-red-800">{message}</p>
          </div>
        </div>
        <Link
          to="/settings/integration/avito"
          className="text-sm font-medium text-red-700 underline hover:text-red-900"
        >
          Настройки интеграции
        </Link>
      </div>
    </div>
  );
}
