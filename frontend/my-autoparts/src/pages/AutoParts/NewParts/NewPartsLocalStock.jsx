import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCatalogItems, selectCatalogLoading, selectCatalogTotal } from '../../../redux/slices/ProductSlice';
import { normalizeImageUrl } from '../../../utils/apiClient';

const NewPartsLocalStock = ({ compact = false }) => {
  const navigate = useNavigate();
  const items = useSelector(selectCatalogItems);
  const catalogTotal = useSelector(selectCatalogTotal);
  const loading = useSelector(selectCatalogLoading);
  const orgName = useSelector((state) => state.publicInfo.adminOrganizationPhone?.organization_name);

  if (loading && !items?.length) {
    return (
      <div className="text-sm text-gray-500 py-4">Загрузка наличия со склада...</div>
    );
  }

  if (!catalogTotal || !items?.length) return null;

  const title = orgName ? `В наличии у нас (${orgName})` : 'В наличии на нашем складе';

  return (
    <section className={compact ? 'mb-6' : 'mb-8'}>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
        {items.map((part) => {
          const photo = part.photos?.[0];
          const imgUrl = photo
            ? normalizeImageUrl(photo.full_url || photo.photo_url)
            : null;
          const detailPath = `/part/${part.id}-${encodeURIComponent(part.brand || '')}-${encodeURIComponent(part.article || '')}`;

          return (
            <div
              key={part.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col"
            >
              <div
                className="aspect-[4/3] bg-gray-100 flex items-center justify-center cursor-pointer"
                onClick={() => navigate(detailPath)}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={part.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">Нет фото</span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <p className="text-xs text-gray-500">{part.brand}</p>
                <p className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{part.name || part.article}</p>
                <p className="text-base font-bold text-indigo-600 mt-2">
                  {part.price ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(detailPath)}
                  className="mt-2 w-full py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                >
                  Подробнее
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default NewPartsLocalStock;
