import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { applyCameraEnhancements, setTorchEnabled } from '../../utils/vinCameraControls';
import { triggerHaptic } from '../../utils/haptics';
import { QR_SCAN_CAMERA_CONFIG } from './useQrFrameTracker';

export async function stopScannerSafe(scanner) {
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

export const HAPTIC_SCAN_SUCCESS = 20;
export const HAPTIC_SCAN_ERROR = [30, 40, 30];

export function triggerScanSuccessHaptic() {
  return triggerHaptic(HAPTIC_SCAN_SUCCESS);
}

export function triggerScanErrorHaptic() {
  return triggerHaptic(HAPTIC_SCAN_ERROR);
}

function findScannerVideo(scannerElementId) {
  const host = document.getElementById(scannerElementId);
  return host?.querySelector('video') || null;
}

async function waitForScannerStream(scannerElementId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const video = findScannerVideo(scannerElementId);
    const stream = video?.srcObject;
    if (stream?.getVideoTracks?.()?.length) {
      return stream;
    }
  }
  return null;
}

/**
 * Shared Html5Qrcode lifecycle: start/stop, torch, safe cleanup on unmount.
 */
export function useQrScannerCamera({
  active,
  scannerElementId,
  onDecode,
  onCameraError,
  scanLockRef: externalScanLockRef,
  blockedRef,
}) {
  const html5QrCodeRef = useRef(null);
  const streamRef = useRef(null);
  const internalScanLockRef = useRef(false);
  const scanLockRef = externalScanLockRef || internalScanLockRef;
  const onDecodeRef = useRef(onDecode);
  const onCameraErrorRef = useRef(onCameraError);
  const blockedRefRef = useRef(blockedRef);
  const torchOnRef = useRef(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);

  useEffect(() => {
    blockedRefRef.current = blockedRef;
  }, [blockedRef]);

  useEffect(() => {
    torchOnRef.current = torchOn;
  }, [torchOn]);

  const stopCamera = useCallback(async () => {
    const scanner = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    if (streamRef.current && torchOnRef.current) {
      await setTorchEnabled(streamRef.current, false);
    }
    streamRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    await stopScannerSafe(scanner);
  }, []);

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchSupported) return;
    const next = !torchOnRef.current;
    const ok = await setTorchEnabled(streamRef.current, next);
    if (ok) setTorchOn(next);
  }, [torchSupported]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    let cancelled = false;
    let scanner;

    const start = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (cancelled) return;

      const el = document.getElementById(scannerElementId);
      if (!el) {
        onCameraErrorRef.current?.('Не удалось открыть камеру');
        return;
      }

      el.innerHTML = '';
      scanner = new Html5Qrcode(scannerElementId);
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          QR_SCAN_CAMERA_CONFIG,
          async (decodedText) => {
            if (cancelled || scanLockRef.current || blockedRefRef.current?.current) return;
            scanLockRef.current = true;
            try {
              await onDecodeRef.current?.(decodedText);
            } catch (_) {
              triggerScanErrorHaptic();
              scanLockRef.current = false;
            }
          },
          () => {},
        );

        if (cancelled) return;

        const stream = await waitForScannerStream(scannerElementId);
        if (cancelled || !stream) return;

        streamRef.current = stream;
        const caps = await applyCameraEnhancements(stream);
        if (!cancelled) {
          setTorchSupported(caps.torchSupported);
        }
      } catch (_) {
        if (!cancelled) {
          onCameraErrorRef.current?.('Не удалось открыть камеру');
          html5QrCodeRef.current = null;
          await stopScannerSafe(scanner);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const activeScanner = html5QrCodeRef.current || scanner;
      html5QrCodeRef.current = null;
      if (streamRef.current) {
        setTorchEnabled(streamRef.current, false).catch(() => {});
      }
      streamRef.current = null;
      setTorchOn(false);
      setTorchSupported(false);
      stopScannerSafe(activeScanner);
    };
  }, [active, scannerElementId, scanLockRef]);

  return {
    html5QrCodeRef,
    stopCamera,
    torchSupported,
    torchOn,
    toggleTorch,
  };
}

export function QrTorchButton({
  supported,
  on,
  onToggle,
  className = '',
}) {
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur-sm hover:bg-black/70 ${className}`}
      aria-label={on ? 'Выключить фонарик' : 'Включить фонарик'}
      aria-pressed={on}
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        {on ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        )}
      </svg>
    </button>
  );
}
