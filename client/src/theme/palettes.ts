import type { SpaceKind, ThemeKey } from '@/types/domain';

export type Palette = {
  key: ThemeKey;
  label: string;
  background: string;
  surface: string;
  surfaceSoft: string;
  primary: string;
  primaryPressed: string;
  accent: string;
  ink: string;
  muted: string;
  border: string;
  danger: string;
  shadow: string;
};

export const palettes: Record<ThemeKey, Palette> = {
  rose: {
    key: 'rose', label: 'Rose cloud', background: '#FFF7F7', surface: '#FFFFFF', surfaceSoft: '#FFE9EC',
    primary: '#D97289', primaryPressed: '#B9506B', accent: '#F3B9C6', ink: '#39252D', muted: '#806C73',
    border: '#F2D5DB', danger: '#B84353', shadow: '#D98A9B'
  },
  lavender: {
    key: 'lavender', label: 'Lilac daydream', background: '#FAF8FF', surface: '#FFFFFF', surfaceSoft: '#EEE8FF',
    primary: '#8471C4', primaryPressed: '#6958A4', accent: '#C9BDF0', ink: '#2F2940', muted: '#716B84',
    border: '#E2DBF5', danger: '#B84353', shadow: '#9988D4'
  },
  peach: {
    key: 'peach', label: 'Peach picnic', background: '#FFFAF6', surface: '#FFFFFF', surfaceSoft: '#FFEBDD',
    primary: '#C76D4F', primaryPressed: '#A45139', accent: '#F1C29E', ink: '#3C2C27', muted: '#806E66',
    border: '#F2DECF', danger: '#B84353', shadow: '#D98F6F'
  },
  mint: {
    key: 'mint', label: 'Mint meadow', background: '#F6FCF8', surface: '#FFFFFF', surfaceSoft: '#E2F4E9',
    primary: '#4D8A68', primaryPressed: '#3B6B50', accent: '#A8D7B8', ink: '#24372B', muted: '#68786E',
    border: '#D6EBDD', danger: '#B84353', shadow: '#75B58D'
  },
  sky: {
    key: 'sky', label: 'Bluebird', background: '#F6FAFF', surface: '#FFFFFF', surfaceSoft: '#E4F0FF',
    primary: '#527BAF', primaryPressed: '#3D628F', accent: '#B7D2F0', ink: '#253448', muted: '#68778A',
    border: '#D8E5F3', danger: '#B84353', shadow: '#83A7D1'
  }
};

export const defaultThemeByKind: Record<SpaceKind, ThemeKey> = {
  couple: 'rose',
  group: 'peach',
  team: 'sky'
};

export function getPalette(kind: SpaceKind, override: ThemeKey | null): Palette {
  return palettes[override ?? defaultThemeByKind[kind]];
}

export const spaceKindLabels: Record<SpaceKind, string> = {
  couple: 'Couple',
  group: 'Friends & family',
  team: 'Team'
};
