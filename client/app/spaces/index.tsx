import { useCallback, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { RomanticMark } from '@/components/RomanticMark';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandLogo } from '@/components/BrandLogo';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { LoadingState } from '@/components/LoadingState';
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
  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 960 ? 3 : gridWidth >= 620 ? 2 : 1;
  const albumWidth = gridWidth ? (gridWidth - (columns - 1) * 18) / columns : undefined;
  const visibleAlbums = columns * Math.max(1, Math.ceil((height - (width < 600 ? 430 : 350)) / 280));
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
        <BrandLogo palette={palettes.rose} />
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void handleSignOut()} style={styles.signOut}>
          <Text style={{ color: palettes.rose.muted, fontWeight: '700' }}>Sign out</Text>
        </Pressable>
      </View>
      <View style={[styles.welcome, width < 600 && styles.smallWelcome, { backgroundColor: palettes.rose.surfaceSoft, borderColor: palettes.rose.border }]}>
        <View style={{ flex: 1 }}><BrandHeader palette={palettes.rose} eyebrow="Collect moments, keep the feeling" title="Life is sweeter, together." subtitle="A little home for the stories you share and the people you love." /></View>
        {width >= 400 ? <RomanticMark palette={palettes.rose} size={width < 600 ? 52 : 78} /> : null}
      </View>
      {error ? <Notice palette={palettes.rose} tone="error">{error}</Notice> : null}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: palettes.rose.ink }]}>Your albums</Text>
        <View style={[styles.countPill, { backgroundColor: palettes.rose.surfaceSoft }]}><Text style={[styles.count, { color: palettes.rose.primaryPressed }]}>{spaces.length}</Text></View>
      </View>
      {isLoading ? <LoadingState palette={palettes.rose} label="Opening your albums…" /> : null}
      {!isLoading && !error && spaces.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palettes.rose.surface, borderColor: palettes.rose.border }]}>
          <RomanticMark palette={palettes.rose} />
          <Text style={[styles.emptyTitle, { color: palettes.rose.ink }]}>A blank page, in the best way</Text>
          <Text style={[styles.emptyCopy, { color: palettes.rose.muted }]}>Start a couple, friends, or team timeline. Your people can add their memories too.</Text>
        </View>
      ) : null}
      <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} style={styles.spaceList}>
        {spaces.map((space, index) => (
          <ThemedAlbum key={space.id} space={space}>{(palette) => (
            <MotionView index={index < visibleAlbums ? index : 0} duration={index < visibleAlbums ? motion.entrance : 0} style={[styles.albumWrap, { width: albumWidth ?? '100%' }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${space.name}, ${spaceKindLabels[space.kind]} album, ${space.memberCount} ${space.memberCount === 1 ? 'member' : 'members'}`}
              onPress={() => router.push(`/spaces/${space.id}`)}
              style={({ pressed }) => [styles.spaceCard, { backgroundColor: palette.surfaceSoft, borderColor: palette.border, opacity: pressed ? 0.86 : 1 }]}
            >
              <View accessible={false} style={[styles.albumSpine, { backgroundColor: palette.primary, borderColor: palette.primaryPressed }]} />
              <View style={styles.albumTop}><View style={[styles.kindPill, { backgroundColor: palette.surface }]}><Text style={{ color: palette.primaryPressed, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{spaceKindLabels[space.kind]}</Text></View>
              <View style={[styles.spaceIcon, { backgroundColor: palette.surface }]}>
                <Text style={{ color: palette.primaryPressed, fontSize: 22 }}>{space.kind === 'couple' ? '♡' : space.kind === 'team' ? '✦' : '✿'}</Text>
              </View>
              </View>
              <View style={styles.spaceInfo}>
                <Text style={[styles.spaceName, { color: palette.ink }]} numberOfLines={2}>{space.name}</Text>
                <Text style={[styles.spaceMeta, { color: palette.muted }]}>{space.memberCount} {space.memberCount === 1 ? 'person keeping memories' : 'people keeping memories'}</Text>
              </View>
              <View style={[styles.albumFooter, { borderColor: palette.border }]}><Text style={{ color: palette.primaryPressed, fontSize: 12, fontWeight: '700' }}>Open your story</Text><View style={[styles.openIcon, { backgroundColor: palette.surface }]}><Text style={[styles.chevron, { color: palette.primaryPressed }]}>↗</Text></View></View>
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
  welcome: { padding: 32, borderRadius: 34, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 24 },
  smallWelcome: { padding: 22, gap: 12 },
  countPill: { minWidth: 30, height: 26, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  albumWrap: { flexGrow: 0, flexShrink: 0 },
  albumSpine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 10, borderRightWidth: 1, opacity: 0.2 },
  kindPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, flexShrink: 1 },
  albumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  albumFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 14, marginTop: 4 },
  openIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  brand: { fontSize: 16, letterSpacing: 0.6, fontWeight: '900' },
  signOut: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 22 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  count: { fontSize: 13, fontWeight: '700' },
  emptyCard: { alignItems: 'center', borderRadius: 25, borderWidth: 1, padding: 28, marginVertical: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { marginTop: 7, fontSize: 14, lineHeight: 21, maxWidth: 440, textAlign: 'center' },
  spaceList: { gap: 18, flexDirection: 'row', flexWrap: 'wrap' },
  spaceCard: { gap: 18, padding: 22, paddingLeft: 30, borderRadius: 28, borderWidth: 1, minHeight: 280, overflow: 'hidden' },
  spaceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  spaceInfo: { gap: 10, flex: 1 },
  spaceName: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 29, lineHeight: 35, letterSpacing: -0.8, fontWeight: '700' },
  spaceMeta: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  chevron: { fontSize: 21 },
  createButton: { marginTop: 24, width: '100%', maxWidth: 320, alignSelf: 'center' }
});
