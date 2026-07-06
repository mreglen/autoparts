import React from 'react';
import { useSelector } from 'react-redux';
import { selectCatalogItems, selectCatalogLoading, selectCatalogTotal } from '../../../redux/slices/ProductSlice';
import ProductCard from '../ProductCard';

const NewPartsLocalStock = ({ compact = false }) => {
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
        {items.map((part) => (
          <ProductCard key={part.id} part={part} showFavorite />
        ))}
      </div>
    </section>
  );
};

export default NewPartsLocalStock;
