export default function CatalogNewBadge({ className = '' }) {
  return (
    <span
      className={`pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ${className}`}
    >
      NEW
    </span>
  );
}
