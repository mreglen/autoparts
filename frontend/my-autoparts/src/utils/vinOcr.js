let workerPromise = null;
let idleTimer = null;

const IDLE_TERMINATE_MS = 120000;
const MIN_OCR_WIDTH = 1100;
const MAX_OCR_WIDTH = 1600;

function bumpIdleTimer() {
  if (typeof window === 'undefined') return;
  if (idleTimer) window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    terminateVinOcrWorker();
  }, IDLE_TERMINATE_MS);
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7',
      });
      return worker;
    })();
  }
  bumpIdleTimer();
  return workerPromise;
}

export async function warmupVinOcrWorker() {
  try {
    await getWorker();
  } catch (_) {
    /* ignore */
  }
}

export async function terminateVinOcrWorker() {
  if (idleTimer) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch (_) {
    /* ignore */
  } finally {
    workerPromise = null;
  }
}

function otsuThreshold(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t += 1) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVar) {
      maxVar = variance;
      threshold = t;
    }
  }
  return threshold;
}

function removeHorizontalFormLines(data, width, height) {
  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4] < 90) dark += 1;
    }
    const ratio = dark / width;
    if (ratio < 0.45 || ratio > 0.97) continue;
    const prevY = Math.max(0, y - 1);
    const nextY = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const p = (prevY * width + x) * 4;
      const n = (nextY * width + x) * 4;
      const fill = Math.max(data[p], data[n], 245);
      data[i] = fill;
      data[i + 1] = fill;
      data[i + 2] = fill;
    }
  }
}

export function preprocessVinCanvas(sourceCanvas) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) return sourceCanvas;

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const scale = Math.min(MAX_OCR_WIDTH / srcW, Math.max(MIN_OCR_WIDTH / srcW, 2.4));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const hist = new Uint32Array(256);
  const gray = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const value = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    gray[p] = value;
    hist[value] += 1;
  }

  const threshold = otsuThreshold(hist, width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    const bin = gray[p] < threshold ? 0 : 255;
    data[i] = bin;
    data[i + 1] = bin;
    data[i + 2] = bin;
  }

  removeHorizontalFormLines(data, width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function cropVinBand(sourceCanvas, { yRatio = 0.35, heightRatio = 0.3 } = {}) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) return sourceCanvas;
  const y = Math.max(0, Math.round(sourceCanvas.height * yRatio));
  const h = Math.max(24, Math.round(sourceCanvas.height * heightRatio));
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = Math.min(h, sourceCanvas.height - y);
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.drawImage(
    sourceCanvas,
    0,
    y,
    sourceCanvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export async function recognizeVinFromCanvas(sourceCanvas) {
  const worker = await getWorker();
  const canvas = preprocessVinCanvas(sourceCanvas);
  const { data } = await worker.recognize(canvas);
  bumpIdleTimer();
  return data?.text || '';
}

export async function recognizeVinFromImageSource(imageSource) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  let width = imageSource.width || imageSource.videoWidth || 0;
  let height = imageSource.height || imageSource.videoHeight || 0;
  if (!width || !height) {
    throw new Error('Invalid image dimensions');
  }

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imageSource, 0, 0, width, height);

  const bands = [
    cropVinBand(canvas, { yRatio: 0.35, heightRatio: 0.3 }),
    cropVinBand(canvas, { yRatio: 0.15, heightRatio: 0.28 }),
    canvas,
  ];

  let lastText = '';
  for (const band of bands) {
    lastText = await recognizeVinFromCanvas(band);
    if (lastText && lastText.replace(/[^A-Za-z0-9]/g, '').length >= 11) {
      return lastText;
    }
  }
  return lastText;
}
