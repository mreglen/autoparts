export default function VinCatalogTree({
  nodes,
  openIds,
  selectedId,
  hasFulltext,
  hasQuickgroups,
  mode,
  searchQuery,
  searchLoading,
  onToggle,
  onSelect,
  onSearchQueryChange,
  onRunSearch,
  onClearSearch,
  onSwitchMode,
}) {
  const renderNode = (node, depth = 0) => {
    const isOpen = openIds.has(node.id);
    const isSelected = selectedId === node.id;
    const kids = node.children || [];
    const canExpand = node.hasChildren || kids.length > 0;

    return (
      <li key={node.id}>
        <div
          className={`flex items-center gap-0.5 rounded-md ${
            isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800 hover:bg-gray-50'
          }`}
          style={{ paddingLeft: `${6 + depth * 12}px` }}
        >
          {canExpand ? (
            <button
              type="button"
              aria-label={isOpen ? 'Свернуть' : 'Развернуть'}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
                if (!isOpen && (!kids.length || node.kind === 'category')) {
                  onSelect(node);
                }
              }}
              className="flex h-7 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : (
            <span className="inline-block w-6 shrink-0" />
          )}
          <button
            type="button"
            onClick={() => onSelect(node)}
            className="min-w-0 flex-1 truncate py-1.5 pr-2 text-left text-sm"
          >
            {node.name}
          </button>
        </div>
        {isOpen && kids.length > 0 ? (
          <ul className="space-y-0.5">{kids.map((c) => renderNode(c, depth + 1))}</ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex max-h-[70vh] flex-col lg:max-h-[calc(100vh-10rem)]">
      {hasFulltext ? (
        <div className="border-b border-gray-100 p-3">
          <div className="flex gap-2">
            <input
              type="search"
              value={searchQuery || ''}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRunSearch();
              }}
              placeholder="Поиск детали"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              disabled={searchLoading}
              onClick={onRunSearch}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Найти
            </button>
          </div>
          {mode === 'search' ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              ← К каталогу
            </button>
          ) : null}
        </div>
      ) : null}

      {hasQuickgroups ? (
        <div className="flex gap-1 border-b border-gray-100 px-3 py-2">
          <button
            type="button"
            onClick={() => onSwitchMode('quick')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'quick'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Частые группы
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('oem')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              mode === 'oem'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Полный каталог
          </button>
        </div>
      ) : null}

      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {(nodes || []).map((n) => renderNode(n))}
      </ul>
    </div>
  );
}
