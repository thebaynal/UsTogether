import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { TextField } from '@/components/TextField';
import { createSpace } from '@/features/spaces/spaceService';
import type { SpaceKind } from '@/types/domain';
import { defaultThemeByKind, getPalette, palettes, spaceKindLabels } from '@/theme/palettes';

const kinds: SpaceKind[] = ['couple', 'group', 'team'];
const littleNotes: Record<SpaceKind, string> = {
  couple: 'For the two of you and all your little milestones.',
  group: 'For friends, family, and the stories you make together.',
  team: 'For the team memories worth keeping.'
};

export default function NewSpaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SpaceKind>('couple');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const palette = getPalette(kind, null);

  async function submit() {
    if (!name.trim()) { setError('Give your space a name first.'); return; }
    setError(null);
    setIsSaving(true);
    try {
      const id = await createSpace(name, kind);
      router.replace(`/spaces/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your space could not be created.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  All spaces</Text>
      </Pressable>
      <BrandHeader palette={palette} title="Make a little space" subtitle="Choose who it’s for. Everyone in the space can add and care for its memories." />
      <TextField label="Space name" palette={palette} value={name} onChangeText={setName} maxLength={50} placeholder="Sunday hikes, The Parkers…" returnKeyType="done" />
      <Text style={[styles.label, { color: palette.ink }]}>This space is for…</Text>
      <View style={styles.kindList}>
        {kinds.map((option) => {
          const optionPalette = getPalette(option, defaultThemeByKind[option]);
          const selected = kind === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setKind(option)}
              style={[styles.kindCard, { backgroundColor: optionPalette.surface, borderColor: selected ? optionPalette.primary : optionPalette.border, borderWidth: selected ? 2 : 1 }]}
            >
              <View style={[styles.kindIcon, { backgroundColor: optionPalette.surfaceSoft }]}><Text style={{ color: optionPalette.primaryPressed, fontSize: 19 }}>{option === 'couple' ? '♡' : option === 'team' ? '✦' : '✿'}</Text></View>
              <View style={styles.kindWords}>
                <Text style={[styles.kindTitle, { color: optionPalette.ink }]}>{spaceKindLabels[option]}</Text>
                <Text style={[styles.kindDescription, { color: optionPalette.muted }]}>{littleNotes[option]}</Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? optionPalette.primary : optionPalette.border }]}>{selected ? <View style={[styles.radioDot, { backgroundColor: optionPalette.primary }]} /> : null}</View>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.themeHint, { backgroundColor: palette.surfaceSoft, borderColor: palette.border }]}>
        <Text style={{ color: palette.ink, fontSize: 14, lineHeight: 21 }}>
          Your space starts with the <Text style={{ fontWeight: '800' }}>{palette.label}</Text> palette. Members can change it anytime.
        </Text>
      </View>
      {error ? <View style={styles.error}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      <View style={styles.submit}><AppButton label="Create space" palette={palette} onPress={() => void submit()} loading={isSaving} /></View>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  kindList: { gap: 10 },
  kindCard: { minHeight: 80, borderRadius: 19, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kindIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kindWords: { flex: 1, gap: 4 },
  kindTitle: { fontSize: 15, fontWeight: '800' },
  kindDescription: { fontSize: 12, lineHeight: 17 },
  radio: { width: 21, height: 21, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  themeHint: { padding: 13, borderRadius: 16, borderWidth: 1, marginTop: 16 },
  error: { marginTop: 14 },
  submit: { marginTop: 18 }
});
