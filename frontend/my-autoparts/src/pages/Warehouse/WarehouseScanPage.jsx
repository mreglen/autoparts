import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasWarehouseQrAccess, usePermissionCodes } from '../../hooks/useWarehousePermissions';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import QrScanFrameOverlay from '../../components/QrScanner/QrScanFrameOverlay';
import {
  QR_SCAN_HOST_CLASS,
  useQrFrameTracker,
} from '../../components/QrScanner/useQrFrameTracker';
import {
  QrTorchButton,
  triggerScanErrorHaptic,
  triggerScanSuccessHaptic,
  useQrScannerCamera,
} from '../../components/QrScanner/useQrScannerCamera';

const SCANNER_ID = 'warehouse-qr-reader';

export default function WarehouseScanPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const permissionCodes = usePermissionCodes();
  const scanLockRef = useRef(false);
  const navigateRef = useRef(navigate);
  const scanViewportRef = useRef(null);

  const [cameraError, setCameraError] = useState('');
  const [manualId, setManualId] = useState('');
  const [notice, setNotice] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  const canScan = userHasWarehouseQrAccess(user, permissionCodes);
  const cameraHookActive = Boolean(
    isReady && isAuthenticated && canScan && cameraActive && !isNavigating,
  );
  const frameActive = Boolean(canScan && cameraActive && !isNavigating && !cameraError);

  const { stopCamera, torchSupported, torchOn, toggleTorch } = useQrScannerCamera({
    active: cameraHookActive,
    scannerElementId: SCANNER_ID,
    scanLockRef,
    onCameraError: () => {
      setCameraError('Не удалось открыть камеру. Разрешите доступ или введите ID вручную.');
    },
    onDecode: async (decodedText) => {
      const parsed = parseSellerPartCardQr(decodedText);
      if (!parsed?.path) {
        setNotice(
          parsed
            ? 'Не удалось распознать QR-код этикетки'
            : 'QR не содержит ссылку на карточку запчасти',
        );
        triggerScanErrorHaptic();
        scanLockRef.current = false;
        return;
      }

      triggerScanSuccessHaptic();
      setNotice('');
      await stopCamera();
      setCameraActive(false);
      setIsNavigating(true);
      await new Promise((r) => setTimeout(r, 180));
      navigateRef.current(parsed.path);
    },
  });

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

  const goToPath = useCallback(async (path) => {
    if (!path || scanLockRef.current) return;
    scanLockRef.current = true;

    await stopCamera();
    setCameraActive(false);
    setIsNavigating(true);
    await new Promise((r) => setTimeout(r, 80));
    navigate(path);
  }, [navigate, stopCamera]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (scanLockRef.current || isNavigating) return;

    const parsed = parseSellerPartCardQr(manualId.trim());
    if (parsed?.path) {
      setNotice('');
      triggerScanSuccessHaptic();
      await goToPath(parsed.path);
      return;
    }
    const numeric = parseInt(manualId.trim(), 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      setNotice('');
      triggerScanSuccessHaptic();
      await goToPath(`/seller/part-card/${numeric}`);
      return;
    }
    triggerScanErrorHaptic();
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
    <div className="mx-auto max-w-lg px-4 py-6 max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
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
        {frameActive && torchSupported ? (
          <div className="absolute right-2 top-2 z-30">
            <QrTorchButton supported={torchSupported} on={torchOn} onToggle={toggleTorch} />
          </div>
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
            className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="mt-3 text-sm text-gray-600" role="status">{notice}</p>
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
          className="w-full min-h-11 rounded-lg border border-gray-300 px-3 py-3 text-base"
          disabled={isNavigating}
        />
        <button
          type="submit"
          disabled={isNavigating}
          className="w-full min-h-11 rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
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
