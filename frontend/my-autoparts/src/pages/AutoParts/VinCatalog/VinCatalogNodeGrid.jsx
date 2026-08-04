export default function VinCatalogNodeGrid({ nodes, onSelect }) {
  const list = Array.isArray(nodes) ? nodes : [];

  if (!list.length) {
    return <p className="py-10 text-center text-sm text-gray-400">Выберите раздел слева</p>;
  }

  const withImages = list.some((n) => n.imageUrl);

  return (
    <div
      className={
        withImages
          ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'
          : 'grid grid-cols-1 gap-2 sm:grid-cols-2'
      }
    >
      {list.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={() => onSelect(node)}
          className={`group flex overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-indigo-300 hover:shadow-sm ${
            withImages ? 'min-h-[10rem] flex-col' : 'items-center gap-3 px-4 py-3'
          }`}
        >
          {node.imageUrl ? (
            <>
              <div className="flex h-40 items-center justify-center bg-gray-50 p-3">
                <img
                  src={node.imageUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="px-3 py-3">
                <span className="text-sm font-medium leading-snug text-gray-900 group-hover:text-indigo-700">
                  {node.name}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-gray-900 group-hover:text-indigo-700">
                {node.name}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
