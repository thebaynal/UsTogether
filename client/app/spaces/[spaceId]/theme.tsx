import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion, useAnimatedColor } from '@/components/Motion';
import { RomanticMark } from '@/components/RomanticMark';
import { AppButton } from '@/components/AppButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { LoadingState } from '@/components/LoadingState';
import { getSpace, setSpaceTheme } from '@/features/spaces/spaceService';
import type { Space, ThemeKey } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels } from '@/theme/palettes';

const options: ThemeKey[] = ['rose', 'lavender', 'peach', 'mint', 'sky'];

function AlbumPreview({ palette, name }: { palette: typeof palettes.rose; name: string }) {
  const { width } = useWindowDimensions();
  const backgroundColor = useAnimatedColor(palette.surfaceSoft);
  const color = useAnimatedColor(palette.primaryPressed);
  return <Animated.View style={[styles.albumPreview, { backgroundColor }]}>
    <View style={styles.previewWords}>
      <Animated.Text style={[styles.previewLabel, { color }]}>OUR LITTLE ALBUM</Animated.Text>
      <Animated.Text style={[styles.previewTitle, { color }]}>{name}</Animated.Text>
      <Text style={{ color: palette.muted }}>Made of moments. Kept with love.</Text>
    </View>
    {width >= 380 ? <RomanticMark palette={palette} size={width < 600 ? 48 : 64} /> : null}
  </Animated.View>;
}

export default function ThemeScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [selected, setSelected] = useState<ThemeKey>('rose');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    void getSpace(spaceId).then((nextSpace) => {
      if (!active) return;
      setSpace(nextSpace);
      setSelected(getPalette(nextSpace.kind, nextSpace.themeKey).key);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Space theme could not be loaded.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [spaceId]);

  const palette = space ? getPalette(space.kind, selected) : palettes.rose;
  const columns = gridWidth >= 520 ? 2 : 1;
  const optionWidth = gridWidth ? (gridWidth - (columns - 1) * 12) / columns : undefined;

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
    <Page palette={palette} layout="form">
      <Pressable accessibilityRole="button" accessibilityLabel="Back to timeline" onPress={() => router.back()} style={styles.back}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  Back to timeline</Text></Pressable>
      <BrandHeader palette={palette} eyebrow={space ? spaceKindLabels[space.kind] : 'Space settings'} title="A mood for your story." subtitle="Pick the colors that feel like you. Your choice is shared with everyone in this space." />
      <AlbumPreview palette={palette} name={space?.name ?? 'Your story'} />
      {isLoading ? <LoadingState palette={palette} label="Finding your album’s colors…" /> : null}
      <View accessibilityRole="radiogroup" accessibilityLabel="Space palettes" onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} style={styles.paletteList}>
        {options.map((key, index) => {
          const option = palettes[key];
          const active = selected === key;
          return (
            <MotionView key={key} index={index} style={[styles.optionWrap, { width: optionWidth ?? '100%' }]}>
            <Pressable disabled={isSaving || isLoading || !space}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: active, checked: active }}
              onPress={() => setSelected(key)}
              style={[styles.paletteCard, { backgroundColor: option.surface, borderColor: active ? option.primary : option.border }]}
            >
              <View style={[styles.swatch, { backgroundColor: option.surfaceSoft, borderColor: option.border }]}>
                <View accessible={false} style={[styles.swatchSpine, { backgroundColor: option.primary }]} />
                <View style={styles.swatchTop}><Text style={[styles.swatchLabel, { color: option.primaryPressed }]}>OUR STORY</Text><RomanticMark palette={option} size={42} /></View>
                <View style={[styles.swatchLine, { backgroundColor: option.primary }]} />
                <View style={[styles.swatchShortLine, { backgroundColor: option.primary }]} />
              </View>
              <View style={styles.optionFooter}><View style={styles.optionWords}><Text style={[styles.paletteName, { color: option.ink }]}>{option.label}</Text>
              <Text style={[styles.paletteHint, { color: option.muted }]}>{option === getPalette(space?.kind ?? 'couple', null) ? 'Your space’s original mood' : 'A different kind of lovely'}</Text></View>
              <View accessible={false} style={[styles.selectionSlot, { backgroundColor: active ? option.surfaceSoft : 'transparent' }]}>{active ? <MotionView duration={motion.content}><Text style={[styles.selected, { color: option.primaryPressed }]}>✓</Text></MotionView> : null}</View></View>
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
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12, marginBottom: 18, borderRadius: 22 },
  albumPreview: { padding: 24, borderRadius: 30, marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  previewWords: { flex: 1, gap: 10 },
  previewLabel: { fontSize: 10, lineHeight: 15, letterSpacing: 1.6, fontWeight: '800' },
  previewTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  paletteList: { gap: 12, flexDirection: 'row', flexWrap: 'wrap' },
  optionWrap: { flexGrow: 0, flexShrink: 0 },
  paletteCard: { minHeight: 202, padding: 14, borderWidth: 2, borderRadius: 26, gap: 14 },
  swatch: { width: '100%', height: 108, borderRadius: 16, borderWidth: 1, padding: 14, paddingLeft: 23, justifyContent: 'center', gap: 7, overflow: 'hidden' },
  swatchSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, opacity: 0.25 },
  swatchTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  swatchLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  swatchLine: { width: '62%', height: 4, borderRadius: 2, opacity: 0.8 },
  swatchShortLine: { width: '40%', height: 3, borderRadius: 2, opacity: 0.35 },
  optionFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionWords: { flex: 1, gap: 5 },
  paletteName: { fontSize: 14, lineHeight: 20, fontWeight: '900' },
  paletteHint: { fontSize: 11, lineHeight: 16 },
  selectionSlot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  selected: { fontSize: 19, fontWeight: '900' },
  error: { marginTop: 14 },
  save: { marginTop: 24 }
});
