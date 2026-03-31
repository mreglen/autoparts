import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios, normalizeImageUrl } from '../../utils/apiClient';
import MediaModal from '../../components/MediaModal/MediaModal';
import StockOutModal from '../MyParts/StockOutModal/StockOutModal';
import PrintReceiptModal from '../MyParts/PrintReceiptModal/PrintReceiptModal';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { updateProductQuantityAPI } from '../../redux/slices/ProductSlice';

const SellerPartCardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [part, setPart] = useState(null);
  const [showActions, setShowActions] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [formData, setFormData] = useState({ quantity: '', price: '', reason: '' });

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    const fetchCard = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const response = await apiAxios.get(`/products/qr-card/${id}`);
        setPart(response.data);
      } catch (error) {
        // For non-seller/unauthorized users open public product card instead of local 404.
        navigate(`/part/${id}`, { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [id, navigate]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.actions-dropdown')) {
        setShowActions(false);
      }
    };
    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions]);

  const mediaItems = useMemo(() => {
    if (!part) return [];
    const photos = (part.photos || []).map((p) => ({ type: 'image', src: normalizeImageUrl(p.full_url || p.photo_url || '') }));
    const videos = (part.videos || []).map((v) => ({ type: 'video', src: normalizeImageUrl(v.full_url || v.video_url || '') }));
    return [...photos, ...videos].filter((x) => x.src);
  }, [part]);

  const isSellerFromProductOrganization = useMemo(() => {
    if (!part) return false;
    if (!user?.is_seller) return false;

    const userOrgId = user?.organization_id;
    const partOrgId = part?.organization_id ?? part?.organization?.id ?? null;

    // /products/qr-card is already protected on backend by organization check.
    // If org id is not present in payload, trust successful access response.
    if (partOrgId == null) return true;
    if (userOrgId == null) return false;
    return String(userOrgId) === String(partOrgId);
  }, [part, user]);

  useEffect(() => {
    if (loading || !part) return;
    if (!isSellerFromProductOrganization) {
      navigate(`/part/${part.id || id}`, { replace: true });
    }
  }, [loading, part, isSellerFromProductOrganization, navigate, id]);

  const handleOpenMedia = (idx = 0) => {
    setCurrentMediaItems(mediaItems);
    setCurrentMediaIndex(idx);
    setMediaModalOpen(true);
  };

  const handleOpenModal = (type) => {
    setOperationType(type);
    setModalOpen(true);
    setShowActions(false);
  };

  const handleConfirm = async () => {
    if (!part || !operationType || !user) return;
    const quantity = parseInt(formData.quantity, 10);
    if (!quantity || quantity <= 0 || quantity > part.quantity) return;

    const stockOutData = {
      product_id: part.id,
      quantity,
      storage_location_id: null,
      organization_id: user.organization_id,
      user_id: user.id,
      acquired_product_id: null,
      movement_date: new Date().toISOString().split('T')[0],
      sale_price: 0,
      reason: null,
    };

    if (operationType === 'sale') {
      const price = parseFloat(formData.price);
      if (!price || price <= 0) return;
      stockOutData.sale_price = price;
    } else {
      stockOutData.reason = formData.reason || 'Списание';
    }

    await dispatch(createStockOut(stockOutData)).unwrap();
    const newQuantity = Math.max(0, (part.quantity || 0) - quantity);
    await dispatch(updateProductQuantityAPI({ productId: part.id, newQuantity })).unwrap();
    setPart((prev) => ({ ...prev, quantity: newQuantity }));
    setModalOpen(false);
    setFormData({ quantity: '', price: '', reason: '' });
    setOperationType(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-600">Загрузка...</div>;
  }
  if (notFound || !part) {
    return <div className="p-8 text-center text-gray-700 text-lg">404: Страница не найдена</div>;
  }
  if (!isSellerFromProductOrganization) {
    return null;
  }

  const previewMedia = mediaItems[0];

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 space-y-5">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight break-words">
                {part.name || '—'}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                  Бренд: {part.brand || '—'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
                  Артикул: {part.article || '—'}
                </span>
                <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">
                  В наличии: {part.quantity || 0} шт.
                </span>
              </div>
            </div>
            <div className="relative actions-dropdown shrink-0">
              <button
                onClick={() => setShowActions((v) => !v)}
                className="text-gray-700 hover:text-gray-900 text-sm sm:text-sm font-semibold border border-gray-300 rounded-lg px-4 py-3 sm:px-3 sm:py-2 bg-white hover:bg-gray-50 transition-colors min-h-[48px] sm:min-h-0"
              >
                Действия
              </button>
              {showActions && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  <button onClick={() => { setPrintModalOpen(true); setShowActions(false); }} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Печать</button>
                  <button onClick={() => handleOpenModal('sale')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Продать</button>
                  <button onClick={() => handleOpenModal('writeoff')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Списать</button>
                  <Link to={`/my-parts/edit/${part.id}`} className="block w-full px-3 py-2 text-sm hover:bg-gray-50">Редактировать</Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            <div className="lg:col-span-2 p-5 border-r border-gray-100">
              <div className="aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-4">
                {previewMedia ? (
                  previewMedia.type === 'video' ? (
                    <video src={previewMedia.src} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={previewMedia.src} alt="main media" className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    Нет фото и видео
                  </div>
                )}
              </div>

              {mediaItems.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {mediaItems.map((m, idx) => (
                    <button key={`${m.src}-${idx}`} onClick={() => handleOpenMedia(idx)} className="aspect-square border rounded-lg overflow-hidden bg-gray-100 hover:border-indigo-400 transition-colors">
                      {m.type === 'video' ? (
                        <video src={m.src} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={m.src} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Склад</div>
                <div className="text-sm font-medium text-gray-900">{part.storage_location_name || '—'}</div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Внутренний код</div>
                <div className="text-sm font-medium text-gray-900">{part.internal_code || '—'}</div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Цена</div>
                <div className="text-base font-semibold text-gray-900">
                  {part.price != null ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                </div>
              </div>

              {part.storage_addresses?.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Адресное хранение</div>
                  <div className="text-sm text-gray-800 break-words">{part.storage_addresses.join('; ')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <StockOutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPart={part}
        operationType={operationType}
        formData={formData}
        onFormChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
        onConfirm={handleConfirm}
      />

      <PrintReceiptModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        selectedPart={part}
        productStorageCells={(part.storage_addresses || []).map((value, idx) => ({ id: idx + 1, value }))}
      />

      <MediaModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaItems={currentMediaItems}
        initialIndex={currentMediaIndex}
      />
    </div>
  );
};

export default SellerPartCardPage;
