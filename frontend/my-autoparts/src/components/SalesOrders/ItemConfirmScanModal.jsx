import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import StorageCellsDisplayTable from '../StorageCellsTable/StorageCellsDisplayTable';

const SCANNER_ID = 'garage-item-confirm-qr-scanner';

async function stopScannerSafe(scanner) {
  if (!scanner) return;
  try {
    const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
    if (state == null || state === 2 || state === 3) {
      await scanner.stop();
    }
  } catch (_) {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch (_) {
    /* DOM already gone */
  }
}

function parseProductIdFromScan(raw) {
  const parsed = parseSellerPartCardQr(raw);
  if (parsed?.productId) return parsed.productId;
  const trimmed = String(raw || '').trim();
  if (/^\d+$/.test(trimmed)) {
    const id = parseInt(trimmed, 10);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  return null;
}

export default function ItemConfirmScanModal({
  isOpen,
  item,
  productCard,
  productCardLoading = false,
  productCardError = '',
  isSubmitting = false,
  error = '',
  onClose,
  onConfirm,
}) {
  const [shellOpen, setShellOpen] = useState(false);
  const [mode, setMode] = useState('scan'); // scan | scan_invalid | confirm
  const [scanError, setScanError] = useState('');
  const [manualId, setManualId] = useState('');
  const html5QrCodeRef = useRef(null);
  const scanLockRef = useRef(false);
  const expectedProductIdRef = useRef(null);
  const isSubmittingRef = useRef(isSubmitting);
  const handleScanResultRef = useRef(null);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    expectedProductIdRef.current = item?.product_id ?? null;
  }, [item?.product_id]);

  const handleScanResult = useCallback(async (raw) => {
    scanLockRef.current = true;

    const active = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    await stopScannerSafe(active);

    const scannedId = parseProductIdFromScan(raw);
    const expectedId = Number(expectedProductIdRef.current);

    if (!scannedId) {
      setScanError('Не удалось распознать QR-код этикетки');
      setMode('scan_invalid');
      scanLockRef.current = false;
      return;
    }

    if (!Number.isFinite(expectedId) || scannedId !== expectedId) {
      setScanError('Это другой товар. Отсканируйте этикетку нужной позиции.');
      setMode('scan_invalid');
      scanLockRef.current = false;
      return;
    }

    setScanError('');
    setMode('confirm');
    scanLockRef.current = false;
  }, []);

  useEffect(() => {
    handleScanResultRef.current = handleScanResult;
  }, [handleScanResult]);

  useEffect(() => {
    if (isOpen) {
      setShellOpen(true);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const active = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      await stopScannerSafe(active);
      if (cancelled) return;
      setMode('scan');
      setScanError('');
      setManualId('');
      scanLockRef.current = false;
      setShellOpen(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!shellOpen || !isOpen || mode !== 'scan') {
      return undefined;
    }

    let cancelled = false;
    let scanner;

    const start = async () => {
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        setScanError('Не удалось открыть камеру');
        setMode('scan_invalid');
        return;
      }

      el.innerHTML = '';
      scanner = new Html5Qrcode(SCANNER_ID);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          async (decoded) => {
            if (cancelled || scanLockRef.current || isSubmittingRef.current) return;
            handleScanResultRef.current?.(decoded);
          },
          () => {}
        );
      } catch (_) {
        if (!cancelled) {
          setScanError('Не удалось открыть камеру');
          setMode('scan_invalid');
          html5QrCodeRef.current = null;
          await stopScannerSafe(scanner);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const active = html5QrCodeRef.current || scanner;
      html5QrCodeRef.current = null;
      stopScannerSafe(active);
    };
  }, [shellOpen, isOpen, mode]);

  const handleClose = useCallback(async () => {
    const active = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    await stopScannerSafe(active);
    onClose?.();
  }, [onClose]);

  const startScan = () => {
    setScanError('');
    scanLockRef.current = false;
    setMode('scan');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    await handleScanResult(manualId.trim());
  };

  if (!shellOpen || !item) return null;

  const title = item.product_name || item.name || 'Товар';
  const brand = item.brand || item.product?.brand;
  const partnumber = item.partnumber || item.product?.partnumber;
  const warehouseName = productCard?.storage_location_name;
  const storageCells = productCard?.product_storage_cells || [];
  const storageAddresses = productCard?.storage_addresses || [];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm ${
        isOpen ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Подтверждение позиции</h3>
        <p className="mt-1 text-sm font-medium text-gray-800">{title}</p>
        {(brand || partnumber) && (
          <p className="mt-0.5 text-xs text-gray-500">
            {[brand, partnumber].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">Склад</div>
            {productCardLoading ? (
              <div className="mt-1 text-sm text-gray-500">Загрузка…</div>
            ) : (
              <div className="mt-1 text-sm font-medium text-gray-900">
                {productCardError ? 'Не удалось загрузить данные склада' : (warehouseName || '—')}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Адресное хранение</div>
            {productCardLoading ? (
              <div className="text-sm text-gray-500">Загрузка…</div>
            ) : storageCells.length > 0 ? (
              <StorageCellsDisplayTable productStorageCells={storageCells} compact />
            ) : storageAddresses.length > 0 ? (
              <div className="break-words text-sm text-gray-800">{storageAddresses.join('; ')}</div>
            ) : (
              <div className="text-sm text-gray-500">—</div>
            )}
          </div>
        </div>

        {mode === 'confirm' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Товар совпал</p>
              <p className="mt-2 text-sm text-gray-700">ID {item.product_id}</p>
            </div>
            <p className="text-center text-sm text-gray-600">Подтвердить позицию в заказе?</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={startScan}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                onClick={onConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Подтверждение…' : 'Подтвердить'}
              </button>
            </div>
          </div>
        )}

        {mode === 'scan_invalid' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center">
              <p className="text-sm font-medium text-red-700">{scanError || 'Недействительный QR'}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={handleClose}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={startScan}
              >
                Сканировать снова
              </button>
            </div>
          </div>
        )}

        {mode === 'scan' && (
          <>
            <p className="mt-4 text-sm text-gray-600">Отсканируйте QR-код с этикетки товара</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-black/5 min-h-[240px]">
              <div id={SCANNER_ID} className="min-h-[240px]" />
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="item-confirm-manual-id">
                Или введите ID / ссылку вручную
              </label>
              <input
                id="item-confirm-manual-id"
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="123 или https://…/seller/part-card/123"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting || !manualId.trim()}
                className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
              >
                Проверить
              </button>
            </form>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Отмена
              </button>
            </div>
          </>
        )}

        {error && mode !== 'scan_invalid' ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
