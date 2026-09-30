import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { useAuth } from '@/features/auth/AuthProvider';
import { signOut } from '@/features/auth/authService';
import { listSpaces } from '@/features/spaces/spaceService';
import type { Space } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels } from '@/theme/palettes';

export default function SpacesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
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
      <BrandHeader palette={palettes.rose} title="Your little worlds" subtitle="A shared space for every story you want to remember." />
      {error ? <Notice palette={palettes.rose} tone="error">{error}</Notice> : null}
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: palettes.rose.ink }]}>Shared spaces</Text>
        <Text style={[styles.count, { color: palettes.rose.muted }]}>{spaces.length}</Text>
      </View>
      {isLoading ? <ActivityIndicator color={palettes.rose.primary} style={styles.spinner} /> : null}
      {!isLoading && spaces.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: '#FFFFFF', borderColor: palettes.rose.border }]}>
          <Text style={styles.emptyIllustration}>🌷</Text>
          <Text style={[styles.emptyTitle, { color: palettes.rose.ink }]}>A blank page, in the best way</Text>
          <Text style={[styles.emptyCopy, { color: palettes.rose.muted }]}>Start a couple, friends, or team timeline. Your people can add their memories too.</Text>
        </View>
      ) : null}
      <View style={styles.spaceList}>
        {spaces.map((space) => {
          const palette = getPalette(space.kind, space.themeKey);
          return (
            <Pressable
              key={space.id}
              accessibilityRole="button"
              onPress={() => router.push(`/spaces/${space.id}`)}
              style={({ pressed }) => [styles.spaceCard, { backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.86 : 1 }]}
            >
              <View style={[styles.spaceIcon, { backgroundColor: palette.surfaceSoft }]}>
                <Text style={{ fontSize: 22 }}>{space.kind === 'couple' ? '♡' : space.kind === 'team' ? '✦' : '✿'}</Text>
              </View>
              <View style={styles.spaceInfo}>
                <Text style={[styles.spaceName, { color: palette.ink }]} numberOfLines={1}>{space.name}</Text>
                <Text style={[styles.spaceMeta, { color: palette.muted }]}>{spaceKindLabels[space.kind]} · {space.memberCount} {space.memberCount === 1 ? 'member' : 'members'}</Text>
              </View>
              <Text style={[styles.chevron, { color: palette.primary }]}>›</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.createButton}>
        <AppButton label="＋  Create a space" palette={palettes.rose} onPress={() => router.push('/spaces/new')} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
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
  spaceList: { gap: 12 },
  spaceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 15, borderRadius: 22, borderWidth: 1, minHeight: 82 },
  spaceIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  spaceInfo: { flex: 1, gap: 4 },
  spaceName: { fontSize: 16, fontWeight: '800' },
  spaceMeta: { fontSize: 13, fontWeight: '600' },
  chevron: { fontSize: 25, paddingHorizontal: 4 },
  createButton: { marginTop: 22 }
});
