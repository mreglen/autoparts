import { renderHook, act } from '@testing-library/react';
import { useScrollToTopVisible } from './useScrollToTopVisible';

describe('useScrollToTopVisible', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
    document.documentElement.classList.remove('mobile-shell', 'pwa-standalone');
    const root = document.getElementById('root') || document.createElement('div');
    root.id = 'root';
    if (!document.body.contains(root)) {
      document.body.appendChild(root);
    }
    root.scrollTop = 0;
  });

  it('is hidden at top of page', () => {
    const { result } = renderHook(() => useScrollToTopVisible(240));
    expect(result.current).toBe(false);
  });

  it('becomes visible after window scroll past threshold', () => {
    const { result } = renderHook(() => useScrollToTopVisible(240));

    act(() => {
      window.scrollY = 400;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe(true);
  });

  it('becomes visible when #root scrolls on mobile shell', () => {
    document.documentElement.classList.add('mobile-shell');
    const root = document.getElementById('root');
    const { result } = renderHook(() => useScrollToTopVisible(240));

    act(() => {
      root.scrollTop = 500;
      root.dispatchEvent(new Event('scroll'));
    });

    expect(result.current).toBe(true);
  });
});
