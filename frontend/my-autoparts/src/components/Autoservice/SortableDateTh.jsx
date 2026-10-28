import { autoserviceListThClass } from '../../utils/warehouseListUi';

export default function SortableDateTh({ label, column, sort, onSort, className = 'w-36' }) {
  const active = sort.by === column;
  return (
    <th
      className={`${className} ${autoserviceListThClass}`}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-ink-muted transition hover:text-ink"
      >
        {label}
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${
            active && sort.dir === 'asc' ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </th>
  );
}
