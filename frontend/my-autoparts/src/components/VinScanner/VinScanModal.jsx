import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import {
  normalizeVinForLookupOrNull,
  normalizeVinOrNull,
  sanitizeVinInput,
  VIN_INPUT_MAX_LENGTH,
} from '../../utils/laximoVin';
import { extractVinFromOcrText, extractVinCandidatesFromOcrText } from '../../utils/extractVinFromOcrText';
import {
  recognizeVinFromCanvas,
  recognizeVinFromImageSource,
  warmupVinOcrWorker,
} from '../../utils/vinOcr';
import { assessVinFrameQuality, isExtremelyPoorVinFrame } from '../../utils/vinFrameQuality';
import { VinScanConsensus } from '../../utils/vinScanConsensus';
import {
  getCameraVideoConstraints,
  getVinScanTiming,
  isMobileVinScanDevice,
  liveScanStatusLabel,
} from '../../utils/vinScanMobile';
import {
  createVinBarcodeDetector,
  scanVinBarcodeFromSource,
} from '../../utils/vinBarcodeScan';
import {
  applyCameraEnhancements,
  setTorchEnabled,
} from '../../utils/vinCameraControls';

const MODES = {
  INTRO: 'intro',
  SCAN: 'scan',
  CONFIRM: 'confirm',
  ERROR: 'error',
};

