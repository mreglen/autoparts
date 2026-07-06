import { Link } from 'react-router-dom';
import { ProfileEmptyLine } from './profileUi';

export const PREVIEW_LIMIT = {
  favorites: 6,
  views: 6,
  subscriptions: 3,
};

export function formatSubscriptionDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

export function ProfileSubscriptionsList({ items, onDelete, emptyMessage }) {
  if (!items?.length) {
    return emptyMessage ? (
      <ProfileEmptyLine>{emptyMessage}</ProfileEmptyLine>
    ) : (
      <ProfileEmptyLine>
        Нет подписок.{' '}
        <Link to="/autoparts/used" className="font-medium text-indigo-600 hover:text-indigo-700">
          Каталог
        </Link>
      </ProfileEmptyLine>
    );
  }

  return (
    <ul>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-900">{item.query_text}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {formatSubscriptionDate(item.created_at)}
              {item.last_notified_at ? ` · ${formatSubscriptionDate(item.last_notified_at)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="shrink-0 text-sm text-gray-400 hover:text-red-600"
          >
            Убрать
          </button>
        </li>
      ))}
    </ul>
  );
}
