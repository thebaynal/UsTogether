import { useCallback, useSyncExternalStore } from 'react';
import type { ThemeKey } from '@/types/domain';
import { readCachedTheme, subscribeThemes } from './themeCache';

export function useSpaceTheme(spaceId: string, fallback: ThemeKey | null) {
  const snapshot = useCallback(() => readCachedTheme(spaceId), [spaceId]);
  const key = useSyncExternalStore(subscribeThemes, snapshot, () => undefined);
  return key === undefined ? fallback : key;
}