function stopMediaStream(streamRef) {
  const stream = streamRef.current;
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

function captureFrame(videoEl, guideRect) {
  const canvas = document.createElement('canvas');
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  const videoBox = videoEl.getBoundingClientRect();
  const guideBox = guideRect?.getBoundingClientRect?.() || videoBox;

  const scale = Math.max(videoBox.width / vw, videoBox.height / vh);
  const dispW = vw * scale;
  const dispH = vh * scale;
  const offsetX = videoBox.left + (videoBox.width - dispW) / 2;
  const offsetY = videoBox.top + (videoBox.height - dispH) / 2;

  const sx = Math.max(0, (guideBox.left - offsetX) / scale);
  const sy = Math.max(0, (guideBox.top - offsetY) / scale);
  const sw = Math.min(vw - sx, guideBox.width / scale);
  const sh = Math.min(vh - sy, guideBox.height / scale);

  if (sw < 8 || sh < 8) return null;

  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export default function VinScanModal({ open, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const guideRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const liveBusyRef = useRef(false);
  const liveTickRef = useRef(0);
  const consensusRef = useRef(new VinScanConsensus());
  const barcodeDetectorRef = useRef(null);
  const isMobileRef = useRef(isMobileVinScanDevice());

  const [mode, setMode] = useState(MODES.SCAN);
  const [cameraError, setCameraError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [vinDraft, setVinDraft] = useState('');
  const [message, setMessage] = useState('');
  const [scanHint, setScanHint] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const resetState = useCallback(() => {
    setMode(MODES.INTRO);
    setCameraError('');
    setProcessing(false);
    setVinDraft('');
    setMessage('');
    setScanHint('');
    setScanProgress(0);
    setTorchOn(false);
    consensusRef.current.reset();
  }, []);

  const handleClose = useCallback(() => {
    stopMediaStream(streamRef);
    resetState();
    onClose?.();
  }, [onClose, resetState]);

  const confirmVin = useCallback((vin, { warning = '' } = {}) => {
    const nextVin = normalizeVinForLookupOrNull(vin) || normalizeVinOrNull(vin) || sanitizeVinInput(vin);
    if (!nextVin || nextVin.length < 11) return false;

    setVinDraft(nextVin);
    setMessage(warning);
    stopMediaStream(streamRef);
    setMode(MODES.CONFIRM);
    return true;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    stopMediaStream(streamRef);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Камера недоступна в этом браузере');
      setMode(MODES.ERROR);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: getCameraVideoConstraints(),
        audio: false,
      });
      streamRef.current = stream;
      const caps = await applyCameraEnhancements(stream);
      setTorchSupported(Boolean(caps.torchSupported));

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
    } catch (_) {
      setCameraError('Не удалось открыть камеру. Разрешите доступ или загрузите фото.');
      setMode(MODES.ERROR);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopMediaStream(streamRef);
      resetState();
      return undefined;
    }

    resetState();
    setEngineReady(false);
    barcodeDetectorRef.current = createVinBarcodeDetector();
    warmupVinOcrWorker().then(() => setEngineReady(true)).catch(() => setEngineReady(true));

    return () => {
      stopMediaStream(streamRef);
    };
  }, [open, resetState]);

  useEffect(() => {
    if (!open || mode !== MODES.SCAN) return undefined;
    startCamera();
    return () => {
      stopMediaStream(streamRef);
    };
  }, [open, mode, startCamera]);

  const applyOcrText = useCallback((text, { fromLive = false, allowPartial = false } = {}) => {
    const extracted = extractVinFromOcrText(text);
    let nextVin = extracted?.normalized || extracted?.raw || null;

    if (!nextVin && allowPartial) {
      const candidates = extractVinCandidatesFromOcrText(text);
      nextVin = candidates[0]?.normalized || candidates[0]?.raw || sanitizeVinInput(text);
    } else if (!nextVin) {
      nextVin = sanitizeVinInput(text);
    }

    if (!nextVin || nextVin.length < 11) {
      if (fromLive) return false;
      setMessage('Не удалось распознать VIN. Держите номер в рамке или введите вручную.');
      setVinDraft('');
      setMode(MODES.CONFIRM);
      return false;
    }

    if (fromLive) {
      const stableVin = normalizeVinForLookupOrNull(nextVin) || normalizeVinOrNull(nextVin);
      if (!stableVin) return false;
      const consensusVin = consensusRef.current.add(stableVin);
      setScanProgress(consensusRef.current.getProgress());
      if (!consensusVin) return false;
      return confirmVin(consensusVin);
    }

    const warning = extracted?.normalized
      ? ''
      : 'Проверьте VIN перед поиском — распознавание может содержать ошибки.';
    return confirmVin(nextVin, { warning });
  }, [confirmVin]);

  const tryBarcodeScan = useCallback(async (source) => {
    const detector = barcodeDetectorRef.current;
    if (!detector || !source) return false;
    const vin = await scanVinBarcodeFromSource(detector, source);
    if (!vin) return false;
    return confirmVin(vin);
  }, [confirmVin]);

  const processCapturedCanvas = useCallback(async (canvas, { profile = 'live' } = {}) => {
    const isManual = profile === 'manual';
    const quality = assessVinFrameQuality(canvas);
    if (!quality.ok) {
      setScanHint(quality.hint || 'Поднесите камеру ближе');
      if (profile === 'live' && isExtremelyPoorVinFrame(quality)) {
        return false;
      }
    } else {
      setScanHint(isManual ? 'Считываем рамку…' : '');
    }

    const text = await recognizeVinFromCanvas(canvas, { profile });
    return applyOcrText(text, { fromLive: profile === 'live', allowPartial: isManual });
  }, [applyOcrText]);

  useEffect(() => {
    if (!open || mode !== MODES.SCAN || !engineReady || processing) return undefined;

    const { liveIntervalMs, barcodeEveryNTicks } = getVinScanTiming();

    const tick = async () => {
      if (liveBusyRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      liveBusyRef.current = true;
      try {
        liveTickRef.current += 1;
        const canvas = captureFrame(video, guideRef.current);
        if (!canvas) return;

        const shouldScanBarcode = liveTickRef.current % barcodeEveryNTicks === 0;
        if (shouldScanBarcode && await tryBarcodeScan(canvas)) return;

        const quality = assessVinFrameQuality(canvas);
        if (!quality.ok) {
          setScanHint(quality.hint || 'Поднесите камеру ближе');
          setScanProgress(consensusRef.current.getProgress());
          if (isExtremelyPoorVinFrame(quality)) return;
        } else {
          setScanHint('');
        }

        await processCapturedCanvas(canvas, { profile: 'live' });
      } catch (_) {
        /* keep scanning */
      } finally {
        liveBusyRef.current = false;
      }
    };

    const id = window.setInterval(tick, liveIntervalMs);
    tick();
    return () => {
      window.clearInterval(id);
      liveBusyRef.current = false;
      liveTickRef.current = 0;
    };
  }, [open, mode, engineReady, processing, tryBarcodeScan, processCapturedCanvas]);

  const handleManualCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || processing) return;

    setProcessing(true);
    setScanHint('Считываем рамку…');
    try {
      const canvas = captureFrame(video, guideRef.current);
      if (!canvas) {
        setScanHint('Не удалось захватить кадр');
        return;
      }

      if (await tryBarcodeScan(canvas)) return;

      const ok = await processCapturedCanvas(canvas, { profile: 'manual' });
      if (!ok) {
        setMessage('Не удалось распознать VIN. Попробуйте другой угол или загрузите фото.');
        setVinDraft('');
        setMode(MODES.CONFIRM);
      }
    } catch (_) {
      setMessage('Не удалось обработать кадр.');
      setMode(MODES.ERROR);
    } finally {
      setProcessing(false);
    }
  }, [processing, tryBarcodeScan, processCapturedCanvas]);

  const handleToggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || !torchSupported) return;
    const next = !torchOn;
    const ok = await setTorchEnabled(stream, next);
    if (ok) setTorchOn(next);
  }, [torchOn, torchSupported]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProcessing(true);
    setMessage('');
    stopMediaStream(streamRef);

    try {
      const bitmap = await createImageBitmap(file);
      if (await tryBarcodeScan(bitmap)) {
        bitmap.close?.();
        return;
      }
      const text = await recognizeVinFromImageSource(bitmap);
      bitmap.close?.();
      applyOcrText(text);
    } catch (_) {
      setMessage('Не удалось обработать фото.');
      setMode(MODES.ERROR);
    } finally {
      setProcessing(false);
    }
  }, [applyOcrText, tryBarcodeScan]);

  const handleRetry = useCallback(() => {
    resetState();
    barcodeDetectorRef.current = createVinBarcodeDetector();
    warmupVinOcrWorker().then(() => setEngineReady(true)).catch(() => setEngineReady(true));
  }, [resetState]);

  const handleContinueToScan = useCallback(() => {
    setCameraError('');
    setMessage('');
    setMode(MODES.SCAN);
  }, []);

  const handleManualEntry = useCallback(() => {
    stopMediaStream(streamRef);
    setVinDraft('');
    setMessage('');
    setMode(MODES.CONFIRM);
  }, []);

  const handleContinue = useCallback(() => {
    const next = normalizeVinForLookupOrNull(vinDraft) || normalizeVinOrNull(vinDraft);
    if (!next) {
      setMessage('VIN должен содержать от 11 до 17 символов');
      return;
    }
    stopMediaStream(streamRef);
    onConfirm?.(next);
    resetState();
  }, [onConfirm, resetState, vinDraft]);

  const canContinue = Boolean(normalizeVinForLookupOrNull(vinDraft) || normalizeVinOrNull(vinDraft));

  const liveStatusText = liveScanStatusLabel({
    engineReady,
    processing,
    scanHint,
    scanProgress,
    mobile: isMobileRef.current,
  });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Распознать VIN"
      size="md"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          {mode === MODES.INTRO ? (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Отмена
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                С фото
              </Button>
              <Button variant="primary" onClick={handleContinueToScan}>
                Продолжить
              </Button>
            </>
          ) : null}
          {mode === MODES.SCAN ? (
            <>
              <Button variant="secondary" onClick={handleClose} disabled={processing}>
                Отмена
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
              >
                С фото
              </Button>
              <Button
                variant="primary"
                onClick={handleManualCapture}
                disabled={processing || !engineReady}
                loading={processing}
              >
                Считать сейчас
              </Button>
            </>
          ) : null}
          {mode === MODES.CONFIRM ? (
            <Button variant="secondary" onClick={handleClose} disabled={processing}>
              Отмена
            </Button>
          ) : null}
          {mode === MODES.ERROR ? (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Отмена
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Загрузить фото
              </Button>
              <Button variant="primary" onClick={handleRetry}>
                Попробовать снова
              </Button>
            </>
          ) : null}
        </div>
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {mode === MODES.INTRO ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h3l1.5-2h9L18 7h3a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Для распознавания VIN нужен доступ к камере</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li>Наведите номер в белую рамку на экране камеры</li>
                <li>Можно загрузить фото с номером кузова</li>
                <li>Перед поиском вы проверите и при необходимости исправите VIN</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {mode === MODES.SCAN ? (
        <div className="space-y-3">
          <div aria-live="polite" aria-atomic="true" className="sr-only">{liveStatusText}</div>
          <div className="relative min-h-[280px] overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              className="h-full min-h-[280px] w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-5">
              <div
                ref={guideRef}
                className="h-[5rem] w-[92%] max-w-xl rounded-md border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              />
            </div>
            {torchSupported ? (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-semibold shadow ${
                  torchOn ? 'bg-amber-400 text-gray-900' : 'bg-black/50 text-white'
                }`}
                aria-pressed={torchOn}
              >
                {torchOn ? 'Фонарик вкл.' : 'Фонарик'}
              </button>
            ) : null}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 px-4 text-center">
              <p className="text-xs font-medium text-white/90">{liveStatusText}</p>
              {scanProgress > 0.15 && scanProgress < 1 ? (
                <div className="mx-auto mt-2 h-1 max-w-xs overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/90 transition-all duration-300"
                    style={{ width: `${Math.round(scanProgress * 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Поместите номер в белую рамку. Поддерживаются штрихкод на наклейке и текстовый VIN — после распознавания можно проверить и исправить.
          </p>
          {cameraError ? <p className="text-sm text-red-600">{cameraError}</p> : null}
        </div>
      ) : null}

      {mode === MODES.CONFIRM ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Проверьте распознанный VIN и при необходимости исправьте:</p>
          <input
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-lg tracking-[0.2em] shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 max-md:min-h-11 max-md:text-base"
            value={vinDraft}
            onChange={(e) => setVinDraft(sanitizeVinInput(e.target.value))}
            maxLength={VIN_INPUT_MAX_LENGTH}
            autoCapitalize="characters"
            placeholder="VIN автомобиля"
          />
          <Button
            variant="primary"
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full"
          >
            Найти
          </Button>
          <Button
            variant="secondary"
            onClick={handleRetry}
            disabled={processing}
            className="w-full"
          >
            Заново
          </Button>
          {message ? <p className="text-sm text-amber-700">{message}</p> : null}
          {!canContinue ? (
            <p className="text-sm text-red-600">VIN должен содержать от 11 до 17 символов</p>
          ) : null}
        </div>
      ) : null}

      {mode === MODES.ERROR ? (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{cameraError || message || 'Не удалось распознать VIN'}</p>
          <p className="text-sm text-gray-600">
            Наведите номер в рамку ещё раз, загрузите фото или введите VIN вручную.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto"
            >
              Загрузить фото
            </Button>
            <Button
              variant="secondary"
              onClick={handleManualEntry}
              className="w-full sm:w-auto"
            >
              Ввести VIN вручную
            </Button>
          </div>
          {typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
            <p className="text-xs text-gray-500">
              Если доступ к камере запрещён: Настройки → Safari → Камера → Разрешить для этого сайта.
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
