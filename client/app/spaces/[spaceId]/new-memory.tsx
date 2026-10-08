import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { useSpaceTheme } from '@/features/spaces/useSpaceTheme';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { TextField } from '@/components/TextField';
import { PaperPanel } from '@/components/PaperPanel';
import { LoadingState } from '@/components/LoadingState';
import { useAuth } from '@/features/auth/AuthProvider';
import { createMemory } from '@/features/memories/memoryService';
import { isValidMemoryDate, validateImageSelection } from '@/features/memories/logic';
import { getSpace } from '@/features/spaces/spaceService';
import type { ImageMimeType } from '@/types/domain';
import { getPalette } from '@/theme/palettes';

type SelectedImage = { uri: string; fileName: string; mimeType: ImageMimeType; fileSize?: number | null; file?: File };

function localDate() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function NewMemoryScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [spaceKind, setSpaceKind] = useState<'couple' | 'group' | 'team'>('couple');
  const [themeKey, setThemeKey] = useState<import('@/types/domain').ThemeKey | null>(null);
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(localDate());
  const [caption, setCaption] = useState('');
  const [milestoneTag, setMilestoneTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [spaceReady, setSpaceReady] = useState(false);
  const saving = useRef(false);
  const [saved, setSaved] = useState(false);
  const savedTheme = useSpaceTheme(spaceId, themeKey);
  const palette = getPalette(spaceKind, savedTheme);

  useEffect(() => {
    let active = true;
    void getSpace(spaceId).then((space) => {
      if (active) { setSpaceKind(space.kind); setThemeKey(space.themeKey); setSpaceReady(true); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Your space could not be loaded. Reopen the timeline and try again.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [spaceId]);

  async function chooseImage() {
    if (saving.current) return;
    setError(null);
    try {
    if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo library access to add a memory.');
      return;
    }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 0.9
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset) throw new Error('No photo was selected. Please choose it again.');
      const fileName = asset.fileName ?? `memory.${asset.mimeType?.split('/')[1] ?? 'jpg'}`;
      const mimeType = validateImageSelection({ mimeType: asset.file?.type || asset.mimeType, fileName, fileSize: asset.file?.size ?? asset.fileSize });
      setImage({ uri: asset.uri, fileName, mimeType, fileSize: asset.file?.size ?? asset.fileSize, file: asset.file });
    } catch (cause) {
      setImage(null);
      setError(cause instanceof Error ? cause.message : 'Choose a JPEG, PNG, or WebP image.');
    }
  }

  async function submit() {
    if (saving.current || saved || !spaceReady) return;
    if (!user) { setError('Sign in again before adding a memory.'); return; }
    if (!image) { setError('Choose a photo to add to this memory.'); return; }
    if (!title.trim()) { setError('Add a title for this moment.'); return; }
    if (!isValidMemoryDate(date)) { setError('Enter a real date in YYYY-MM-DD format.'); return; }

    setError(null);
    saving.current = true;
    setIsSaving(true);
    try {
      const memory = await createMemory({ spaceId, userId: user.id, title, date, caption, milestoneTag, image });
      setSaved(true);
      if (!memory.imageUrl) setError('Your memory is saved. Its photo preview could not load yet; reopen the timeline to retry.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your memory could not be saved.');
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette} layout="form">
      <Pressable accessibilityRole="button" accessibilityLabel="Back to timeline" onPress={() => router.back()} style={styles.back}>
        <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  Back to timeline</Text>
      </Pressable>
      <BrandHeader palette={palette} eyebrow="A page in your story" title="Keep this moment." subtitle="A photo, a date, and the little details you never want to forget." />
      {isLoading ? <LoadingState palette={palette} label="Opening your album…" /> : null}

      {saved ? <MotionView duration={motion.content} style={[styles.saved, { backgroundColor: palette.surfaceSoft }]}>
        <Text style={{ color: palette.primaryPressed, fontSize: 28 }}>♡</Text>
        <Text style={{ color: palette.ink, fontSize: 20, fontWeight: '800' }}>A moment, kept forever.</Text>
        {error ? <Notice palette={palette}>{error}</Notice> : null}
        <AppButton label="Back to your timeline" palette={palette} onPress={() => router.dismissTo(`/spaces/${spaceId}`)} />
      </MotionView> : !isLoading ? <PaperPanel palette={palette}>

      <Pressable disabled={isSaving || !spaceReady} accessibilityRole="button" accessibilityLabel={image ? 'Change the selected photo' : 'Choose a photo'} onPress={() => void chooseImage()} style={[styles.photoPicker, { height: width < 600 ? 220 : 300, backgroundColor: palette.surfaceSoft, borderColor: palette.border }]}>
        {image ? <MotionView key={image.uri} duration={motion.content} style={styles.preview}><Image source={{ uri: image.uri }} resizeMode="contain" accessibilityLabel="Selected photo preview" style={styles.preview} /></MotionView> : (
          <View style={styles.photoPrompt}>
            <Text style={[styles.photoIcon, { color: palette.primaryPressed }]}>＋</Text>
            <Text style={[styles.photoTitle, { color: palette.ink }]}>Choose a photo</Text>
            <Text style={[styles.photoHint, { color: palette.muted }]}>JPEG, PNG, or WebP · up to 10 MB</Text>
          </View>
        )}
      </Pressable>
      {image ? <Pressable disabled={isSaving} accessibilityRole="button" onPress={() => void chooseImage()} style={styles.changePhoto}><Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>Change photo</Text></Pressable> : null}

      <View style={styles.form}>
        <TextField label="Title" palette={palette} editable={!isSaving} value={title} onChangeText={setTitle} maxLength={50} placeholder="The day we found the little bakery" />
        <TextField label="Date" palette={palette} editable={!isSaving} value={date} onChangeText={setDate} maxLength={10} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" hint="Use the day it happened; the timeline sorts by this date." />
        <TextField label="Milestone tag · optional" palette={palette} editable={!isSaving} value={milestoneTag} onChangeText={setMilestoneTag} maxLength={40} placeholder="Trip, first day, celebration…" />
        <TextField label="A few words · optional" palette={palette} editable={!isSaving} value={caption} onChangeText={setCaption} maxLength={250} placeholder="What do you want to remember about it?" multiline />
        {error ? <Notice palette={palette} tone="error">{error}</Notice> : null}
        <AppButton label="Save memory" palette={palette} disabled={!spaceReady} onPress={() => void submit()} loading={isSaving} />
      </View>
      </PaperPanel> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  saved: { padding: 28, borderRadius: 30, gap: 18 },
  back: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12, marginBottom: 16, borderRadius: 22 },
  photoPicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoPrompt: { alignItems: 'center', gap: 6 },
  photoIcon: { fontSize: 34, lineHeight: 41 },
  photoTitle: { fontSize: 16, fontWeight: '900' },
  photoHint: { fontSize: 12 },
  preview: { width: '100%', height: '100%' },
  changePhoto: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22 },
  form: { gap: 18, marginTop: 22 }
});
