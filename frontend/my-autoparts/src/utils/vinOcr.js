let workerPromise = null;
let idleTimer = null;

const IDLE_TERMINATE_MS = 120000;
const MIN_OCR_WIDTH = 1200;
const MAX_OCR_WIDTH = 1800;
/** Include lowercase: VINs on screens/docs are often not uppercase. I/O/Q stay so we can map them to 1/0. */
const VIN_OCR_WHITELIST = 'ABCDEFGHJKLMNPRSTUVWXYZabcdefghjklmnprstuvwxyzIOQioq0123456789';
const DEFAULT_PSM = '7';
const FALLBACK_PSM = '13';
const BLOCK_PSM = '6';

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
        tessedit_char_whitelist: VIN_OCR_WHITELIST,
        tessedit_pageseg_mode: DEFAULT_PSM,
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

function canvasMeanGray(data) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
    count += 1;
  }
  return count ? sum / count : 128;
}

function removeHorizontalFormLines(data, width, height) {
  // Single-line VIN crops and STS rows look like form lines — do not strip them.
  if (height < 200 || width / Math.max(height, 1) > 4) return;

  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4] < 110) dark += 1;
    }
    const ratio = dark / width;
    if (ratio < 0.62 || ratio > 0.98) continue;
    const prevY = Math.max(0, y - 1);
    const nextY = Math.min(height - 1, y + 1);
    let neighborDark = 0;
    for (let x = 0; x < width; x += 1) {
      if (data[(prevY * width + x) * 4] < 110) neighborDark += 1;
      if (data[(nextY * width + x) * 4] < 110) neighborDark += 1;
    }
    if (neighborDark / (width * 2) > 0.28) continue;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const p = (prevY * width + x) * 4;
      const n = (nextY * width + x) * 4;
      const fill = Math.max(data[p], data[n], 250);
      data[i] = fill;
      data[i + 1] = fill;
      data[i + 2] = fill;
    }
  }
}

function copyCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function padCanvas(sourceCanvas, pad = 18) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width + pad * 2;
  canvas.height = sourceCanvas.height + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceCanvas, pad, pad);
  return canvas;
}

