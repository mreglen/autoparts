import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import { normalizeInternalCodeForCompare } from '../../utils/internalCode';
import { apiAxios } from '../../utils/apiClient';
import StorageCellsDisplayTable from '../StorageCellsTable/StorageCellsDisplayTable';

const SCANNER_ID = 'garage-item-confirm-qr-scanner';

/** Same camera config as working WarehouseScanPage (/warehouse/scan). */
const QR_SCAN_CONFIG = { fps: 8, qrbox: { width: 250, height: 250 } };

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

function looksLikeInternalCode(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.includes('/')) return false;
  const compact = normalizeInternalCodeForCompare(trimmed);
  return compact.length >= 6;
}

/**
 * Real bug: warehouse labels often encode /my-parts/edit-pending/{pendingId}.
 * pendingId ≠ product.id, so comparing only product_id always fails.
 * Also full URL must not be treated as an internal code.
 */
async function verifyScanInput(
  raw,
  expectedProductId,
  expectedInternalCode,
  sourcePendingId,
  { productCardLoading = false } = {},
) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { ok: false, message: 'Введите внутренний код или отсканируйте этикетку' };
  }

  const expectedId = Number(expectedProductId);
  const expectedCode = normalizeInternalCodeForCompare(expectedInternalCode);
  const expectedPendingId = sourcePendingId != null ? Number(sourcePendingId) : null;
  const parsed = parseSellerPartCardQr(trimmed);

  // 1) /seller/part-card/{id}, /part/{id}, numeric id — works without productCard
  const scannedProductId = parsed?.productId
    ?? (/^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : null);
  if (
    scannedProductId
    && Number.isFinite(expectedId)
    && Number(scannedProductId) === expectedId
  ) {
    return { ok: true };
  }

  const needsCardData = Boolean(
    parsed?.type === 'edit-pending'
    || parsed?.type === 'label-code'
    || parsed?.internalCode
    || looksLikeInternalCode(trimmed),
  );
  if (needsCardData && productCardLoading && !expectedCode && !Number.isFinite(expectedPendingId)) {
    return { ok: false, message: 'Подождите, загружаются данные товара…' };
  }

  // 2) /qr/label/{internal_code} or typed internal code
  const scannedCode = normalizeInternalCodeForCompare(
    parsed?.internalCode || (looksLikeInternalCode(trimmed) ? trimmed : ''),
  );
  if (expectedCode && scannedCode && scannedCode === expectedCode) {
    return { ok: true };
  }

  // 2b) Resolve /qr/label/CODE via API if local compare failed (e.g. formatting)
  if (parsed?.type === 'label-code' && parsed.internalCode) {
    try {
      const response = await apiAxios.get(
        `/products/label-resolve/${encodeURIComponent(parsed.internalCode)}`,
      );
      const resolved = response.data || {};
      if (
        Number.isFinite(expectedId)
        && resolved.product_id != null
        && Number(resolved.product_id) === expectedId
      ) {
        return { ok: true };
      }
      const resolvedCode = normalizeInternalCodeForCompare(resolved.internal_code);
      if (expectedCode && resolvedCode && resolvedCode === expectedCode) {
        return { ok: true };
      }
    } catch (_) {
      /* fall through */
    }
  }

  // 3) Legacy label: /my-parts/edit-pending/{pendingId}
  if (parsed?.type === 'edit-pending' && parsed.id) {
    if (
      Number.isFinite(expectedPendingId)
      && Number(parsed.id) === expectedPendingId
      && Number.isFinite(expectedId)
    ) {
      return { ok: true };
    }

    try {
      const response = await apiAxios.get(`/products/label-resolve-pending/${parsed.id}`);
      const resolved = response.data || {};
      if (
        Number.isFinite(expectedId)
        && resolved.product_id != null
        && Number(resolved.product_id) === expectedId
      ) {
        return { ok: true };
      }
      const resolvedCode = normalizeInternalCodeForCompare(resolved.internal_code);
      if (expectedCode && resolvedCode && resolvedCode === expectedCode) {
        return { ok: true };
      }
      if (resolved.type === 'pending') {
        return {
          ok: false,
          message: 'Товар ещё на модерации. Дождитесь одобрения или введите внутренний код.',
        };
      }
    } catch (_) {
      return {
        ok: false,
        message: expectedCode
          ? `Старая этикетка (до модерации). Введите внутренний код: ${expectedInternalCode}`
          : 'Старая этикетка. Введите внутренний код с этикетки вручную.',
      };
    }

    return {
      ok: false,
      message: 'Это другой товар. Проверьте этикетку нужной позиции.',
    };
  }

  if (scannedProductId) {
    return { ok: false, message: 'Это другой товар. Проверьте этикетку нужной позиции.' };
  }
  if (scannedCode && expectedCode) {
    return { ok: false, message: 'Неверный внутренний код для этой позиции.' };
  }
  return {
    ok: false,
    message: 'Не удалось распознать код. Введите внутренний код или отсканируйте этикетку.',
  };
}

