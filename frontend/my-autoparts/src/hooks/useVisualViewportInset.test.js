import { computeVisualViewportInset, KEYBOARD_INSET_THRESHOLD_PX } from './useVisualViewportInset';

describe('computeVisualViewportInset', () => {
  it('ignores small browser-chrome gaps', () => {
    expect(computeVisualViewportInset(800, 760, 0)).toBe(0);
    expect(computeVisualViewportInset(800, 800 - (KEYBOARD_INSET_THRESHOLD_PX - 1), 0)).toBe(0);
  });

  it('treats a large gap as the keyboard', () => {
    expect(computeVisualViewportInset(800, 500, 0)).toBe(300);
    expect(computeVisualViewportInset(800, 500, 20)).toBe(280);
  });
});
