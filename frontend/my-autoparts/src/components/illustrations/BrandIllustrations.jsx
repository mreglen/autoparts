/**
 * Simple inline SVG empty-state illustrations for «Свой Гараж».
 * Colors: brand / accent / ink tokens only.
 */

function SvgFrame({ children, className = 'h-24 w-24' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function EmptySearch({ className } = {}) {
  return (
    <SvgFrame className={className}>
      <circle cx="42" cy="42" r="22" className="stroke-brand-500" strokeWidth="3" />
      <path d="M58 58l16 16" className="stroke-accent-600" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="42" cy="42" r="8" className="fill-brand-50 stroke-brand-300" strokeWidth="2" />
      <path d="M36 42h12M42 36v12" className="stroke-ink-muted" strokeWidth="2" strokeLinecap="round" />
    </SvgFrame>
  );
}

export function EmptyGarage({ className } = {}) {
  return (
    <SvgFrame className={className}>
      <path
        d="M16 44L48 20l32 24v36H16V44z"
        className="fill-brand-50 stroke-brand-600"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M36 80V54h24v26" className="fill-surface stroke-ink-soft" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 44h52" className="stroke-accent-500" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="54" cy="67" r="1.5" className="fill-ink-muted" />
    </SvgFrame>
  );
}

export function EmptyOrders({ className } = {}) {
  return (
    <SvgFrame className={className}>
      <rect x="24" y="18" width="48" height="60" rx="6" className="fill-brand-50 stroke-brand-600" strokeWidth="2.5" />
      <path d="M34 34h28M34 46h28M34 58h18" className="stroke-ink-muted" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="68" cy="68" r="12" className="fill-surface stroke-accent-600" strokeWidth="2.5" />
      <path d="M68 62v8M64 70h8" className="stroke-accent-600" strokeWidth="2" strokeLinecap="round" />
    </SvgFrame>
  );
}

export function SuccessCheck({ className } = {}) {
  return (
    <SvgFrame className={className}>
      <circle cx="48" cy="48" r="28" className="fill-brand-50 stroke-brand-600" strokeWidth="2.5" />
      <path
        d="M34 49l10 10 18-20"
        className="stroke-brand-700"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgFrame>
  );
}

export function ErrorWarn({ className } = {}) {
  return (
    <SvgFrame className={className}>
      <path
        d="M48 16L84 78H12L48 16z"
        className="fill-accent-50 stroke-accent-600"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M48 40v18" className="stroke-ink" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="48" cy="66" r="2.5" className="fill-ink" />
    </SvgFrame>
  );
}

export const EmptySearchIcon = EmptySearch;
export const EmptyGarageIcon = EmptyGarage;
export const EmptyOrdersIcon = EmptyOrders;
export const SuccessCheckIcon = SuccessCheck;
export const ErrorWarnIcon = ErrorWarn;

const BrandIllustrations = {
  EmptySearch,
  EmptyGarage,
  EmptyOrders,
  SuccessCheck,
  ErrorWarn,
};

export default BrandIllustrations;
