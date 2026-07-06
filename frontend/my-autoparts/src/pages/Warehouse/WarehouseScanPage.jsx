import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useSelector } from 'react-redux';
import { parseSellerPartCardQr } from '../../utils/parseSellerPartCardQr';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasWarehouseQrAccess } from '../../hooks/useWarehousePermissions';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

const SCANNER_ID = 'warehouse-qr-reader';

export default function WarehouseScanPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes || []);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const [cameraError, setCameraError] = useState('');
  const [manualId, setManualId] = useState('');
  const [notice, setNotice] = useState('');

  const canScan = userHasWarehouseQrAccess(user, permissionCodes);

  const navigateToParsed = useCallback((parsed) => {
    if (!parsed?.path) {
      setNotice('Не удалось распознать QR-код этикетки');
      return;
    }
    navigate(parsed.path);
  }, [navigate]);

  const handleScanText = useCallback((text) => {
    const parsed = parseSellerPartCardQr(text);
    if (!parsed) {
      setNotice('QR не содержит ссылку на карточку запчасти');
      return;
    }
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {});
    }
    navigateToParsed(parsed);
  }, [navigateToParsed]);

  useEffect(() => {
    if (!isReady || !isAuthenticated || !canScan) return undefined;

    let mounted = true;
    const scanner = new Html5Qrcode(SCANNER_ID);
    html5QrCodeRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (mounted) handleScanText(decodedText);
          },
          () => {},
        );
      } catch (err) {
        if (mounted) {
          setCameraError('Не удалось открыть камеру. Разрешите доступ или введите ID вручную.');
        }
      }
    };

    start();

    return () => {
      mounted = false;
      scanner.stop().catch(() => {});
      scanner.clear().catch(() => {});
      html5QrCodeRef.current = null;
    };
  }, [isReady, isAuthenticated, canScan, handleScanText]);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true, state: { from: '/warehouse/scan' } });
    }
  }, [isReady, isAuthenticated, navigate]);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const parsed = parseSellerPartCardQr(manualId.trim());
    if (parsed) {
      navigateToParsed(parsed);
      return;
    }
    const numeric = parseInt(manualId.trim(), 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      navigate(`/seller/part-card/${numeric}`);
      return;
    }
    setNotice('Введите ID товара или вставьте ссылку с этикетки');
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

      <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-black">
        <div id={SCANNER_ID} ref={scannerRef} className="w-full min-h-[280px]" />
      </div>

      {cameraError ? (
        <p className="mt-3 text-sm text-amber-700">{cameraError}</p>
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
        />
        <button
          type="submit"
          className="w-full min-h-12 rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700"
        >
          Открыть карточку
        </button>
      </form>

      <Link to="/my-parts" className="mt-6 block text-center text-sm text-indigo-600 hover:underline">
        Открыть «Мои запчасти»
      </Link>
    </div>
  );
}
