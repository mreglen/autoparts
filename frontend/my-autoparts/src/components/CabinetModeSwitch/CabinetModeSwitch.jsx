import { CABINET_MODE_LABELS } from '../../utils/cabinetMode';

export default function CabinetModeSwitch({ mode, modes, onChange, variant = 'sidebar' }) {
  const isDrawer = variant === 'drawer';

  if (!modes || modes.length <= 1) return null;

  const baseBtn = isDrawer
    ? 'rounded-lg px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm'
    : 'rounded-lg px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm';

  const active = 'bg-white text-gray-900 shadow-sm';
  const inactive = 'text-gray-600 hover:text-gray-900';

  const gridClass =
    modes.length <= 2 ? 'grid-cols-2' : 'grid-cols-2';

  return (
    <div className={isDrawer ? 'mb-3 px-1' : 'px-3 pb-3 pt-2'}>
      <div
        className={`grid ${gridClass} gap-1 rounded-xl bg-gray-100 p-1`}
        role="tablist"
        aria-label="Режим кабинета"
      >
        {modes.map((cabinetMode) => (
          <button
            key={cabinetMode}
            type="button"
            role="tab"
            aria-selected={mode === cabinetMode}
            className={`${baseBtn} ${mode === cabinetMode ? active : inactive}`}
            onClick={() => onChange(cabinetMode)}
          >
            {CABINET_MODE_LABELS[cabinetMode] || cabinetMode}
          </button>
        ))}
      </div>
    </div>
  );
}
