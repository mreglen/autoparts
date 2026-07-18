import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasWarehouseQrAccess, usePermissionCodes } from '../../hooks/useWarehousePermissions';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import QrScanFrameOverlay from '../../components/QrScanner/QrScanFrameOverlay';
import {
  QR_SCAN_CAMERA_CONFIG,
  QR_SCAN_HOST_CLASS,
  useQrFrameTracker,
} from '../../components/QrScanner/useQrFrameTracker';

const SCANNER_ID = 'warehouse-qr-reader';

async function stopScannerSafe(scanner) {
  if (!scanner) return;
  try {
    const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
    // 2 = SCANNING, 3 = PAUSED
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

export default function WarehouseScanPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const permissionCodes = usePermissionCodes();
  const html5QrCodeRef = useRef(null);
  const scanLockRef = useRef(false);
  const navigateRef = useRef(navigate);
  const scanViewportRef = useRef(null);

  const [cameraError, setCameraError] = useState('');
  const [manualId, setManualId] = useState('');
  const [notice, setNotice] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const canScan = userHasWarehouseQrAccess(user, permissionCodes);
  const frameActive = Boolean(canScan && cameraActive && !isNavigating && !cameraError);
  const scanFrame = useQrFrameTracker({
    active: frameActive,
    containerRef: scanViewportRef,
    locked: isNavigating,
  });

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true, state: { from: '/warehouse/scan' } });
    }
  }, [isReady, isAuthenticated, navigate]);

  // Start camera once when access is ready. Do NOT restart on every callback identity change.
  useEffect(() => {
    if (!isReady || !isAuthenticated || !canScan || !cameraActive || isNavigating) {
      return undefined;
    }

    let cancelled = false;
    let scanner;

    const start = async () => {
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;

      const el = document.getElementById(SCANNER_ID);
      if (!el) {
        setCameraError('Не удалось открыть камеру. Разрешите доступ или введите ID вручную.');
        return;
      }
      el.innerHTML = '';

      scanner = new Html5Qrcode(SCANNER_ID);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          QR_SCAN_CAMERA_CONFIG,
          async (decodedText) => {
            if (cancelled || scanLockRef.current) return;
            scanLockRef.current = true;

            const parsed = parseSellerPartCardQr(decodedText);
            if (!parsed?.path) {
              setNotice(
                parsed
                  ? 'Не удалось распознать QR-код этикетки'
                  : 'QR не содержит ссылку на карточку запчасти'
              );
              scanLockRef.current = false;
              return;
            }

            setNotice('');

            const active = html5QrCodeRef.current;
            html5QrCodeRef.current = null;
            await stopScannerSafe(active);
            if (cancelled) return;

            setCameraActive(false);
            setIsNavigating(true);
            await new Promise((r) => setTimeout(r, 180));
            navigateRef.current(parsed.path);
          },
          () => {}
        );
      } catch (err) {
        if (!cancelled) {
          setCameraError('Не удалось открыть камеру. Разрешите доступ или введите ID вручную.');
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
  }, [isReady, isAuthenticated, canScan, cameraActive, isNavigating]);

  const goToPath = useCallback(async (path) => {
    if (!path || scanLockRef.current) return;
    scanLockRef.current = true;

    const active = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    await stopScannerSafe(active);

    setCameraActive(false);
    setIsNavigating(true);
    await new Promise((r) => setTimeout(r, 80));
    navigate(path);
  }, [navigate]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (scanLockRef.current || isNavigating) return;

    const parsed = parseSellerPartCardQr(manualId.trim());
    if (parsed?.path) {
      setNotice('');
      await goToPath(parsed.path);
      return;
    }
    const numeric = parseInt(manualId.trim(), 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      setNotice('');
      await goToPath(`/seller/part-card/${numeric}`);
      return;
    }
    setNotice('Введите ID товара или вставьте ссылку с этикетки');
  };

  const restartCamera = () => {
    scanLockRef.current = false;
    setNotice('');
    setCameraError('');
    setIsNavigating(false);
    setCameraActive(true);
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  if (!canScan) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Нет доступа</h1>
        <p className="mt-2 text-gray-600">Сканирование QR доступно сотрудникам склада.</p>
        <Link to="/my-parts" className="mt-6 inline-block text-indigo-600 hover:underline">К моим запчастям</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900">Сканировать QR</h1>
      <p className="mt-1 text-sm text-gray-600">Наведите камеру на QR-код с этикетки запчасти</p>

      <div
        ref={scanViewportRef}
        className="relative mt-5 min-h-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-black"
      >
        <div
          id={SCANNER_ID}
          className={`${QR_SCAN_HOST_CLASS} absolute inset-0 h-full w-full ${
            isNavigating || !cameraActive ? 'invisible' : ''
          }`}
        />
        {frameActive ? (
          <QrScanFrameOverlay frame={scanFrame} locked={isNavigating} />
        ) : null}
        {isNavigating ? (
          <div className="absolute inset-0 z-20 flex min-h-[280px] items-center justify-center bg-gray-900/80 text-sm text-white">
            Открываем карточку…
          </div>
        ) : null}
      </div>

      {cameraError ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-amber-700">{cameraError}</p>
          <button
            type="button"
            onClick={restartCamera}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-3 text-sm text-gray-600">{notice}</p>
      ) : null}

      <form onSubmit={handleManualSubmit} className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="manual-qr-input">
          Или введите ID / ссылку вручную
        </label>
        <input
          id="manual-qr-input"
          type="text"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          placeholder="123 или https://…/seller/part-card/123"
          className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base"
          disabled={isNavigating}
        />
        <button
          type="submit"
          disabled={isNavigating}
          className="w-full min-h-12 rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isNavigating ? 'Открываем…' : 'Открыть карточку'}
        </button>
      </form>

      <Link to="/my-parts" className="mt-6 block text-center text-sm text-indigo-600 hover:underline">
        Открыть «Мои запчасти»
      </Link>
    </div>
  );
}
