import {
  SELLER_AUTOSERVICE_MODE_AUTOSERVICE,
  SELLER_AUTOSERVICE_MODE_SELLER,
} from '../../utils/sellerAutoserviceMode';

export default function SellerAutoserviceModeSwitch({ mode, onChange, variant = 'sidebar' }) {
  const isDrawer = variant === 'drawer';

  const baseBtn = isDrawer
    ? 'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition'
    : 'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition';

  const active = 'bg-white text-ink shadow-sm';
  const inactive = 'text-ink-muted hover:text-ink';

  return (
    <div className={isDrawer ? 'mb-3 px-1' : 'px-3 pb-3 pt-2'}>
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
        role="tablist"
        aria-label="Режим кабинета"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === SELLER_AUTOSERVICE_MODE_SELLER}
          className={`${baseBtn} ${mode === SELLER_AUTOSERVICE_MODE_SELLER ? active : inactive}`}
          onClick={() => onChange(SELLER_AUTOSERVICE_MODE_SELLER)}
        >
          Продавец
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE}
          className={`${baseBtn} ${mode === SELLER_AUTOSERVICE_MODE_AUTOSERVICE ? active : inactive}`}
          onClick={() => onChange(SELLER_AUTOSERVICE_MODE_AUTOSERVICE)}
        >
          Автосервис
        </button>
      </div>
    </div>
  );
}
