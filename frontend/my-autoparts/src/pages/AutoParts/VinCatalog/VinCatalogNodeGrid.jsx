export default function VinCatalogNodeGrid({ nodes, onSelect }) {
  const list = Array.isArray(nodes) ? nodes : [];

  if (!list.length) {
    return <p className="text-sm text-gray-500">Выберите раздел слева</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onSelect(node)}
          className="group flex min-h-[7.5rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white text-left transition hover:border-indigo-300 hover:shadow-md"
        >
          {node.imageUrl ? (
            <div className="flex h-28 items-center justify-center bg-white p-2">
              <img
                src={node.imageUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-16 items-end px-4 pb-1">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          )}
          <div className="flex flex-1 items-start px-4 pb-4 pt-2">
            <span className="text-sm font-semibold leading-snug text-gray-900 group-hover:text-indigo-800">
              {node.name}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
