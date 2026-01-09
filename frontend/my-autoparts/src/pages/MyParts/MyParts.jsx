import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery';
import ImageModal from '../../components/ImageModal/ImageModal';
import { fetchProducts, updateProductQuantity } from '../../redux/slices/ProductSlice';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import StockOutModal from './StockOutModal/StockOutModal';

const CardPart = ({ part, getStorageAddress, onSale, onWriteoff, onToggleExpand, isExpanded, onImageClick }) => (
  <React.Fragment>
    <tr
      className="cursor-pointer hover:bg-gray-50"
      onClick={onToggleExpand}
    >
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{part.brand || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{part.article || '—'}</td>
      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{part.internal_code || '—'}</td>
      <td className="px-2 sm:px-6 py-4 text-sm text-gray-500 max-w-0 truncate sm:max-w-none sm:whitespace-normal">{part.name || '—'}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${part.is_new ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {part.is_new ? 'Новый' : 'Б/у'}
        </span>
      </td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">{part.quantity || 0}</td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {part.price != null ? `${part.price.toFixed(2)} ₽` : '—'}
      </td>
      <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <div className="flex flex-col sm:flex-row gap-1">
          <button onClick={(e) => { e.stopPropagation(); onSale(part); }} className="text-indigo-600 hover:text-indigo-900 text-xs sm:text-sm">
            Продать
          </button>
          <button onClick={(e) => { e.stopPropagation(); onWriteoff(part); }} className="text-red-600 hover:text-red-900 text-xs sm:text-sm">
            Списать
          </button>
          <Link to={`/my-parts/edit/${part.id}`} onClick={(e) => e.stopPropagation()} className="text-green-600 hover:text-green-900 text-xs sm:text-sm">
            Редактировать
          </Link>
        </div>
      </td>
    </tr>

    {/* Раскрывающаяся карточка */}
    {isExpanded && (
      <tr className="bg-gray-50">
        <td colSpan="8" className="px-6 py-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Фото */}
            <div>
              <PhotoGallery photos={part.photos || []} onImageClick={onImageClick} />
            </div>

            {/* Описание и авто */}
            <div className="space-y-4">

              {/* Описание */}
              <div>
                <span className="text-xs text-gray-500">Описание</span>
                <div className="font-medium mt-1">
                  {part.description || '—'}
                </div>
              </div>

              {/* Дополнительная информация */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Склад</span>
                  <div className="font-medium mt-1">
                    {part.storage_location_id ? getStorageAddress(part.storage_location_id) : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Ответственный</span>
                  <div className="font-medium mt-1">
                    {part.creator_name || '—'}
                  </div>
                </div>
              </div>

              {/* Автомобиль(и) */}
              {part.compatible_vehicles && part.compatible_vehicles.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500">Автомобиль</span>
                  <div className="mt-2 space-y-3">
                    {part.compatible_vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-white rounded border"
                      >
                        <div>
                          <span className="text-xs text-gray-500">Марка</span>
                          <div className="font-medium">{vehicle.brand}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Модель</span>
                          <div className="font-medium">{vehicle.model}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Поколение</span>
                          <div className="font-medium">{vehicle.generation || '—'}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Двигатель</span>
                          <div className="font-medium">{vehicle.engine || '—'}</div>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">КПП</span>
                          <div className="font-medium">{vehicle.transmission || '—'}</div>
                        </div>
                        {vehicle.vin && (
                          <div>
                            <span className="text-xs text-gray-500">VIN</span>
                            <div className="font-medium">{vehicle.vin}</div>
                          </div>
                        )}
                        {vehicle.mileage && (
                          <div>
                            <span className="text-xs text-gray-500">Пробег</span>
                            <div className="font-medium">{vehicle.mileage.toLocaleString()} км</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    )}
  </React.Fragment>
);

function MyParts() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const { items: products, loading, error } = useSelector((state) => state.products);

  const { storageLocations } = useSelector((state) => state.organization);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [operationType, setOperationType] = useState(null);
  const [expandedPartId, setExpandedPartId] = useState(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });
  const [formData, setFormData] = useState({
    quantity: '',
    price: '',
    reason: '',
  });

  const handleImageClick = (imageUrl, alt) => {
    setSelectedImage({ url: imageUrl, alt });
    setImageModalOpen(true);
  };

  const handleOpenModal = (part, type) => {
    setSelectedPart(part);
    setOperationType(type);
    setModalOpen(true);
  };

  const toggleExpand = (id) => {
    setExpandedPartId(expandedPartId === id ? null : id);
  };

  const handleConfirm = async () => {
    if (!selectedPart || !operationType) return;

    const quantity = parseInt(formData.quantity, 10);
    if (!quantity || quantity <= 0 || quantity > selectedPart.quantity) {
    
      return;
    }

    const stockOutData = {
      product_id: selectedPart.id,
      quantity: quantity,
      storage_location_id: selectedPart.storage_location_id,
      organization_id: user.organization_id,
      user_id: user.id,
      acquired_product_id: null,
      movement_date: new Date().toISOString().split('T')[0],
      sale_price: 0,
      reason: null,
    };

    if (operationType === 'sale') {
      const price = parseFloat(formData.price);
      if (!price || price <= 0) {
      
        return;
      }
      stockOutData.sale_price = price;
    } else {
      stockOutData.reason = formData.reason || 'Списание';
    }

    try {
      await dispatch(createStockOut(stockOutData)).unwrap();

      const newQuantity = selectedPart.quantity - quantity;
      dispatch(updateProductQuantity({ productId: selectedPart.id, newQuantity }));



      setModalOpen(false);
    } catch (err) {
      alert('Не удалось создать запись расхода: ' + (err.message || 'ошибка'));
    }
  };


  useEffect(() => {
    if (!modalOpen) {
      setSelectedPart(null);
      setOperationType(null);
      setFormData({ quantity: '', price: '', reason: '' });
    }
  }, [modalOpen])


  useEffect(() => {
    dispatch(fetchProducts());
    if (user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user?.organization_id]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.is_seller) return <Navigate to="/" replace />;



  const displayParts = products;

  const getStorageAddress = (locationId) => {
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };



  return (
    <div className="mt-5">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Мои запчасти</h1>

      <button
        onClick={() => navigate('/my-parts/add')}
        className="mb-6 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
      >
        Добавить запчасть
      </button>

      <div className="font-medium text-base mb-4">
        <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
      </div>

      {loading ? (
        <div className="mt-8 text-center py-6 text-gray-600">Загрузка запчастей...</div>
      ) : error ? (
        <div className="mt-8 text-center py-6 text-red-600">Ошибка: {error}</div>
      ) : displayParts.length === 0 ? (
        <div className="mt-12 text-center text-gray-500">
          У вас пока нет добавленных запчастей.
        </div>
      ) : (
        <div className="w-full">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бренд</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Номер</th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Внутр. код</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наименование</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Состояние</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Остаток</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цена, ₽</th>
                <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayParts.map((part) => (
                <CardPart
                  key={part.id}
                  part={part}
                  getStorageAddress={getStorageAddress}
                  onSale={(p) => handleOpenModal(p, 'sale')}
                  onWriteoff={(p) => handleOpenModal(p, 'writeoff')}
                  onToggleExpand={() => toggleExpand(part.id)}
                  isExpanded={expandedPartId === part.id}
                  onImageClick={handleImageClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StockOutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPart={selectedPart}
        operationType={operationType}
        formData={formData}
        onFormChange={(field, value) =>
          setFormData(prev => ({ ...prev, [field]: value }))
        }
        onConfirm={handleConfirm}
      />

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageUrl={selectedImage.url}
        alt={selectedImage.alt}
      />
    </div>
  );
}

export default MyParts;