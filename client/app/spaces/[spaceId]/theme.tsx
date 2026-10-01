import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion, useAnimatedColor } from '@/components/Motion';
import { RomanticMark } from '@/components/RomanticMark';
import { AppButton } from '@/components/AppButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { getSpace, setSpaceTheme } from '@/features/spaces/spaceService';
import type { Space, ThemeKey } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels } from '@/theme/palettes';

const options: ThemeKey[] = ['rose', 'lavender', 'peach', 'mint', 'sky'];

function AlbumPreview({ palette, name }: { palette: typeof palettes.rose; name: string }) {
  const backgroundColor = useAnimatedColor(palette.surfaceSoft);
  const color = useAnimatedColor(palette.primaryPressed);
  return <Animated.View style={[styles.albumPreview, { backgroundColor }]}>
    <View style={styles.previewWords}>
      <Animated.Text style={[styles.previewLabel, { color }]}>OUR LITTLE ALBUM</Animated.Text>
      <Animated.Text style={[styles.previewTitle, { color }]}>{name}</Animated.Text>
      <Text style={{ color: palette.muted }}>Made of moments. Kept with love.</Text>
    </View>
    <RomanticMark palette={palette} size={64} />
  </Animated.View>;
}

export default function ThemeScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [selected, setSelected] = useState<ThemeKey>('rose');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

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
    if (!space || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await setSpaceTheme(space.id, selected);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Theme could not be saved.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  Back to timeline</Text></Pressable>
      <BrandHeader palette={palette} eyebrow={space ? spaceKindLabels[space.kind] : 'Space settings'} title="A mood for your story." subtitle="Pick the colors that feel like you. Your choice is shared with everyone in this space." />
      <AlbumPreview palette={palette} name={space?.name ?? 'Your story'} />
      {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
      <View style={styles.paletteList}>
        {options.map((key, index) => {
          const option = palettes[key];
          const active = selected === key;
          return (
            <MotionView key={key} index={index} style={styles.optionWrap}>
            <Pressable disabled={isSaving || isLoading || !space}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, checked: active }}
              onPress={() => setSelected(key)}
              style={[styles.paletteCard, { backgroundColor: option.surface, borderColor: active ? option.primary : option.border, borderWidth: active ? 2 : 1 }]}
            >
              <View style={[styles.swatch, { backgroundColor: option.surfaceSoft, borderColor: option.border }]}>
                <RomanticMark palette={option} size={42} />
                <View style={[styles.swatchLine, { backgroundColor: option.primary }]} />
              </View>
              <View style={{ flex: 1, gap: 5 }}><Text style={[styles.paletteName, { color: option.ink }]}>{option.label}</Text>
              <Text style={[styles.paletteHint, { color: option.muted }]}>{option === getPalette(space?.kind ?? 'couple', null) ? 'Your space’s original mood' : 'A different kind of lovely'}</Text></View>
              {active ? <MotionView duration={motion.content}><Text accessibilityLabel="Selected" style={[styles.selected, { color: option.primaryPressed }]}>✓</Text></MotionView> : null}
            </Pressable>
            </MotionView>
          );
        })}
      </View>
      {error ? <View style={styles.error}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      <View style={styles.save}><AppButton label="Use this palette" palette={palette} onPress={() => void save()} disabled={isLoading || !space} loading={isSaving} /></View>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  albumPreview: { padding: 24, borderRadius: 30, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  previewWords: { flex: 1, gap: 10 },
  previewLabel: { fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  previewTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8 },
  paletteList: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  optionWrap: { flexGrow: 1, flexBasis: 300 },
  paletteCard: { minHeight: 112, padding: 16, borderRadius: 26, flexDirection: 'row', alignItems: 'center', gap: 16 },
  swatch: { width: 72, height: 78, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  swatchLine: { width: 30, height: 3, borderRadius: 2 },
  swatchDot: { width: 11, height: 19, borderRadius: 6 },
  paletteName: { fontSize: 14, fontWeight: '900', flex: 1 },
  paletteHint: { fontSize: 11, lineHeight: 16 },
  selected: { fontSize: 20, fontWeight: '900', paddingHorizontal: 5 },
  error: { marginTop: 14 },
  save: { marginTop: 24 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }
});
