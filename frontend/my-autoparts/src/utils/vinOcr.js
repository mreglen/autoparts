let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: () => {},
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '7', // single text line
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function terminateVinOcrWorker() {
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

/**
 * Enhance canvas contrast/grayscale for embossed VIN plates.
 */
export function preprocessVinCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const boosted = gray < 128 ? Math.max(0, gray - 35) : Math.min(255, gray + 35);
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function recognizeVinFromCanvas(sourceCanvas) {
  const worker = await getWorker();
  const canvas = preprocessVinCanvas(sourceCanvas);
  const { data } = await worker.recognize(canvas);
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
  return recognizeVinFromCanvas(canvas);
}
