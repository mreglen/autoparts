import {
  ADMIN_MENU_MODE_ADMIN,
  ADMIN_MENU_MODE_USER,
} from '../../utils/adminMenuMode';

export default function AdminMenuModeSwitch({ mode, onChange, variant = 'sidebar' }) {
  const isDrawer = variant === 'drawer';

  const baseBtn = isDrawer
    ? 'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition'
    : 'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition';

  const active = 'bg-white text-indigo-700 shadow-sm';
  const inactive = 'text-gray-600 hover:text-gray-800';

  return (
    <div className={isDrawer ? 'mb-3 px-1' : 'border-b border-gray-100 px-3 py-3'}>
      <p className={`mb-2 font-medium text-gray-500 ${isDrawer ? 'text-xs' : 'text-[11px] uppercase tracking-wide'}`}>
        Режим меню
      </p>
      <div
        className={`grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 ${isDrawer ? '' : ''}`}
        role="tablist"
        aria-label="Режим меню"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === ADMIN_MENU_MODE_USER}
          className={`${baseBtn} ${mode === ADMIN_MENU_MODE_USER ? active : inactive}`}
          onClick={() => onChange(ADMIN_MENU_MODE_USER)}
        >
          Пользователь
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === ADMIN_MENU_MODE_ADMIN}
          className={`${baseBtn} ${mode === ADMIN_MENU_MODE_ADMIN ? active : inactive}`}
          onClick={() => onChange(ADMIN_MENU_MODE_ADMIN)}
        >
          Админ
        </button>
      </div>
    </div>
  );
}
