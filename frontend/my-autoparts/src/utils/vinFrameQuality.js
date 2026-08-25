const MIN_BRIGHTNESS = 42;
const MAX_BRIGHTNESS = 228;
const MIN_CONTRAST = 22;
const MIN_SHARPNESS = 18;

function grayAt(data, width, x, y) {
  const i = (y * width + x) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

function laplacianVariance(data, width, height) {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const center = grayAt(data, width, x, y);
      const lap =
        -4 * center
        + grayAt(data, width, x - 1, y)
        + grayAt(data, width, x + 1, y)
        + grayAt(data, width, x, y - 1)
        + grayAt(data, width, x, y + 1);
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/**
 * @returns {{ ok: boolean, hint: string|null, brightness: number, contrast: number, sharpness: number }}
 */
export function assessVinImageMetrics(data, width, height) {
  if (!data?.length || !width || !height) {
    return { ok: false, hint: 'Поднесите камеру ближе', brightness: 0, contrast: 0, sharpness: 0 };
  }

  let brightnessSum = 0;
  let min = 255;
  let max = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 16) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    brightnessSum += gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
    count += 1;
  }

  const brightness = count ? brightnessSum / count : 128;
  const contrast = max - min;
  const sharpness = laplacianVariance(data, width, height);

  if (brightness < MIN_BRIGHTNESS) {
    return { ok: false, hint: 'Слишком темно — добавьте света или включите фонарик', brightness, contrast, sharpness };
  }
  if (brightness > MAX_BRIGHTNESS) {
    return { ok: false, hint: 'Слишком ярко — уберите блик или измените угол', brightness, contrast, sharpness };
  }
  if (contrast < MIN_CONTRAST) {
    return { ok: false, hint: 'Мало контраста — поднесите ближе к номеру', brightness, contrast, sharpness };
  }
  if (sharpness < MIN_SHARPNESS) {
    return { ok: false, hint: 'Подождите автофокус или держите камеру ровнее', brightness, contrast, sharpness };
  }

  return { ok: true, hint: null, brightness, contrast, sharpness };
}

export function assessVinFrameQuality(canvas) {
  if (!canvas?.width || !canvas?.height) {
    return { ok: false, hint: 'Поднесите камеру ближе', brightness: 0, contrast: 0, sharpness: 0 };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { ok: false, hint: null, brightness: 128, contrast: 0, sharpness: 0 };
  }

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  return assessVinImageMetrics(data, width, height);
}
