import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { normalizeImageUrl } from '../../utils/apiClient';
import MediaModal from '../../components/MediaModal/MediaModal';
import StockOutModal from '../MyParts/StockOutModal/StockOutModal';
import PrintReceiptModal from '../MyParts/PrintReceiptModal/PrintReceiptModal';
import StockInQuickModal from './StockInQuickModal';
import StorageCellsQuickEditModal from './StorageCellsQuickEditModal';
import { createStockOut } from '../../redux/slices/StockOutSlice';
import { updateProductQuantityAPI } from '../../redux/slices/ProductSlice';
import StorageCellsDisplayTable from '../../components/StorageCellsTable/StorageCellsDisplayTable';
import { INTERNAL_CODE_LABEL, formatInternalCodeDisplay } from '../../utils/internalCode';
import { buildSellerPartCardSeo, PageSeoHelmet } from '../../utils/pageSeo';
import { resolveProductQrScan } from '../../utils/resolveProductQrScan';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useWarehousePermissions } from '../../hooks/useWarehousePermissions';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

function ActionButton({ children, onClick, to, variant = 'default', disabled = false }) {
  const base = 'flex min-h-12 flex-1 items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-50';
  const variants = {
    default: 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    danger: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
  };
  const className = `${base} ${variants[variant] || variants.default}`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

const SellerPartCardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes || []);
  const perms = useWarehousePermissions(user, permissionCodes);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [redirectPath, setRedirectPath] = useState(null);
  const [part, setPart] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [operationType, setOperationType] = useState(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [stockInModalOpen, setStockInModalOpen] = useState(false);
  const [cellsModalOpen, setCellsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ quantity: '', price: '', reason: '' });

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  useEffect(() => {
    if (redirectPath) {
      navigate(redirectPath, { replace: true });
    }
  }, [redirectPath, navigate]);

  useEffect(() => {
    if (!isReady) return undefined;

    let cancelled = false;

    const resolveRoute = async () => {
      if (!id) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      setResolveError('');
      setRedirectPath(null);
      setPart(null);

      try {
        const result = await resolveProductQrScan(id, user, permissionCodes);

        if (cancelled) return;

        if (result.mode === 'seller') {
          setPart(result.part);
          setLoading(false);
          return;
        }

        if (result.mode === 'forbidden') {
          setForbidden(true);
          setLoading(false);
          return;
        }

        if (result.mode === 'auth_required') {
          navigate('/auth', { replace: true, state: { from: `/seller/part-card/${id}` } });
          return;
        }

        if (result.mode === 'public') {
          setRedirectPath(result.path);
          return;
        }

        if (result.mode === 'error') {
          setResolveError(result.message || 'Не удалось открыть карточку');
          setLoading(false);
          return;
        }

        setNotFound(true);
        setLoading(false);
      } catch (error) {
        if (!cancelled) {
          setResolveError(error?.message || 'Не удалось открыть карточку');
          setLoading(false);
        }
      }
    };

    resolveRoute();

    return () => {
      cancelled = true;
    };
  }, [id, isReady, navigate, user, permissionCodes]);

  const mediaItems = useMemo(() => {
    if (!part) return [];
    const photos = (part.photos || []).map((p) => ({ type: 'image', src: normalizeImageUrl(p.full_url || p.photo_url || '') }));
    const videos = (part.videos || []).map((v) => ({ type: 'video', src: normalizeImageUrl(v.full_url || v.video_url || '') }));
    return [...photos, ...videos].filter((x) => x.src);
  }, [part]);

  const handleOpenMedia = (idx = 0) => {
    setCurrentMediaItems(mediaItems);
    setCurrentMediaIndex(idx);
    setMediaModalOpen(true);
  };

  const handleOpenModal = (type) => {
    setOperationType(type);
    setModalOpen(true);
  };

  const handleConfirm = async () => {
    if (!part || !operationType || !user) return;
    const quantity = parseInt(formData.quantity, 10);
    if (!quantity || quantity <= 0 || quantity > part.quantity) return;

    const stockOutData = {
      product_id: part.id,
      quantity,
      storage_location_id: part.storage_location_id || null,
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

  if (!isReady || loading || redirectPath) {
    return <AuthLoadingScreen className="min-h-[50vh]" />;
  }

  if (resolveError) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Не удалось открыть</h1>
        <p className="mt-2 text-sm text-gray-600">{resolveError}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Повторить
          </button>
          <Link to="/my-parts" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            К запчастям
          </Link>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Нет доступа</h1>
        <p className="mt-2 text-gray-600">Эта запчасть принадлежит другой организации.</p>
        <Link to="/my-parts" className="mt-6 inline-block text-indigo-600 hover:underline">К моим запчастям</Link>
      </div>
    );
  }

  if (notFound || !part) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Не найдено</h1>
        <p className="mt-2 text-sm text-gray-600">Запчасть недоступна или удалена.</p>
        <Link to="/autoparts/used" className="mt-6 inline-block text-indigo-600 hover:underline">
          В каталог
        </Link>
      </div>
    );
  }

  const seo = buildSellerPartCardSeo(part);
  const previewMedia = mediaItems[0];

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <PageSeoHelmet seo={seo} />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="aspect-[4/3] bg-gray-100">
            {previewMedia ? (
              <button type="button" onClick={() => handleOpenMedia(0)} className="h-full w-full">
                {previewMedia.type === 'video' ? (
                  <video src={previewMedia.src} className="h-full w-full object-cover" controls />
                ) : (
                  <img src={previewMedia.src} alt="" className="h-full w-full object-cover" />
                )}
              </button>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">Нет фото</div>
            )}
          </div>

          <div className="space-y-3 p-4">
            <h1 className="text-xl font-bold leading-tight text-gray-900">{part.name || '—'}</h1>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700">{part.brand || '—'}</span>
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-gray-700">{part.article || '—'}</span>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                {part.quantity || 0} шт.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">Склад</div>
                <div className="text-sm font-medium text-gray-900">{part.storage_location_name || '—'}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">{INTERNAL_CODE_LABEL}</div>
                <div className="font-mono text-sm font-medium text-gray-900">{formatInternalCodeDisplay(part.internal_code)}</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-gray-500">Цена</div>
                <div className="text-base font-semibold text-gray-900">
                  {part.price != null ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                </div>
              </div>
            </div>

            {(part.product_storage_cells?.length > 0 || part.storage_addresses?.length > 0) && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Адресное хранение</div>
                {part.product_storage_cells?.length > 0 ? (
                  <StorageCellsDisplayTable productStorageCells={part.product_storage_cells} compact />
                ) : (
                  <div className="break-words text-sm text-gray-800">{part.storage_addresses.join('; ')}</div>
                )}
              </div>
            )}

            {mediaItems.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {mediaItems.map((m, idx) => (
                  <button
                    key={`${m.src}-${idx}`}
                    type="button"
                    onClick={() => handleOpenMedia(idx)}
                    className="aspect-square overflow-hidden rounded-lg border bg-gray-100"
                  >
                    {m.type === 'video' ? (
                      <video src={m.src} className="h-full w-full object-cover" muted />
                    ) : (
                      <img src={m.src} alt="" className="h-full w-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {perms.isStaff && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-2">
            {perms.canPrint && (
              <ActionButton onClick={() => setPrintModalOpen(true)}>Печать</ActionButton>
            )}
            {perms.canSell && (
              <ActionButton variant="primary" onClick={() => handleOpenModal('sale')}>Продать</ActionButton>
            )}
            {perms.canStockOut && (
              <ActionButton variant="danger" onClick={() => handleOpenModal('writeoff')}>Списать</ActionButton>
            )}
            {perms.canStockIn && (
              <ActionButton onClick={() => setStockInModalOpen(true)}>Приход</ActionButton>
            )}
            {perms.canEditCells && (
              <ActionButton onClick={() => setCellsModalOpen(true)}>Ячейки</ActionButton>
            )}
            {perms.canEditParts && (
              <ActionButton to={`/my-parts/edit/${part.id}`}>Изменить</ActionButton>
            )}
          </div>
        </div>
      )}

      <StockOutModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPart={part}
        operationType={operationType}
        formData={formData}
        onFormChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
        onConfirm={handleConfirm}
      />

      <StockInQuickModal
        isOpen={stockInModalOpen}
        onClose={() => setStockInModalOpen(false)}
        part={part}
        onSuccess={(newQuantity) => setPart((prev) => ({ ...prev, quantity: newQuantity }))}
      />

      <StorageCellsQuickEditModal
        isOpen={cellsModalOpen}
        onClose={() => setCellsModalOpen(false)}
        part={part}
        onSuccess={(cells) => setPart((prev) => ({
          ...prev,
          product_storage_cells: cells,
          storage_addresses: cells.map((c) => (
            c.storage_cell_name ? `${c.storage_cell_name}: ${c.value}` : c.value
          )),
        }))}
      />

      <PrintReceiptModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        selectedPart={part}
        productStorageCells={
          part.product_storage_cells?.length > 0
            ? part.product_storage_cells
            : (part.storage_addresses || []).map((value, idx) => ({ id: idx + 1, value }))
        }
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
