function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function DataTable({ columns = [], rows = [], empty, footer, className = '' }) {
  if (!rows.length) {
    return empty || null;
  }

  return (
    <div className={cx('overflow-x-auto rounded-sg-lg border border-line bg-surface', className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.key || col.label} className="px-4 py-3 font-semibold">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, index) => (
            <tr key={row.id ?? index} className="hover:bg-surface-muted/60">
              {columns.map((col) => (
                <td key={col.key || col.label} className="px-4 py-3 text-ink-soft">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot className="border-t border-line bg-surface-muted/60">
            <tr>
              {columns.map((col) => (
                <td key={col.key || col.label} className="px-4 py-3 font-semibold text-ink">
                  {col.render ? col.render(footer) : footer[col.key]}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function ResponsiveList({
  items = [],
  renderItem,
  renderDesktop,
  empty,
  className = '',
}) {
  if (!items.length) return empty || null;

  return (
    <div className={className}>
      <div className="hidden md:block">
        {renderDesktop ? renderDesktop(items) : (
          <div className="space-y-2">
            {items.map((item, index) => renderItem(item, index))}
          </div>
        )}
      </div>
      <div className="space-y-2 md:hidden">
        {items.map((item, index) => renderItem(item, index))}
      </div>
    </div>
  );
}

export default DataTable;