function invertCanvas(sourceCanvas) {
  const canvas = copyCanvas(sourceCanvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function reduceScreenMoiré(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (w < 40 || h < 12) return sourceCanvas;
  const small = document.createElement('canvas');
  small.width = Math.max(8, Math.round(w * 0.5));
  small.height = Math.max(8, Math.round(h * 0.5));
  const sctx = small.getContext('2d');
  if (!sctx) return sourceCanvas;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(sourceCanvas, 0, 0, small.width, small.height);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  if (!octx) return sourceCanvas;
  octx.imageSmoothingEnabled = true;
  octx.drawImage(small, 0, 0, w, h);
  return out;
}

function upscaleGrayCanvas(sourceCanvas) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) return sourceCanvas;

  const denoised = reduceScreenMoiré(sourceCanvas);
  const srcW = denoised.width;
  const srcH = denoised.height;
  const scale = Math.min(MAX_OCR_WIDTH / srcW, Math.max(MIN_OCR_WIDTH / srcW, 2.6));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(denoised, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const stretched = Math.round(((gray - min) / span) * 255);
    data[i] = stretched;
    data[i + 1] = stretched;
    data[i + 2] = stretched;
  }
  removeHorizontalFormLines(data, width, height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function binarizeCanvas(sourceCanvas) {
  const canvas = copyCanvas(sourceCanvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) hist[data[i]] += 1;
  const threshold = otsuThreshold(hist, canvas.width * canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    const bin = data[i] < threshold ? 0 : 255;
    data[i] = bin;
    data[i + 1] = bin;
    data[i + 2] = bin;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function rotateCanvas(sourceCanvas, degrees = 90) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) return sourceCanvas;
  const swap = degrees === 90 || degrees === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? sourceCanvas.height : sourceCanvas.width;
  canvas.height = swap ? sourceCanvas.width : sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2);
  return canvas;
}

export function preprocessVinCanvas(sourceCanvas) {
  return padCanvas(upscaleGrayCanvas(sourceCanvas));
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

function compactLen(text) {
  return String(text || '').replace(/[^A-Za-z0-9]/g, '').length;
}

function pickLongerText(a, b) {
  return compactLen(b) > compactLen(a) ? b : a;
}

async function recognizePrepared(worker, canvas) {
  const { data } = await worker.recognize(canvas);
  return data?.text || '';
}

async function recognizeWithPsm(worker, canvas, psm) {
  await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
  const text = await recognizePrepared(worker, canvas);
  await worker.setParameters({ tessedit_pageseg_mode: DEFAULT_PSM });
  return text;
}

export async function recognizeVinFromCanvas(sourceCanvas, { thorough = false, tryPsm13 = false } = {}) {
  const worker = await getWorker();
  const gray = preprocessVinCanvas(sourceCanvas);
  const mean = (() => {
    const ctx = gray.getContext('2d');
    if (!ctx) return 128;
    const { data } = ctx.getImageData(0, 0, gray.width, gray.height);
    return canvasMeanGray(data);
  })();

  const first = mean < 118 ? invertCanvas(gray) : gray;
  let text = await recognizePrepared(worker, first);
  bumpIdleTimer();
  if (compactLen(text) >= 11 && !thorough) return text;

  const second = mean < 118 ? gray : invertCanvas(gray);
  text = pickLongerText(text, await recognizePrepared(worker, second));
  if (compactLen(text) >= 17 && !thorough) {
    bumpIdleTimer();
    return text;
  }

  text = pickLongerText(text, await recognizePrepared(worker, binarizeCanvas(first)));
  bumpIdleTimer();

  if (thorough && compactLen(text) < 17) {
    text = pickLongerText(text, await recognizePrepared(worker, binarizeCanvas(second)));
    bumpIdleTimer();
  }

  if ((thorough || tryPsm13) && compactLen(text) < 17) {
    text = pickLongerText(text, await recognizeWithPsm(worker, first, FALLBACK_PSM));
    bumpIdleTimer();
  }

  if (thorough && compactLen(text) < 17) {
    text = pickLongerText(text, await recognizeWithPsm(worker, first, BLOCK_PSM));
    bumpIdleTimer();
  }

  return text;
}

export async function recognizeVinFromCanvasThorough(sourceCanvas) {
  const variants = [
    sourceCanvas,
    cropVinBand(sourceCanvas, { yRatio: 0.08, heightRatio: 0.32 }),
    cropVinBand(sourceCanvas, { yRatio: 0.35, heightRatio: 0.3 }),
    rotateCanvas(sourceCanvas, 90),
    rotateCanvas(sourceCanvas, 270),
  ];

  let bestText = '';
  for (const variant of variants) {
    const text = await recognizeVinFromCanvas(variant, { thorough: true, tryPsm13: true });
    bestText = pickLongerText(bestText, text);
    if (compactLen(bestText) >= 17) break;
  }
  return bestText;
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

  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(imageSource, 0, 0, width, height);

  const bands = [
    canvas,
    cropVinBand(canvas, { yRatio: 0.14, heightRatio: 0.1 }),
    cropVinBand(canvas, { yRatio: 0.22, heightRatio: 0.1 }),
    cropVinBand(canvas, { yRatio: 0.38, heightRatio: 0.1 }),
    cropVinBand(canvas, { yRatio: 0.44, heightRatio: 0.12 }),
    cropVinBand(canvas, { yRatio: 0.35, heightRatio: 0.3 }),
    cropVinBand(canvas, { yRatio: 0.12, heightRatio: 0.28 }),
  ];

  let bestText = '';
  for (const band of bands) {
    bestText = pickLongerText(bestText, await recognizeVinFromCanvas(band, { thorough: true, tryPsm13: true }));
    if (compactLen(bestText) >= 17) break;
  }
  return bestText;
}
