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
    key: 'rose', label: 'Rose letters', background: '#FAF4E9', surface: '#FFFCF5', surfaceSoft: '#F3D9D9',
    primary: '#A44761', primaryPressed: '#793047', accent: '#EAB0AD', ink: '#392632', muted: '#75616B',
    border: '#DFC9C3', danger: '#A73143', shadow: '#A87880'
  },
  lavender: {
    key: 'lavender', label: 'Lilac daydream', background: '#F5F0E9', surface: '#FFFCF7', surfaceSoft: '#E2D9F0',
    primary: '#705299', primaryPressed: '#523971', accent: '#BDA8D9', ink: '#35293D', muted: '#716077',
    border: '#D5C8DD', danger: '#A73143', shadow: '#9E8AAA'
  },
  peach: {
    key: 'peach', label: 'Peach picnic', background: '#FBF1E3', surface: '#FFFCF4', surfaceSoft: '#F5D9BE',
    primary: '#9D4F32', primaryPressed: '#763820', accent: '#E8B38D', ink: '#3B2929', muted: '#785F55',
    border: '#E2CBB4', danger: '#A73143', shadow: '#B68B72'
  },
  mint: {
    key: 'mint', label: 'Mint meadow', background: '#F0F3E8', surface: '#FCFDF4', surfaceSoft: '#D6E4CE',
    primary: '#456849', primaryPressed: '#304B34', accent: '#A9C59C', ink: '#2D332D', muted: '#61715E',
    border: '#C7D5BD', danger: '#A73143', shadow: '#8DAB81'
  },
  sky: {
    key: 'sky', label: 'Blue hour', background: '#EFF2ED', surface: '#FBFCF6', surfaceSoft: '#D7E3E8',
    primary: '#486780', primaryPressed: '#324B61', accent: '#AAC5D2', ink: '#29323B', muted: '#60707B',
    border: '#C6D5D9', danger: '#A73143', shadow: '#87A5B3'
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
