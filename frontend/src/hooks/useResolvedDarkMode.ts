import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

function prefersDarkNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves whether <ForumThread>/<forum-thread> should render dark - see tailwind.config.js for
 * why this is needed: darkMode is 'class' here (not Tailwind's default 'media'), because a host
 * app's own dark-mode toggle is virtually always a class further up the DOM (e.g. <html
 * class="dark">), not the OS-level prefers-color-scheme setting a 'media' strategy is limited to.
 *
 * `theme` lets a host that already tracks its own theme state hand it over explicitly - mirrors
 * the `externalAuth` prop for auth state. Default `'auto'` keeps today's OS-preference behavior by
 * applying a `dark` class on the widget's own root element to match prefers-color-scheme, which
 * also means a host's own ancestor `.dark` class already works for free (Tailwind's class strategy
 * matches any ancestor, not just an immediate wrapper) without a host having to pass `theme` at
 * all. This resolves only the widget's own OS-detection, though - it cannot force `'light'`
 * against an ancestor `.dark` class the widget happens to be mounted inside (plain CSS cascade;
 * see the `theme` prop doc on ForumThreadProps for the resulting caveat).
 */
export function useResolvedDarkMode(theme: ThemeMode = 'auto'): boolean {
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow);

  useEffect(() => {
    if (theme !== 'auto') return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    // Resync immediately, not just on the next 'change' event - covers both a `theme` transition
    // back into 'auto' (the state captured while pinned to 'dark'/'light' would otherwise be
    // stale) and the OS preference having changed while no listener was attached.
    setPrefersDark(mql.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [theme]);

  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return prefersDark;
}