function WarehouseFooter({ productCard, productCardLoading, productCardError }) {
  const warehouseName = productCard?.storage_location_name;
  const storageCells = productCard?.product_storage_cells || [];
  const storageAddresses = productCard?.storage_addresses || [];

  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Склад</div>
        {productCardLoading ? (
          <div className="mt-0.5 text-xs text-gray-500">Загрузка…</div>
        ) : (
          <div className="mt-0.5 truncate text-xs font-medium text-gray-900">
            {productCardError ? 'Не удалось загрузить' : (warehouseName || '—')}
          </div>
        )}
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Адресное хранение</div>
        {productCardLoading ? (
          <div className="mt-0.5 text-xs text-gray-500">Загрузка…</div>
        ) : storageCells.length > 0 ? (
          <div className="mt-1 max-h-16 overflow-hidden">
            <StorageCellsDisplayTable productStorageCells={storageCells} compact />
          </div>
        ) : storageAddresses.length > 0 ? (
          <div className="mt-0.5 line-clamp-2 text-xs text-gray-800">{storageAddresses.join('; ')}</div>
        ) : (
          <div className="mt-0.5 text-xs text-gray-500">—</div>
        )}
      </div>
    </div>
  );
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
  const [mode, setMode] = useState('entry'); // entry | confirm
  const [entryError, setEntryError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [manualId, setManualId] = useState('');
  const html5QrCodeRef = useRef(null);
  const scanLockRef = useRef(false);
  const expectedProductIdRef = useRef(null);
  const expectedInternalCodeRef = useRef(null);
  const expectedSourcePendingIdRef = useRef(null);
  const productCardLoadingRef = useRef(productCardLoading);
  const isSubmittingRef = useRef(isSubmitting);
  const handleScanResultRef = useRef(null);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    productCardLoadingRef.current = productCardLoading;
  }, [productCardLoading]);

  useEffect(() => {
    expectedProductIdRef.current = item?.product_id ?? productCard?.id ?? null;
    expectedInternalCodeRef.current = productCard?.internal_code ?? null;
    expectedSourcePendingIdRef.current = productCard?.source_pending_id ?? null;
  }, [item?.product_id, productCard?.id, productCard?.internal_code, productCard?.source_pending_id]);

  const handleScanResult = useCallback(async (raw, { fromScanner = false } = {}) => {
    const verification = await verifyScanInput(
      raw,
      expectedProductIdRef.current,
      expectedInternalCodeRef.current,
      expectedSourcePendingIdRef.current,
      { productCardLoading: productCardLoadingRef.current },
    );

    if (!verification.ok) {
      setEntryError(verification.message);
      if (fromScanner) {
        scanLockRef.current = false;
      }
      return;
    }

    if (fromScanner) {
      const active = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      await stopScannerSafe(active);
      setCameraActive(false);
    }

    setEntryError('');
    setMode('confirm');
    scanLockRef.current = false;
  }, []);

  useEffect(() => {
    handleScanResultRef.current = handleScanResult;
  }, [handleScanResult]);

  useEffect(() => {
    if (isOpen) {
      setShellOpen(true);
      setCameraActive(true);
      setCameraError('');
      setMode('entry');
      scanLockRef.current = false;
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const active = html5QrCodeRef.current;
      html5QrCodeRef.current = null;
      await stopScannerSafe(active);
      if (cancelled) return;
      setMode('entry');
      setEntryError('');
      setCameraError('');
      setCameraActive(true);
      setManualId('');
      scanLockRef.current = false;
      setShellOpen(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Mirror WarehouseScanPage: start once, fixed 250×250 qrbox, no CSS video hacks.
  useEffect(() => {
    if (!shellOpen || !isOpen || mode !== 'entry' || !cameraActive) {
      return undefined;
    }

    let cancelled = false;
    let scanner;

    const start = async () => {
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        setCameraError('Не удалось открыть камеру. Разрешите доступ или введите код вручную.');
        return;
      }

      el.innerHTML = '';
      scanner = new Html5Qrcode(SCANNER_ID);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          QR_SCAN_CONFIG,
          async (decodedText) => {
            if (cancelled || scanLockRef.current || isSubmittingRef.current) return;
            scanLockRef.current = true;
            await handleScanResultRef.current?.(decodedText, { fromScanner: true });
          },
          () => {}
        );
      } catch (_) {
        if (!cancelled) {
          setCameraError('Не удалось открыть камеру. Разрешите доступ или введите код вручную.');
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
  }, [shellOpen, isOpen, mode, cameraActive]);

  const handleClose = useCallback(async () => {
    const active = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    await stopScannerSafe(active);
    setCameraActive(false);
    onClose?.();
  }, [onClose]);

  const restartEntry = () => {
    setEntryError('');
    setManualId('');
    scanLockRef.current = false;
    setMode('entry');
    setCameraError('');
    setCameraActive(true);
  };

  const restartCamera = () => {
    scanLockRef.current = false;
    setCameraError('');
    setCameraActive(true);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmed = manualId.trim();
    const parsed = parseSellerPartCardQr(trimmed);
    const needsCardData = !parsed?.productId && !/^\d+$/.test(trimmed);
    if (needsCardData && productCardLoading) {
      setEntryError('Подождите, загружаются данные товара…');
      return;
    }

    await handleScanResult(trimmed, { fromScanner: false });
  };

  const parsedManual = parseSellerPartCardQr(manualId.trim());
  const manualLooksLikeProductId = Boolean(parsedManual?.productId) || /^\d+$/.test(manualId.trim());
  const manualSubmitDisabled = isSubmitting
    || !manualId.trim()
    || (productCardLoading && !manualLooksLikeProductId);

  if (!shellOpen || !item) return null;

  const title = item.product_name || item.name || 'Товар';
  const brand = item.brand || item.product?.brand;
  const partnumber = item.partnumber || item.product?.partnumber;
  const expectedProductId = item.product_id ?? productCard?.id;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 ${
        isOpen ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex max-h-[calc(100dvh-5.25rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:max-h-[min(92dvh,640px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900">Подтверждение позиции</h3>
            <p className="truncate text-sm font-medium text-gray-800">{title}</p>
            {(brand || partnumber) && (
              <p className="truncate text-xs text-gray-500">
                {[brand, partnumber].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {mode === 'entry' ? (
            <div className="flex flex-col">
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-black">
                <div
                  id={SCANNER_ID}
                  className={`w-full min-h-[240px] sm:min-h-[280px] ${!cameraActive ? 'invisible absolute inset-0' : ''}`}
                />
                {!cameraActive ? (
                  <div className="flex min-h-[240px] items-center justify-center bg-gray-900 text-sm text-white sm:min-h-[280px]">
                    Камера остановлена
                  </div>
                ) : null}
              </div>

              {cameraError ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-amber-700">{cameraError}</p>
                  <button
                    type="button"
                    onClick={restartCamera}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              <form onSubmit={handleManualSubmit} className="mt-2">
                <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="item-confirm-manual-id">
                  Внутренний код
                </label>
                <div className="flex gap-2">
                  <input
                    id="item-confirm-manual-id"
                    type="text"
                    value={manualId}
                    onChange={(e) => {
                      setManualId(e.target.value);
                      if (entryError) setEntryError('');
                    }}
                    placeholder={productCard?.internal_code || 'XXXX-AAAAA'}
                    className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    disabled={isSubmitting}
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                  <button
                    type="submit"
                    disabled={manualSubmitDisabled}
                    className="shrink-0 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    OK
                  </button>
                </div>
              </form>

              {entryError ? (
                <p className="mt-2 text-xs text-red-600">{entryError}</p>
              ) : (
                <p className="mt-2 text-[11px] text-gray-500">
                  Наведите QR в квадратную рамку камеры. Или введите код и нажмите OK.
                </p>
              )}
              {error ? (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-5 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Товар совпал</p>
                <p className="mt-2 text-base font-medium text-gray-900">
                  {productCard?.internal_code ? (
                    <span className="font-mono">{productCard.internal_code}</span>
                  ) : (
                    <>ID {expectedProductId}</>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <WarehouseFooter
            productCard={productCard}
            productCardLoading={productCardLoading}
            productCardError={productCardError}
          />
          <div className="mt-3">
            {mode === 'entry' ? (
              <button
                type="button"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Отмена
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={restartEntry}
                  disabled={isSubmitting}
                >
                  Снова
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '…' : 'Подтвердить'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
