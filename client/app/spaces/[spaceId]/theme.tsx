import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { getSpace, setSpaceTheme } from '@/features/spaces/spaceService';
import type { Space, ThemeKey } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels } from '@/theme/palettes';

const options: ThemeKey[] = ['rose', 'lavender', 'peach', 'mint', 'sky'];

export default function ThemeScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [selected, setSelected] = useState<ThemeKey>('rose');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSpace(spaceId).then((nextSpace) => {
      if (!active) return;
      setSpace(nextSpace);
      setSelected(getPalette(nextSpace.kind, nextSpace.themeKey).key);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Space theme could not be loaded.'))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [spaceId]);

  const palette = space ? getPalette(space.kind, selected) : palettes.rose;

  async function save() {
    if (!space) return;
    setIsSaving(true);
    setError(null);
    try {
      await setSpaceTheme(space.id, selected);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Theme could not be saved.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  Back to timeline</Text></Pressable>
      <BrandHeader palette={palette} eyebrow={space ? spaceKindLabels[space.kind] : 'Space settings'} title="Pick your colors" subtitle="Every member can choose the palette that feels most like your space." />
      {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
      <View style={styles.paletteList}>
        {options.map((key) => {
          const option = palettes[key];
          const active = selected === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setSelected(key)}
              style={[styles.paletteCard, { backgroundColor: option.surface, borderColor: active ? option.primary : option.border, borderWidth: active ? 2 : 1 }]}
            >
              <View style={[styles.swatch, { backgroundColor: option.background, borderColor: option.border }]}>
                <View style={[styles.swatchDot, { backgroundColor: option.primary }]} />
                <View style={[styles.swatchDot, { backgroundColor: option.accent }]} />
                <View style={[styles.swatchDot, { backgroundColor: option.surfaceSoft }]} />
              </View>
              <Text style={[styles.paletteName, { color: option.ink }]}>{option.label}</Text>
              <Text style={[styles.paletteHint, { color: option.muted }]}>{option === getPalette(space?.kind ?? 'couple', null) ? 'Suggested for this space' : 'Pastel palette'}</Text>
              {active ? <Text accessibilityLabel="Selected" style={[styles.selected, { color: option.primaryPressed }]}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {error ? <View style={styles.error}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      <Pressable accessibilityRole="button" onPress={() => void save()} disabled={isSaving || isLoading} style={({ pressed }) => [styles.save, { backgroundColor: palette.primary, opacity: pressed || isSaving ? 0.82 : 1 }]}>
        <Text style={styles.saveText}>{isSaving ? 'Saving…' : 'Use this palette'}</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  paletteList: { gap: 11 },
  paletteCard: { minHeight: 82, padding: 13, borderRadius: 19, flexDirection: 'row', alignItems: 'center', gap: 13 },
  swatch: { width: 54, height: 48, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  swatchDot: { width: 11, height: 19, borderRadius: 6 },
  paletteName: { fontSize: 14, fontWeight: '900', flex: 1 },
  paletteHint: { fontSize: 11, position: 'absolute', left: 80, bottom: 13 },
  selected: { fontSize: 20, fontWeight: '900', paddingHorizontal: 5 },
  error: { marginTop: 14 },
  save: { minHeight: 49, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }
});
