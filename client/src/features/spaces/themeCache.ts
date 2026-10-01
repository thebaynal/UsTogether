import type { ThemeKey } from '@/types/domain';

const themes = new Map<string, ThemeKey | null>();
const revisions = new Map<string, number>();
const listeners = new Set<() => void>();

export function subscribeThemes(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const readCachedTheme = (spaceId: string) => themes.get(spaceId);

export function beginThemeRead(spaceId: string) {
  const revision = (revisions.get(spaceId) ?? 0) + 1;
  revisions.set(spaceId, revision);
  return revision;
}

export function rememberSpaceTheme(spaceId: string, key: ThemeKey | null, revision?: number) {
  if (revision !== undefined && revisions.get(spaceId) !== revision) return;
  if (revision === undefined) beginThemeRead(spaceId);
  if (themes.has(spaceId) && themes.get(spaceId) === key) return;
  themes.set(spaceId, key);
  listeners.forEach((listener) => listener());
}
