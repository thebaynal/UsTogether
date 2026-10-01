import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { RomanticMark } from '@/components/RomanticMark';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { useAuth } from '@/features/auth/AuthProvider';
import { signOut } from '@/features/auth/authService';
import { listSpaces } from '@/features/spaces/spaceService';
import type { Space } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels, type Palette } from '@/theme/palettes';
import { useSpaceTheme } from '@/features/spaces/useSpaceTheme';

function ThemedAlbum({ space, children }: { space: Space; children: (palette: Palette) => ReactNode }) {
  const key = useSpaceTheme(space.id, space.themeKey);
  return <>{children(getPalette(space.kind, key))}</>;
}

export default function SpacesScreen() {
  const { width, height } = useWindowDimensions();
  const visibleAlbums = Math.max(1, Math.floor((Math.min(width, 1120) - 30) / 318)) * Math.max(1, Math.floor((height - (width < 600 ? 550 : 350)) / 260));
  const router = useRouter();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setSpaces(await listSpaces(user.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your spaces could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/sign-in');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.');
    }
  }

  return (
    <Page palette={palettes.rose}>
      <View style={styles.topBar}>
        <Text style={[styles.brand, { color: palettes.rose.primaryPressed }]}>UsTogether <Text>♡</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void handleSignOut()} style={styles.signOut}>
          <Text style={{ color: palettes.rose.muted, fontWeight: '700' }}>Sign out</Text>
        </Pressable>
      </View>
      <View style={[styles.welcome, { backgroundColor: palettes.rose.surfaceSoft }]}>
        <View style={{ flex: 1 }}><BrandHeader palette={palettes.rose} eyebrow="Collect moments, keep the feeling" title="Life is sweeter, together." subtitle="A little home for the stories you share and the people you love." /></View>
        <RomanticMark palette={palettes.rose} size={72} />
      </View>
      {error ? <Notice palette={palettes.rose} tone="error">{error}</Notice> : null}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: palettes.rose.ink }]}>Your albums</Text>
        <View style={[styles.countPill, { backgroundColor: palettes.rose.surfaceSoft }]}><Text style={[styles.count, { color: palettes.rose.primaryPressed }]}>{spaces.length}</Text></View>
      </View>
      {isLoading ? <ActivityIndicator color={palettes.rose.primary} style={styles.spinner} /> : null}
      {!isLoading && spaces.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palettes.rose.surface, borderColor: palettes.rose.border }]}>
          <RomanticMark palette={palettes.rose} />
          <Text style={[styles.emptyTitle, { color: palettes.rose.ink }]}>A blank page, in the best way</Text>
          <Text style={[styles.emptyCopy, { color: palettes.rose.muted }]}>Start a couple, friends, or team timeline. Your people can add their memories too.</Text>
        </View>
      ) : null}
      <View style={styles.spaceList}>
        {spaces.map((space, index) => (
          <ThemedAlbum key={space.id} space={space}>{(palette) => (
            <MotionView index={index < visibleAlbums ? index : 0} duration={index < visibleAlbums ? motion.entrance : 0} style={styles.albumWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/spaces/${space.id}`)}
              style={({ pressed }) => [styles.spaceCard, { backgroundColor: palette.surfaceSoft, borderColor: palette.border, opacity: pressed ? 0.86 : 1 }]}
            >
              <View style={styles.albumTop}><Text style={{ color: palette.primaryPressed, fontSize: 10, fontWeight: '800', letterSpacing: 1.6 }}>{spaceKindLabels[space.kind].toUpperCase()} / SHARED ALBUM</Text>
              <View style={[styles.spaceIcon, { backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.primaryPressed, fontSize: 22 }}>{space.kind === 'couple' ? '♡' : space.kind === 'team' ? '✦' : '✿'}</Text>
              </View>
              </View>
              <View style={styles.spaceInfo}>
                <Text style={[styles.spaceName, { color: palette.ink }]} numberOfLines={1}>{space.name}</Text>
                <Text style={[styles.spaceMeta, { color: palette.muted }]}>{spaceKindLabels[space.kind]} · {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'}</Text>
              </View>
              <View style={styles.albumFooter}><Text style={{ color: palette.primaryPressed, fontSize: 12, fontWeight: '700' }}>Open your story</Text><Text style={[styles.chevron, { color: palette.primary }]}>↗</Text></View>
            </Pressable>
            </MotionView>
          )}</ThemedAlbum>
        ))}
      </View>
      <View style={styles.createButton}>
        <AppButton label="＋  Create a space" palette={palettes.rose} onPress={() => router.push('/spaces/new')} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  welcome: { padding: 26, borderRadius: 34, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  countPill: { minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  albumWrap: { flexGrow: 1, flexBasis: 300 },
  albumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  albumFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  brand: { fontSize: 16, letterSpacing: 0.6, fontWeight: '900' },
  signOut: { paddingHorizontal: 12, paddingVertical: 9 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '700' },
  spinner: { marginTop: 30 },
  emptyCard: { alignItems: 'center', borderRadius: 25, borderWidth: 1, padding: 28, marginVertical: 8 },
  emptyIllustration: { fontSize: 32, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { marginTop: 7, fontSize: 14, lineHeight: 21, maxWidth: 440, textAlign: 'center' },
  spaceList: { gap: 18, flexDirection: 'row', flexWrap: 'wrap' },
  spaceCard: { gap: 20, padding: 24, borderRadius: 30, borderWidth: 1, minHeight: 242 },
  spaceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  spaceInfo: { gap: 8 },
  spaceName: { fontSize: 28, letterSpacing: -0.8, fontWeight: '800' },
  spaceMeta: { fontSize: 13, fontWeight: '600' },
  chevron: { fontSize: 25, paddingHorizontal: 4 },
  createButton: { marginTop: 22 }
});
