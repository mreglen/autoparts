import { INVENTORY_STATUS_LABELS } from '../../utils/inventoryAccess';

export default function InventorySessionCard({ session, onOpen }) {
  const statusLabel = INVENTORY_STATUS_LABELS[session.status] || session.status;
  const progress =
    session.lines_total > 0
      ? Math.round((session.lines_counted / session.lines_total) * 100)
      : 0;

  const isActive = session.status === 'counting' || session.status === 'draft';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {session.title || `Инвентаризация #${session.id}`}
            </h3>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                isActive ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1 truncate">
            {session.storage_location_address || `Склад #${session.storage_location_id}`}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {session.created_at
              ? `Создана: ${new Date(session.created_at).toLocaleString('ru-RU')}`
              : null}
            {session.completed_at
              ? ` · Завершена: ${new Date(session.completed_at).toLocaleString('ru-RU')}`
              : null}
          </p>
        </div>

        <div className="flex items-center gap-4 sm:text-right">
          <div>
            <p className="text-sm font-medium text-gray-900 tabular-nums">
              {session.lines_counted}/{session.lines_total}
            </p>
            <p className="text-xs text-gray-500">позиций</p>
          </div>
          {isActive && onOpen && (
            <button
              type="button"
              onClick={() => onOpen(session)}
              className="px-3 py-2 text-sm font-medium text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50"
            >
              Продолжить
            </button>
          )}
        </div>
      </div>

      {session.lines_total > 0 && (
        <div className="mt-4">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
