import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const SCANNER_ID = 'garage-pickup-qr-scanner';

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

export default function PickupVerifyModal({
  isOpen,
  orderId,
  orderKind = 'used',
  isSubmitting = false,
  error = '',
  onClose,
  onVerify,
  onOverride,
  allowOverride = true,
}) {
  const [shellOpen, setShellOpen] = useState(false);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [mode, setMode] = useState('code'); // code | scan | override
  const [overrideReason, setOverrideReason] = useState('');
  const [scanError, setScanError] = useState('');
  const inputsRef = useRef([]);
  const html5QrCodeRef = useRef(null);
  const scanLockRef = useRef(false);
  const onVerifyRef = useRef(onVerify);
  const isSubmittingRef = useRef(isSubmitting);

  useEffect(() => {
    onVerifyRef.current = onVerify;
  }, [onVerify]);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Keep modal shell mounted until camera is fully stopped — prevents white-screen crash
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
      setDigits(['', '', '', '', '', '']);
      setMode('code');
      setOverrideReason('');
      setScanError('');
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
        setMode('code');
        return;
      }

      // Clear stale children if previous session left nodes
      el.innerHTML = '';

      scanner = new Html5Qrcode(SCANNER_ID);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          async (decoded) => {
            if (cancelled || scanLockRef.current || isSubmittingRef.current) return;
            scanLockRef.current = true;

            const active = html5QrCodeRef.current;
            html5QrCodeRef.current = null;
            await stopScannerSafe(active);
            if (cancelled) return;

            setMode('code');

            try {
              await onVerifyRef.current?.({ qr_payload: decoded });
            } catch (_) {
              /* parent shows error */
            } finally {
              scanLockRef.current = false;
            }
          },
          () => {}
        );
      } catch (e) {
        if (!cancelled) {
          setScanError('Не удалось открыть камеру');
          setMode('code');
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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm ${
        isOpen ? '' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!isOpen}
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Выдача заказа №{orderId}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {orderKind === 'new' ? 'Новые запчасти' : 'Б/у'} · 6 цифр или QR
        </p>

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
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                onClick={() => {
                  setScanError('');
                  scanLockRef.current = false;
                  setMode('scan');
                }}
                disabled={isSubmitting}
              >
                Сканировать
              </button>
              {allowOverride ? (
                <button
                  type="button"
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                  onClick={() => setMode('override')}
                  disabled={isSubmitting}
                >
                  Без кода
                </button>
              ) : null}
            </div>
          </>
        )}

        <div className={mode === 'scan' ? 'mt-4 space-y-3' : 'hidden'}>
          <div
            id={SCANNER_ID}
            className="overflow-hidden rounded-xl border border-gray-200 bg-black/5 min-h-[240px]"
          />
          {scanError ? <p className="text-sm text-red-600">{scanError}</p> : null}
          <button
            type="button"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
            onClick={() => setMode('code')}
            disabled={isSubmitting}
          >
            Ввести код
          </button>
        </div>

        {mode === 'override' && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700" htmlFor="pickup-override-reason">
              Причина
            </label>
            <input
              id="pickup-override-reason"
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Забыл телефон / код"
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              onClick={() => setMode('code')}
            >
              Вернуться к коду
            </button>
          </div>
        )}

        {isSubmitting ? (
          <p className="mt-3 text-sm text-indigo-600">Проверка кода…</p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Отмена
          </button>
          {mode === 'code' ? (
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || codeValue.length !== 6}
              onClick={() => onVerify({ code: codeValue })}
            >
              {isSubmitting ? 'Проверка…' : 'Выдать'}
            </button>
          ) : null}
          {mode === 'override' ? (
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || !overrideReason.trim()}
              onClick={() => onOverride(overrideReason.trim())}
            >
              {isSubmitting ? 'Сохраняем…' : 'Выдать без кода'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
