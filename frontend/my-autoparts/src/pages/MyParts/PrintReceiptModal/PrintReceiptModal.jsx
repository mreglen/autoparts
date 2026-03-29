import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchAvailablePrinters,
  printLabel,
  selectAvailablePrinters,
  selectFetchingPrinters,
  selectSendingPrint,
  selectPrintersError,
  clearError
} from '../../../redux/slices/PrinterSlice';

const MM_TO_PX = 96 / 25.4;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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
  }, []);

  return size;
}

function LabelPreview({ widthMm, heightMm, selectedPart, productStorageCells }) {
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

  const cellsText = useMemo(() => {
    if (!productStorageCells || productStorageCells.length === 0) return '';
    return productStorageCells
      .map(cell => cell.value || cell.id || '')
      .filter(value => value)
      .join(';');
  }, [productStorageCells]);

  return (
    <div
      ref={frameRef}
      className="w-full flex justify-center"
    >
      <div
        className="bg-white border border-gray-300 box-border w-full"
        style={{
          width: `${designMm.w * MM_TO_PX}px`,
          height: basePx.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${designMm.w * MM_TO_PX}px`,
            height: `${designMm.h * MM_TO_PX}px`,
            transform: `scale(${contentScale})`,
            transformOrigin: 'top left',
            padding: 8,
            boxSizing: 'border-box'
          }}
        >
          <div className="flex items-start h-full">
            <div className="flex-1 min-w-0 text-black space-y-1.5">
              <div>
                <div className="text-[8px] font-bold leading-tight">Бренд</div>
                <div className="text-[11px] leading-tight break-words">{selectedPart?.brand || '—'}</div>
              </div>
              <div>
                <div className="text-[8px] font-bold leading-tight">Артикул</div>
                <div className="text-[11px] leading-tight break-words">{selectedPart?.article || '—'}</div>
              </div>
              <div>
                <div className="text-[8px] font-bold leading-tight">Адресное хранение</div>
                <div className="text-[9px] leading-tight break-words">{cellsText || '—'}</div>
              </div>
              <div>
                <div className="text-[8px] font-bold leading-tight">Наименование</div>
                <div className="text-[9px] leading-tight break-words">{selectedPart?.name || '—'}</div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-1">
              <div className="w-[56px] h-[56px] bg-black" aria-label="QR placeholder" />
              <div className="text-[9px] leading-tight text-black text-center whitespace-nowrap">
                Цена: {selectedPart?.price != null ? `${parseFloat(selectedPart.price).toFixed(0)} ₽` : '—'}
              </div>
              <div className="text-[8px] leading-tight text-black text-center whitespace-nowrap">
                Код: {selectedPart?.internal_code
                  ? (typeof selectedPart.internal_code === 'object'
                    ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '—')
                    : selectedPart.internal_code)
                  : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PrintReceiptModal = ({
  isOpen,
  onClose,
  selectedPart,
  productStorageCells = []
}) => {
  const dispatch = useDispatch();
  const printers = useSelector(selectAvailablePrinters);
  const loading = useSelector(selectFetchingPrinters);
  const error = useSelector(selectPrintersError);
  const printing = useSelector(selectSendingPrint);

  const [printerSettings, setPrinterSettings] = useState({
    printer: ''
  });

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAvailablePrinters());
    }
    return () => {
      dispatch(clearError());
    };
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (printers && printers.length > 0 && !printerSettings.printer) {
      const defaultPrinter = printers.find(p => p.is_default);
      if (defaultPrinter) {
        setPrinterSettings(prev => ({ ...prev, printer: defaultPrinter.id }));
      } else if (printers.length === 1) {
        setPrinterSettings(prev => ({ ...prev, printer: printers[0].id }));
      }
    }
  }, [printers, printerSettings.printer]);

  if (!isOpen) return null;

  const handleSettingChange = (field, value) => {
    setPrinterSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = async () => {
    if (!printerSettings.printer) {
      alert('Выберите принтер');
      return;
    }

    const productData = {
      brand: selectedPart?.brand || '—',
      article: selectedPart?.article || '—',
      storage_address: productStorageCells && productStorageCells.length > 0
        ? productStorageCells
          .map(cell => cell.value || cell.id || '')
          .filter(value => value)
          .join(';')
        : '—',
      name: selectedPart?.name || '—',
      internal_code: selectedPart?.internal_code
        ? (typeof selectedPart.internal_code === 'object'
          ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '—')
          : selectedPart.internal_code)
        : '—',
      price: selectedPart?.price != null
        ? `${parseFloat(selectedPart.price).toFixed(0)} ₽`
        : '—',
      width_mm: 58,
      height_mm: 38,
      copies: 1
    };

    const result = await dispatch(printLabel({
      printerId: printerSettings.printer,
      productData
    })).unwrap();

    if (result) {
      alert(`Задача печати отправлена!\nID задачи: ${result.job_id}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 relative">
          {/* Кнопка закрытия */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
            aria-label="Закрыть"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            Печать этикетки
          </h2>

          <div className="space-y-6 flex flex-col justify-start">
            {/* Выбор принтера */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Принтер
              </label>
              {loading ? (
                <div className="text-sm text-gray-500">Загрузка...</div>
              ) : error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : printers.length === 0 ? (
                <div className="text-sm text-orange-600">
                  Принтеры не найдены. Выберите принтер в разделе "Печать" или убедитесь, что агент запущен.
                  <button
                    onClick={() => dispatch(fetchAvailablePrinters())}
                    className="ml-2 text-indigo-600 underline hover:text-indigo-800"
                  >
                    Обновить
                  </button>
                </div>
              ) : (
                <select
                  value={printerSettings.printer}
                  onChange={(e) => handleSettingChange('printer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите принтер</option>
                  {printers.map((printer) => (
                    <option key={printer.id} value={printer.id}>
                      {printer.name} {printer.is_default ? '(По умолчанию)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Предпросмотр */}


            <div className='flex justify-center items-center w-full '>
            
              <LabelPreview
                widthMm="58"
                heightMm="38"
                selectedPart={selectedPart}
                productStorageCells={productStorageCells}
              />
            </div>


            {/* Кнопка печати */}
            <div className="pt-2">
              <button
                onClick={handlePrint}
                disabled={!printerSettings.printer || printing}
                className={`w-full px-4 py-2.5 rounded-lg font-medium transition ${!printerSettings.printer || printing
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
              >
                {printing ? 'Отправка...' : 'Распечатать'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintReceiptModal;