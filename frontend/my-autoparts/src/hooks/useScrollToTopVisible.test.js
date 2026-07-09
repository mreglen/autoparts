import { renderHook, act } from '@testing-library/react';
import { useScrollToTopVisible } from './useScrollToTopVisible';

describe('useScrollToTopVisible', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  it('is hidden at top of page', () => {
    const { result } = renderHook(() => useScrollToTopVisible(320));
    expect(result.current).toBe(false);
  });

  it('becomes visible after scrolling past threshold', () => {
    const { result } = renderHook(() => useScrollToTopVisible(320));

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe(true);
  });

  it('hides again when scrolled back to top', () => {
    const { result } = renderHook(() => useScrollToTopVisible(320));

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);

    act(() => {
      window.scrollY = 0;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(false);
  });
});
