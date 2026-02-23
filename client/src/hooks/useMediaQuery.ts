/**
 * useMediaQuery.ts — Responsive media query hooks
 */

import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Convenience hook: true when viewport width <= 768px.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}
