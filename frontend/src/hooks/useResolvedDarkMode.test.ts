import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResolvedDarkMode, type ThemeMode } from './useResolvedDarkMode';

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
  } as unknown as MediaQueryList;

  vi.spyOn(window, 'matchMedia').mockReturnValue(mql);

  return {
    fireChange(matches: boolean) {
      act(() => {
        listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
      });
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useResolvedDarkMode', () => {
  it('defaults to "auto" and reflects the current prefers-color-scheme on mount', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useResolvedDarkMode());
    expect(result.current).toBe(true);
  });

  it('"auto" updates when prefers-color-scheme changes after mount', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useResolvedDarkMode('auto'));
    expect(result.current).toBe(false);

    media.fireChange(true);
    expect(result.current).toBe(true);
  });

  it('"dark" forces true regardless of prefers-color-scheme', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useResolvedDarkMode('dark'));
    expect(result.current).toBe(true);
  });

  it('"light" forces false regardless of prefers-color-scheme', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useResolvedDarkMode('light'));
    expect(result.current).toBe(false);
  });

  it('does not keep listening for OS changes once pinned to an explicit theme', () => {
    const media = mockMatchMedia(false);
    renderHook(() => useResolvedDarkMode('dark'));
    expect(media.listenerCount()).toBe(0);
  });

  it('resyncs to the current OS preference immediately when theme transitions back to "auto"', () => {
    // OS is actually dark the whole time, but no listener is attached while pinned to 'light' -
    // the resolved value must not stay stuck at the value captured before/during the pin once the
    // host switches back to 'auto' (regression: previously only a subsequent 'change' event would
    // pick this up, never a resync on the 'auto' transition itself).
    mockMatchMedia(true);
    const { result, rerender } = renderHook(({ theme }: { theme: ThemeMode }) => useResolvedDarkMode(theme), {
      initialProps: { theme: 'light' },
    });
    expect(result.current).toBe(false);

    rerender({ theme: 'auto' });
    expect(result.current).toBe(true);
  });
});
