import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  printLabel,
  selectSendingPrint,
  clearError,
} from '../../../redux/slices/PrinterSlice';
import { apiAxios } from '../../../utils/apiClient';
import LabelStorageCellsPreview from '../../../components/LabelPrint/LabelStorageCellsPreview';
import { buildStorageCellsForLabel } from '../../../utils/labelPrintDisplay';
import { getLabelQrUrl } from '../../../utils/labelQrUrl';
import { formatInternalCodeDisplay } from '../../../utils/internalCode';

const MM_TO_PX = 96 / 25.4;
const PRINTER_POLL_MS = 4000;
const PRINTER_RETRY_ATTEMPTS = 5;
const PRINTER_RETRY_DELAY_MS = 1200;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildLabelPrintPayload(selectedPart, productStorageCells, cellCatalog = [], copies = 1) {
  const storageCells = buildStorageCellsForLabel(productStorageCells, cellCatalog).map((cell) => ({
    name_short: cell.nameShort,
    value: cell.value,
  }));

  const safeCopies = Math.max(1, parseInt(copies, 10) || 1);

  const base = {
    brand: selectedPart?.brand || '—',
    article: selectedPart?.article || '—',
    name: selectedPart?.name || '—',
    internal_code: formatInternalCodeDisplay(selectedPart?.internal_code),
    price: selectedPart?.price != null
      ? `${parseFloat(selectedPart.price).toFixed(0)} ₽`
      : '—',
    width_mm: 58,
    height_mm: 38,
    copies: safeCopies,
  };

  if (storageCells.length) {
    base.storage_cells = storageCells;
  }

  if (selectedPart?.moderationKind === 'pending') {
    return { ...base, source: 'pending', pending_product_id: selectedPart.id };
  }
  if (selectedPart?.moderationKind === 'rejected') {
    return { ...base, source: 'rejected', rejected_product_id: selectedPart.id };
  }
  return { ...base, source: 'product', product_id: selectedPart?.id };
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

function LabelPreview({ widthMm, heightMm, selectedPart, storageCellsForLabel }) {
  const frameRef = useRef(null);
  const frameSize = useElementSize(frameRef);

  const framePadding = 12;
  const designMm = useMemo(() => ({ w: 58, h: 38 }), []);

  const basePx = useMemo(() => {
    const w = 58 * MM_TO_PX;
    const h = 38 * MM_TO_PX;
    return { w, h };
  }, []);

  const contentScale = useMemo(() => {
    const w = Math.max(1, Number(widthMm) || 0);
    const h = Math.max(1, Number(heightMm) || 0);
    return clamp(Math.min(w / designMm.w, h / designMm.h), 0.05, 10);
  }, [widthMm, heightMm, designMm.h, designMm.w]);

  const scale = useMemo(() => {
    if (!frameSize.width || !frameSize.height) return 1;
    const availableW = Math.max(1, frameSize.width - framePadding * 2);
    const availableH = Math.max(1, frameSize.height - framePadding * 2);
    const k = Math.min(availableW / basePx.w, availableH / basePx.h);
    return clamp(k, 0.05, 10);
  }, [frameSize.width, frameSize.height, basePx.w, basePx.h]);

  const qrTargetUrl = useMemo(
    () => getLabelQrUrl(selectedPart),
    [selectedPart]
  );

  const [qrPreviewSrc, setQrPreviewSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadQr = async () => {
      if (!qrTargetUrl) {
        setQrPreviewSrc('');
        return;
      }
      try {
        const res = await apiAxios.get('/printers/qr-preview', { params: { url: qrTargetUrl } });
        if (!cancelled) {
          setQrPreviewSrc(res.data?.data_uri || '');
        }
      } catch (e) {
        if (!cancelled) {
          setQrPreviewSrc('');
        }
      }
    };
    loadQr();
    return () => {
      cancelled = true;
    };
  }, [qrTargetUrl]);

  const internalCodeLabel = formatInternalCodeDisplay(selectedPart?.internal_code);

  return (
    <div
      ref={frameRef}
      className="w-full h-[180px] flex justify-center items-center bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl"
    >
      <div
        className="bg-white border border-gray-300 box-border shadow-sm"
        style={{
          width: `${designMm.w * MM_TO_PX}px`,
          height: basePx.h,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${designMm.w * MM_TO_PX}px`,
            height: `${designMm.h * MM_TO_PX}px`,
            transform: `scale(${contentScale})`,
            transformOrigin: 'center center',
            padding: 8,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex flex-col justify-between h-full gap-1">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 text-black">
                <div className="mb-1">
                  <div className="text-[8px] font-bold leading-tight">Бренд</div>
                  <div className="text-[11px] font-semibold leading-tight break-words">{selectedPart?.brand || '—'}</div>
                </div>
                <div className="mb-1">
                  <div className="text-[8px] font-bold leading-tight">Артикул</div>
                  <div className="text-[11px] font-semibold leading-tight break-words">{selectedPart?.article || '—'}</div>
                </div>
                <div>
                  <div className="text-[8px] font-bold leading-tight">Наименование</div>
                  <div className="text-[9px] font-semibold leading-tight break-words">{selectedPart?.name || '—'}</div>
                </div>
              </div>

              <div className="shrink-0 w-[52px] flex flex-col items-center">
                <div className="w-[48px] h-[48px] border border-black overflow-hidden bg-white">
                  {qrPreviewSrc ? (
                    <img
                      src={qrPreviewSrc}
                      alt="QR code preview"
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="mt-1 text-[8px] leading-tight text-black text-center whitespace-nowrap">
                  Цена: {selectedPart?.price != null ? `${parseFloat(selectedPart.price).toFixed(0)} ₽` : '—'}
                </div>
                <div className="mt-0.5 text-[7px] leading-tight text-black text-center whitespace-nowrap">
                  Код: {internalCodeLabel}
                </div>
              </div>
            </div>

            {storageCellsForLabel.length > 0 && (
              <div className="w-full">
                <div className="text-[8px] font-bold leading-tight text-black mb-0.5">Адресное хранение</div>
                <LabelStorageCellsPreview
                  cells={storageCellsForLabel}
                  widthMm={widthMm}
                  fullWidth
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function pickDefaultPrinterId(printers, currentSelection) {
  if (!printers?.length) return '';

  const stillValid = printers.find((p) => String(p.id) === String(currentSelection));
  if (stillValid?.is_online) {
    return String(stillValid.id);
  }

  const currentOnline = printers.find((p) => p.is_current && p.is_online);
  if (currentOnline) return String(currentOnline.id);

  const defaultOnline = printers.find((p) => p.is_default && p.is_online);
  if (defaultOnline) return String(defaultOnline.id);

  const anyOnline = printers.find((p) => p.is_online);
  if (anyOnline) return String(anyOnline.id);

  if (stillValid) return String(stillValid.id);

  const current = printers.find((p) => p.is_current);
  if (current) return String(current.id);

  return String(printers[0].id);
}

const PrintReceiptModal = ({
  isOpen,
  onClose,
  selectedPart,
  productStorageCells = []
}) => {
  const dispatch = useDispatch();
  const printing = useSelector(selectSendingPrint);
  const storageCellCatalog = useSelector((state) => state.storageCells.storageCells);

  const storageCellsForLabel = useMemo(
    () => buildStorageCellsForLabel(productStorageCells, storageCellCatalog),
    [productStorageCells, storageCellCatalog]
  );

  const [printers, setPrinters] = useState([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [printCopiesInput, setPrintCopiesInput] = useState('1');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const parsedPrintCopies = useMemo(() => {
    if (printCopiesInput === '') return null;
    const next = parseInt(printCopiesInput, 10);
    if (!Number.isFinite(next) || next < 1) return null;
    return Math.min(next, 9999);
  }, [printCopiesInput]);

  const selectedPrinter = useMemo(
    () => printers.find((p) => String(p.id) === String(selectedPrinterId)),
    [printers, selectedPrinterId]
  );

  const labelWidthMm = Number(selectedPrinter?.label_width_mm || 58);
  const labelHeightMm = Number(selectedPrinter?.label_height_mm || 38);
  const partQuantity = Math.max(0, Number(selectedPart?.quantity) || 0);

  const fetchPrintersList = useCallback(async () => {
    let list = [];
    for (let attempt = 0; attempt < PRINTER_RETRY_ATTEMPTS; attempt += 1) {
      const res = await apiAxios.get('/printers/me/label-print');
      list = res.data || [];
      if (list.some((p) => p.is_online) || attempt === PRINTER_RETRY_ATTEMPTS - 1) {
        break;
      }
      await sleep(PRINTER_RETRY_DELAY_MS);
    }
    return list;
  }, []);

  const loadPrinters = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const list = await fetchPrintersList();
      setPrinters(list);

      let nextId = '';
      setSelectedPrinterId((prev) => {
        nextId = pickDefaultPrinterId(list, prev);
        return nextId;
      });

      const toGrant = list.find(
        (p) => String(p.id) === nextId && p.is_online && !p.is_current
      ) || list.find((p) => p.is_online && !p.is_current);
      if (toGrant) {
        try {
          await apiAxios.post(`/printers/id/${toGrant.id}/grant`);
          const refreshed = await apiAxios.get('/printers/me/label-print');
          const refreshedList = refreshed.data || [];
          setPrinters(refreshedList);
          setSelectedPrinterId((prev) => pickDefaultPrinterId(refreshedList, prev));
        } catch {
          /* grant optional */
        }
      }
    } catch (e) {
      if (!silent) {
        setPrinters([]);
        setSelectedPrinterId('');
      }
      setLoadError(e?.response?.data?.detail || 'Ошибка загрузки принтеров');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [fetchPrintersList]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPrinterId('');
      setPrinters([]);
      setLoadError(null);
      setPrintCopiesInput('1');
      return undefined;
    }

    const defaultCopies = Math.max(1, Number(selectedPart?.quantity) || 1);
    setPrintCopiesInput(String(defaultCopies));
    loadPrinters({ silent: false });

    const pollId = setInterval(() => {
      loadPrinters({ silent: true });
    }, PRINTER_POLL_MS);

    return () => {
      clearInterval(pollId);
      dispatch(clearError());
    };
  }, [isOpen, loadPrinters, dispatch, selectedPart?.id, selectedPart?.quantity]);

  const handleSelectPrinter = async (printerId) => {
    setSelectedPrinterId(printerId);
    if (!printerId) return;
    const picked = printers.find((p) => String(p.id) === String(printerId));
    if (!picked?.is_online) return;
    try {
      await apiAxios.post(`/printers/id/${printerId}/grant`);
      const res = await apiAxios.get('/printers/me/label-print');
      const list = res.data || [];
      setPrinters(list);
    } catch (e) {
      setLoadError(e?.response?.data?.detail || 'Не удалось назначить принтер');
    }
  };

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!selectedPrinterId) {
      alert('Выберите принтер');
      return;
    }
    if (!selectedPrinter?.is_online) {
      alert('Агент печати не подключён. Запустите агент на компьютере с принтером и нажмите «Обновить».');
      return;
    }
    if (!parsedPrintCopies) {
      alert('Укажите количество этикеток — целое число больше 0');
      return;
    }

    const productData = buildLabelPrintPayload(
      selectedPart,
      productStorageCells,
      storageCellCatalog,
      parsedPrintCopies,
    );
    productData.width_mm = labelWidthMm;
    productData.height_mm = labelHeightMm;

    try {
      await dispatch(printLabel({
        printerId: selectedPrinterId,
        productData
      })).unwrap();
      onClose();
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || 'Ошибка печати');
      setLoadError(msg);
      loadPrinters({ silent: true });
    }
  };

  const canPrint = Boolean(
    selectedPrinterId && selectedPrinter?.is_online && !printing && parsedPrintCopies,
  );

  const handleCopiesChange = (event) => {
    const next = event.target.value;
    if (next === '') {
      setPrintCopiesInput('');
      return;
    }
    if (!/^\d+$/.test(next)) return;
    if (next.startsWith('0')) return;
    const value = parseInt(next, 10);
    if (value > 9999) return;
    setPrintCopiesInput(next);
  };

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-gray-100 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-600 transition-colors z-20 rounded-full p-1 hover:bg-gray-100"
          aria-label="Закрыть"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-4 sm:p-5 pt-3">
          <div className="space-y-3 flex flex-col justify-start">
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/70">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Принтер
              </label>
              {loading ? (
                <div className="text-sm text-gray-500">Загрузка списка принтеров...</div>
              ) : loadError ? (
                <div className="text-sm text-red-600">
                  {typeof loadError === 'string' ? loadError : 'Ошибка загрузки'}
                  <button
                    type="button"
                    onClick={() => loadPrinters({ silent: false })}
                    className="ml-2 text-indigo-600 underline hover:text-indigo-800"
                  >
                    Обновить
                  </button>
                </div>
              ) : printers.length === 0 ? (
                <div className="text-sm text-orange-600 space-y-2">
                  <p>
                    Принтеры не настроены. Запустите агент печати на компьютере с принтером и выберите принтер в настройках.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => loadPrinters({ silent: false })}
                      className="text-indigo-600 underline hover:text-indigo-800"
                    >
                      Обновить
                    </button>
                    <Link
                      to="/settings/printers"
                      onClick={onClose}
                      className="text-indigo-600 underline hover:text-indigo-800"
                    >
                      Перейти в настройки печати
                    </Link>
                  </div>
                </div>
              ) : (
                <select
                  value={selectedPrinterId}
                  onChange={(e) => handleSelectPrinter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите принтер</option>
                  {printers.map((printer) => (
                    <option
                      key={printer.id}
                      value={printer.id}
                      disabled={!printer.is_online}
                    >
                      {printer.name}
                      {printer.is_default ? ' (По умолчанию)' : ''}
                      {printer.is_current ? ' · текущий' : ''}
                      {!printer.is_online ? ' · офлайн' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/70">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Количество этикеток
                <span className="font-normal text-gray-500">
                  {' '}
                  · остаток {partQuantity.toLocaleString('ru-RU')} шт.
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={printCopiesInput}
                onChange={handleCopiesChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="p-2 rounded-xl bg-white border border-gray-200">
              <div className="flex justify-center items-center w-full">
                <LabelPreview
                  widthMm={labelWidthMm}
                  heightMm={labelHeightMm}
                  selectedPart={selectedPart}
                  storageCellsForLabel={storageCellsForLabel}
                />
              </div>
            </div>

            <button
                type="button"
                onClick={handlePrint}
                disabled={!canPrint}
                className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-colors ${!canPrint
                  ? 'bg-indigo-400 text-white cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
              >
                {printing
                  ? 'Отправка...'
                  : parsedPrintCopies
                    ? `Распечатать (${parsedPrintCopies} шт.)`
                    : 'Распечатать'}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReceiptModal;
