import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import QrScanFrameOverlay from '../QrScanner/QrScanFrameOverlay';
import { useQrFrameTracker, QR_SCAN_HOST_CLASS } from '../QrScanner/useQrFrameTracker';
import {
  QrTorchButton,
  stopScannerSafe,
  triggerScanErrorHaptic,
  triggerScanSuccessHaptic,
  useQrScannerCamera,
} from '../QrScanner/useQrScannerCamera';

const SCANNER_ID = 'garage-pickup-qr-scanner';

/** Local QR check before confirm — same shape as backend pickup payload. */
function parsePickupQr(raw, expectedOrderId, expectedKind) {
  if (!raw || !String(raw).trim()) {
    return { ok: false, message: 'QR пустой' };
  }
  let data;
  try {
    data = JSON.parse(String(raw).trim());
  } catch (_) {
    return { ok: false, message: 'Недействительный QR' };
  }
  if (!data || data.k !== 'pickup' || data.v !== 1) {
    return { ok: false, message: 'Недействительный QR' };
  }
  const scannedOrderId = Number(data.o);
  if (!Number.isFinite(scannedOrderId) || scannedOrderId !== Number(expectedOrderId)) {
    return { ok: false, message: 'QR от другого заказа' };
  }
  if (data.kind && expectedKind && String(data.kind) !== String(expectedKind)) {
    return { ok: false, message: 'QR от другого типа заказа' };
  }
  const code = String(data.c || '').trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'В QR нет кода получения' };
  }
  return { ok: true, code, qr_payload: String(raw).trim() };
}

