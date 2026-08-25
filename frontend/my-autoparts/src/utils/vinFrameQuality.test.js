import { assessVinImageMetrics } from './vinFrameQuality';

function makeImageData(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gray = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('assessVinImageMetrics', () => {
  it('flags too dark frames', () => {
    const data = makeImageData(120, 40, () => 10);
    const result = assessVinImageMetrics(data, 120, 40);
    expect(result.ok).toBe(false);
    expect(result.hint).toMatch(/темно/i);
  });

  it('accepts reasonable contrast frame', () => {
    const data = makeImageData(160, 48, (x, y) => {
      if (y >= 12 && y <= 32 && x >= 8 && x <= 152) return 20;
      return 230;
    });
    const result = assessVinImageMetrics(data, 160, 48);
    expect(result.ok).toBe(true);
  });
});
