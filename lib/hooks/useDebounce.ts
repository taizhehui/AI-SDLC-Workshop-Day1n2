'use client';

import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly-changing value (PRP 08).
 *
 * The search input binds to the raw value for instant visual feedback while filtering runs
 * against the debounced value, so typing never re-filters the whole list per keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