export default function PickupVerifyModal({
  isOpen,
  orderId,
  orderKind = 'used',
  isSubmitting = false,
  error = '',
  onClose,
  onVerify,
}) {
  const [shellOpen, setShellOpen] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [mode, setMode] = useState('code');
  const [scanError, setScanError] = useState('');
  const [pendingPickup, setPendingPickup] = useState(null);
  const inputsRef = useRef([]);
  const scanLockRef = useRef(false);
  const scanViewportRef = useRef(null);
  const isSubmittingRef = useRef(isSubmitting);
  const submitLockRef = useRef(false);
  const orderIdRef = useRef(orderId);
  const orderKindRef = useRef(orderKind);

  const frameActive = Boolean(shellOpen && isOpen && mode === 'scan');
  const scanFrame = useQrFrameTracker({
    active: frameActive,
    containerRef: scanViewportRef,
    locked: mode === 'confirm',
  });

  const { stopCamera, torchSupported, torchOn, toggleTorch } = useQrScannerCamera({
    active: frameActive,
    scannerElementId: SCANNER_ID,
    scanLockRef,
    blockedRef: isSubmittingRef,
    onCameraError: () => {
      setScanError('Не удалось открыть камеру');
      setMode('code');
    },
    onDecode: async (decoded) => {
      await stopCamera();

      const parsed = parsePickupQr(decoded, orderIdRef.current, orderKindRef.current);
      if (!parsed.ok) {
        triggerScanErrorHaptic();
        setScanError(parsed.message);
        setPendingPickup(null);
        setMode('scan_invalid');
        scanLockRef.current = false;
        return;
      }

      triggerScanSuccessHaptic();
      setScanError('');
      setPendingPickup({ code: parsed.code, qr_payload: parsed.qr_payload });
      setMode('confirm');
      scanLockRef.current = false;
    },
  });

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
    if (!isSubmitting) {
      submitLockRef.current = false;
    }
  }, [isSubmitting]);

  useEffect(() => {
    orderIdRef.current = orderId;
    orderKindRef.current = orderKind;
  }, [orderId, orderKind]);

  useEffect(() => {
    if (isOpen) {
      setShellOpen(true);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      await stopCamera();
      if (cancelled) return;
      setDigits(['', '', '', '', '', '']);
      setMode('code');
      setScanError('');
      setPendingPickup(null);
      scanLockRef.current = false;
      setShellOpen(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, stopCamera]);

  const handleClose = useCallback(async () => {
    await stopCamera();
    onClose?.();
  }, [onClose, stopCamera]);

  const startScan = () => {
    setScanError('');
    setPendingPickup(null);
    scanLockRef.current = false;
    setMode('scan');
  };

  const cancelConfirm = () => {
    setPendingPickup(null);
    setScanError('');
    setMode('code');
  };

  const confirmIssue = () => {
    if (!pendingPickup || isSubmitting || submitLockRef.current) return;
    submitLockRef.current = true;
    onVerify?.({
      code: pendingPickup.code,
      qr_payload: pendingPickup.qr_payload,
    });
  };

  const submitCode = () => {
    const code = digits.join('');
    if (isSubmitting || submitLockRef.current || code.length !== 6) return;
    submitLockRef.current = true;
    onVerify({ code });
  };

  if (!shellOpen) return null;

  const codeValue = digits.join('');

  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (cleaned && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    text.split('').forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  };

  const showDefaultFooter = mode !== 'confirm' && mode !== 'scan_invalid';

  return (
    <Modal
      open={shellOpen && isOpen}
      onClose={handleClose}
      title={`Выдача заказа №${orderId}`}
      size="md"
      className="max-h-[min(92dvh,640px)]"
      footer={showDefaultFooter ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          {mode === 'code' ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || codeValue.length !== 6}
              onClick={submitCode}
            >
              {isSubmitting ? 'Проверка…' : 'Выдать'}
            </button>
          ) : null}
        </div>
      ) : null}
    >
      <p className="text-sm text-gray-500">
        {orderKind === 'new' ? 'Новые запчасти' : 'Б/у'} · 6 цифр или QR
      </p>

      {mode === 'confirm' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">QR распознан</p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-gray-900 tabular-nums">
              {pendingPickup?.code}
            </p>
          </div>
          <p className="text-center text-sm text-gray-600">Выдать товар покупателю?</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50"
              onClick={cancelConfirm}
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              onClick={confirmIssue}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Выдача…' : 'Выдать товар'}
            </button>
          </div>
        </div>
      )}

      {mode === 'scan_invalid' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-center">
            <p className="text-sm font-medium text-red-700" role="alert">{scanError || 'Недействительный QR'}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-300 px-4 text-sm text-gray-700 hover:bg-gray-50"
              onClick={handleClose}
            >
              Отмена
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              onClick={startScan}
            >
              Сканировать снова
            </button>
          </div>
        </div>
      )}

      {mode === 'code' && (
        <>
          <div className="mt-5 flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="h-12 w-10 rounded-xl border border-gray-300 text-center font-mono text-xl font-semibold text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                aria-label={`Цифра ${index + 1}`}
                disabled={isSubmitting}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
              onClick={startScan}
              disabled={isSubmitting}
            >
              Сканировать
            </button>
          </div>
        </>
      )}

      <div className={mode === 'scan' ? 'mt-4 space-y-3' : 'hidden'}>
        <div
          ref={scanViewportRef}
          className="relative min-h-[240px] overflow-hidden rounded-xl border border-gray-200 bg-black"
        >
          <div
            id={SCANNER_ID}
            className={`${QR_SCAN_HOST_CLASS} absolute inset-0 h-full w-full`}
          />
          {frameActive ? (
            <QrScanFrameOverlay frame={scanFrame} hint="Наведите на QR выдачи" />
          ) : null}
          {frameActive && torchSupported ? (
            <div className="absolute right-2 top-2 z-30">
              <QrTorchButton supported={torchSupported} on={torchOn} onToggle={toggleTorch} />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          onClick={() => setMode('code')}
          disabled={isSubmitting}
        >
          Ввести код
        </button>
      </div>

      {isSubmitting && mode !== 'confirm' ? (
        <p className="mt-3 text-sm text-indigo-600" role="status">Проверка кода…</p>
      ) : null}

      {error && mode !== 'scan_invalid' ? (
        <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>
      ) : null}
    </Modal>
  );
}

// Keep export for tests that may import stopScannerSafe from this module path
export { stopScannerSafe };
