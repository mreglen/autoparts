import { renderHook, act } from '@testing-library/react';
import useNetworkStatus from '../hooks/useNetworkStatus';

describe('useNetworkStatus', () => {
  it('updates when browser fires offline/online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.online).toBe(true);

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.offline).toBe(true);

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.online).toBe(true);
  });
});
