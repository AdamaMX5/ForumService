import { useCallback, useEffect, useState } from 'react';

// Reads the URL-Contract from spec section 12: ?thema=<id>&fokus=<id>&kommentare=<id>.
// Deliberately reads window.location.search directly instead of depending on react-router-dom,
// so <ForumThread>/<forum-thread> stay embeddable in host apps/pages that don't use that router
// (TYPO3/PHP web component, plain FreiSchule pages, ...).

export interface DeepLinkParams {
  thema: string | null;
  fokus: string | null;
  kommentare: string | null;
}

function readParams(): DeepLinkParams {
  if (typeof window === 'undefined') return { thema: null, fokus: null, kommentare: null };
  const search = new URLSearchParams(window.location.search);
  return {
    thema: search.get('thema'),
    fokus: search.get('fokus'),
    kommentare: search.get('kommentare'),
  };
}

export function useDeepLinkParams(): [DeepLinkParams, (patch: Partial<DeepLinkParams>) => void] {
  const [params, setParams] = useState<DeepLinkParams>(() => readParams());

  useEffect(() => {
    const onPopState = () => setParams(readParams());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const update = useCallback((patch: Partial<DeepLinkParams>) => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    const next = `${window.location.pathname}?${search.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', next);
    setParams(readParams());
  }, []);

  return [params, update];
}
