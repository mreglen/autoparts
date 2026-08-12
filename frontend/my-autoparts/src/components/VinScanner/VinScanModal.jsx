import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import {
  normalizeVinOrNull,
  sanitizeVinInput,
  VIN_INPUT_MAX_LENGTH,
} from '../../utils/laximoVin';
import { extractVinFromOcrText } from '../../utils/extractVinFromOcrText';
import {
  recognizeVinFromCanvas,
  recognizeVinFromImageSource,
  terminateVinOcrWorker,
} from '../../utils/vinOcr';

const MODES = {
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

  const container = videoEl.parentElement;
  if (!container) return null;

  const videoBox = videoEl.getBoundingClientRect();
  const guideBox = guideRect?.getBoundingClientRect?.() || videoBox;

  const scaleX = vw / videoBox.width;
  const scaleY = vh / videoBox.height;

  const sx = Math.max(0, (guideBox.left - videoBox.left) * scaleX);
  const sy = Math.max(0, (guideBox.top - videoBox.top) * scaleY);
  const sw = Math.min(vw - sx, guideBox.width * scaleX);
  const sh = Math.min(vh - sy, guideBox.height * scaleY);

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

  const [mode, setMode] = useState(MODES.SCAN);
  const [cameraError, setCameraError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [vinDraft, setVinDraft] = useState('');
  const [message, setMessage] = useState('');

  const resetState = useCallback(() => {
    setMode(MODES.SCAN);
    setCameraError('');
    setProcessing(false);
    setVinDraft('');
    setMessage('');
  }, []);

  const handleClose = useCallback(() => {
    stopMediaStream(streamRef);
    resetState();
    onClose?.();
  }, [onClose, resetState]);

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
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
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
    startCamera();

    return () => {
      stopMediaStream(streamRef);
    };
  }, [open, resetState, startCamera]);

  useEffect(() => () => {
    stopMediaStream(streamRef);
    terminateVinOcrWorker();
  }, []);

  const processCanvas = useCallback(async (canvas) => {
    setProcessing(true);
    setMessage('');
    try {
      const text = await recognizeVinFromCanvas(canvas);
      const extracted = extractVinFromOcrText(text);
      const nextVin = extracted?.normalized || extracted?.raw || sanitizeVinInput(text);

      if (!nextVin) {
        setMessage('Не удалось распознать VIN. Попробуйте переснять или введите вручную.');
        setVinDraft('');
        setMode(MODES.CONFIRM);
        return;
      }

      setVinDraft(nextVin);
      if (!extracted?.normalized) {
        setMessage('Проверьте VIN перед поиском — распознавание может содержать ошибки.');
      }
      setMode(MODES.CONFIRM);
    } catch (_) {
      setMessage('Ошибка распознавания. Попробуйте ещё раз или загрузите другое фото.');
      setMode(MODES.ERROR);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = captureFrame(video, guideRef.current);
    if (!canvas) {
      setMessage('Не удалось сделать снимок');
      setMode(MODES.ERROR);
      return;
    }
    stopMediaStream(streamRef);
    await processCanvas(canvas);
  }, [processCanvas]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProcessing(true);
    setMessage('');
    stopMediaStream(streamRef);

    try {
      const bitmap = await createImageBitmap(file);
      const text = await recognizeVinFromImageSource(bitmap);
      bitmap.close?.();
      const extracted = extractVinFromOcrText(text);
      const nextVin = extracted?.normalized || extracted?.raw || sanitizeVinInput(text);

      if (!nextVin) {
        setMessage('Не удалось распознать VIN на фото.');
        setVinDraft('');
        setMode(MODES.CONFIRM);
        return;
      }

      setVinDraft(nextVin);
      if (!extracted?.normalized) {
        setMessage('Проверьте VIN перед поиском — распознавание может содержать ошибки.');
      }
      setMode(MODES.CONFIRM);
    } catch (_) {
      setMessage('Не удалось обработать фото.');
      setMode(MODES.ERROR);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    resetState();
    startCamera();
  }, [resetState, startCamera]);

  const handleContinue = useCallback(() => {
    const next = normalizeVinOrNull(vinDraft);
    if (!next) {
      setMessage('VIN должен содержать от 11 до 17 символов');
      return;
    }
    stopMediaStream(streamRef);
    onConfirm?.(next);
    resetState();
  }, [onConfirm, resetState, vinDraft]);

  const canContinue = Boolean(normalizeVinOrNull(vinDraft));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Распознать VIN"
      size="md"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
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
                Загрузить фото
              </Button>
              <Button variant="primary" onClick={handleCapture} loading={processing}>
                Сфотографировать
              </Button>
            </>
          ) : null}
          {mode === MODES.CONFIRM ? (
            <>
              <Button variant="secondary" onClick={handleRetry} disabled={processing}>
                Переснять
              </Button>
              <Button variant="primary" onClick={handleContinue} disabled={!canContinue}>
                Продолжить
              </Button>
            </>
          ) : null}
          {mode === MODES.ERROR ? (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Закрыть
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
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

      {mode === MODES.SCAN ? (
        <div className="space-y-3">
          <div className="relative min-h-[240px] overflow-hidden rounded-xl border border-gray-200 bg-black">
            <video
              ref={videoRef}
              className="h-full min-h-[240px] w-full object-cover"
              playsInline
              muted
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div
                ref={guideRef}
                className="h-16 w-[88%] rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Наведите камеру на VIN-номер на табличке или стикере и нажмите «Сфотографировать».
          </p>
          {cameraError ? <p className="text-sm text-red-600">{cameraError}</p> : null}
        </div>
      ) : null}

      {mode === MODES.CONFIRM ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Проверьте распознанный VIN и при необходимости исправьте:</p>
          <input
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-lg tracking-[0.2em] shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            value={vinDraft}
            onChange={(e) => setVinDraft(sanitizeVinInput(e.target.value))}
            maxLength={VIN_INPUT_MAX_LENGTH}
            autoCapitalize="characters"
            placeholder="VIN автомобиля"
          />
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
            Можно загрузить фото с галереи или попробовать снова с лучшим освещением.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
