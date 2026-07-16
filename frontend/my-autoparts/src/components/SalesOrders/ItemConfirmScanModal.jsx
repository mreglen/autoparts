import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import { normalizeInternalCodeForCompare } from '../../utils/internalCode';
import { apiAxios } from '../../utils/apiClient';
import { resolveStorageCellName, shortStorageCellText } from '../../utils/labelPrintDisplay';

const SCANNER_ID = 'garage-item-confirm-qr-scanner';

/** Same camera config as working WarehouseScanPage (/warehouse/scan). */
const QR_SCAN_CONFIG = { fps: 8, qrbox: { width: 220, height: 220 } };

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
  const cellLabel = storageCells.length > 0
    ? storageCells
      .map((link) => {
        if (link.value == null || String(link.value).trim() === '') return null;
        const name = shortStorageCellText(resolveStorageCellName(link, []));
        const value = shortStorageCellText(String(link.value).trim());
        return [name, value].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .join(' · ')
    : (storageAddresses || []).join('; ');

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Склад</div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-gray-900">
          {productCardLoading ? '…' : (productCardError ? 'Ошибка' : (warehouseName || '—'))}
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Ячейка</div>
        <div className="mt-0.5 truncate text-[11px] font-medium text-gray-900">
          {productCardLoading ? '…' : (cellLabel || '—')}
        </div>
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
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

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
      className={`fixed inset-0 z-[100] flex bg-black/50 ${
        isOpen ? '' : 'pointer-events-none opacity-0'
      } sm:items-center sm:justify-center sm:p-4`}
      aria-hidden={!isOpen}
    >
      {/* Mobile: fullscreen. Desktop: centered card. */}
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[min(92dvh,640px)] sm:max-w-md sm:rounded-2xl sm:border sm:border-gray-200 sm:shadow-xl">
        <div
          className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 sm:text-base">Подтверждение позиции</h3>
            <p className="truncate text-xs font-medium text-gray-800 sm:text-sm">{title}</p>
            {(brand || partnumber) && (
              <p className="truncate text-[11px] text-gray-500">
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-2 sm:px-5 sm:py-3">
          {mode === 'entry' ? (
            <>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-black sm:min-h-[280px]">
                <div
                  id={SCANNER_ID}
                  className={`absolute inset-0 h-full w-full ${!cameraActive ? 'invisible' : ''}`}
                />
                {!cameraActive ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-sm text-white">
                    Камера остановлена
                  </div>
                ) : null}
              </div>

              {cameraError ? (
                <div className="mt-1.5 shrink-0 space-y-0.5">
                  <p className="text-[11px] text-amber-700">{cameraError}</p>
                  <button
                    type="button"
                    onClick={restartCamera}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              <form onSubmit={handleManualSubmit} className="mt-2 shrink-0">
                <label className="mb-0.5 block text-[11px] font-medium text-gray-600" htmlFor="item-confirm-manual-id">
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

              {(entryError || error) ? (
                <p className="mt-1 shrink-0 text-[11px] text-red-600">{entryError || error}</p>
              ) : (
                <p className="mt-1 shrink-0 text-[10px] text-gray-500">
                  QR в рамку камеры или код вручную + OK
                </p>
              )}
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
              <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-6 text-center">
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

        <div className="shrink-0 border-t border-gray-100 bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-3 sm:pb-3">
          <WarehouseFooter
            productCard={productCard}
            productCardLoading={productCardLoading}
            productCardError={productCardError}
          />
          <div className="mt-2">
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
