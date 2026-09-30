import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteMemory, listMemories } from '@/features/memories/memoryService';
import { formatMemoryDate } from '@/features/memories/logic';
import { createInvite, deleteSpace, getSpace, leaveSpace } from '@/features/spaces/spaceService';
import type { Memory, Space } from '@/types/domain';
import { getPalette, palettes, spaceKindLabels } from '@/theme/palettes';
import { requireSupabase } from '@/lib/supabase';

export default function TimelineScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [space, setSpace] = useState<Space | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingExit, setPendingExit] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const palette = space ? getPalette(space.kind, space.themeKey) : palettes.rose;
  const cardWidth = Math.max(270, Math.min(width - 52, 370));

  async function refresh() {
    try {
      const [nextSpace, nextMemories] = await Promise.all([getSpace(spaceId), listMemories(spaceId)]);
      setSpace(nextSpace);
      setMemories(nextMemories);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This space could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void Promise.all([getSpace(spaceId), listMemories(spaceId)])
      .then(([nextSpace, nextMemories]) => {
        if (!active) return;
        setSpace(nextSpace);
        setMemories(nextMemories);
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'This space could not be loaded.'); })
      .finally(() => { if (active) setIsLoading(false); });

    const client = requireSupabase();
    const channel = client.channel(`space:${spaceId}:timeline`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `space_id=eq.${spaceId}` }, () => { void refresh(); })
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [spaceId]);

  async function shareInvite() {
    setIsSharing(true);
    setError(null);
    try {
      const invite = await createInvite(spaceId);
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await Clipboard.setStringAsync(invite.url);
        setNotice('Invite link copied. It expires in 7 days and works once.');
      } else {
        await Share.share({ message: `Come add memories with us: ${invite.url}`, url: invite.url, title: `Join ${space?.name ?? 'our space'}` });
        setNotice('Your invite link is ready. It expires in 7 days and works once.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create an invite link.');
    } finally {
      setIsSharing(false);
    }
  }

  async function confirmExit() {
    if (!space) return;
    setIsExiting(true);
    setError(null);
    try {
      if (space.memberCount === 1) await deleteSpace(space.id);
      else await leaveSpace(space.id);
      router.replace('/spaces');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not leave this space.');
      setIsExiting(false);
    }
  }

  const memoryCountLabel = useMemo(() => `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`, [memories.length]);

  return (
    <Page palette={palette}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/spaces')} style={styles.back}>
          <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  All spaces</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/spaces/${spaceId}/theme`)} style={[styles.themeButton, { backgroundColor: palette.surfaceSoft }]}>
          <Text accessibilityLabel="Change space theme" style={{ color: palette.primaryPressed, fontSize: 18 }}>✿</Text>
        </Pressable>
      </View>

      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.kindLabel, { color: palette.primaryPressed }]}>{space ? spaceKindLabels[space.kind] : 'Shared space'}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{space?.name ?? 'Your timeline'}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{space?.memberCount ?? '—'} {space?.memberCount === 1 ? 'member' : 'members'} · {memoryCountLabel}</Text>
        </View>
        <Text style={styles.heart}>♡</Text>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.actionGrow}>
          <AppButton label="＋  Add a memory" palette={palette} onPress={() => router.push(`/spaces/${spaceId}/new-memory`)} />
        </View>
        <AppButton label={isSharing ? '…' : 'Invite'} palette={palette} onPress={() => void shareInvite()} loading={isSharing} variant="soft" compact accessibilityLabel="Create an invite link" />
      </View>

      {notice ? <View style={styles.notice}><Notice palette={palette} tone="success">{notice}</Notice></View> : null}
      {error ? <View style={styles.notice}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      {isLoading ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : null}

      {!isLoading && memories.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.emptyFlower, { backgroundColor: palette.surfaceSoft }]}><Text style={{ fontSize: 26, color: palette.primaryPressed }}>✿</Text></View>
          <Text style={[styles.emptyTitle, { color: palette.ink }]}>Your first memory is waiting</Text>
          <Text style={[styles.emptyCopy, { color: palette.muted }]}>Add a photo and a date. It will find its place in your timeline.</Text>
          <View style={styles.emptyButton}><AppButton label="Add the first memory" palette={palette} onPress={() => router.push(`/spaces/${spaceId}/new-memory`)} /></View>
        </View>
      ) : null}

      {memories.length > 0 ? (
        <>
          <View style={styles.timelineIntro}>
            <Text style={[styles.timelineLabel, { color: palette.ink }]}>Your story, in order</Text>
            <Text style={[styles.swipeHint, { color: palette.muted }]}>Swipe to wander  ›</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={cardWidth + 15}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={styles.timelineTrack}
          >
            {memories.map((memory, index) => (
              <Pressable
                key={memory.id}
                accessibilityRole="button"
                accessibilityLabel={`${memory.title}, ${formatMemoryDate(memory.date)}. Open memory.`}
                onPress={() => router.push(`/memories/${memory.id}?spaceId=${spaceId}`)}
                style={({ pressed }) => [styles.memoryCard, { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={[styles.imageFrame, { backgroundColor: palette.surfaceSoft }]}>
                  {memory.imageUrl ? <Image source={{ uri: memory.imageUrl }} style={styles.photo} resizeMode="cover" accessibilityLabel={memory.title} /> : <Text style={{ color: palette.muted }}>Photo preview expired. Reopen timeline.</Text>}
                </View>
                <View style={styles.memoryText}>
                  <View style={styles.memoryMeta}>
                    <Text style={[styles.memoryDate, { color: palette.primaryPressed }]}>{formatMemoryDate(memory.date)}</Text>
                    <Text style={[styles.timelineNumber, { color: palette.muted }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={[styles.memoryTitle, { color: palette.ink }]} numberOfLines={2}>{memory.title}</Text>
                  {memory.milestoneTag ? <Text style={[styles.tag, { backgroundColor: palette.surfaceSoft, color: palette.primaryPressed }]}>{memory.milestoneTag}</Text> : null}
                  {memory.caption ? <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={2}>{memory.caption}</Text> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.axisWrap}>
            <View style={[styles.axis, { backgroundColor: palette.border }]} />
            {memories.map((memory) => <View key={memory.id} style={[styles.axisDot, { backgroundColor: palette.primary, borderColor: palette.background }]} />)}
          </View>
        </>
      ) : null}

      <View style={[styles.membership, { borderColor: palette.border }]}>
        <Text style={[styles.membershipText, { color: palette.muted }]}>Everyone here can add and care for the shared memories.</Text>
        {!pendingExit ? (
          <Pressable accessibilityRole="button" onPress={() => setPendingExit(true)} style={styles.leaveButton}>
            <Text style={[styles.leaveText, { color: palette.primaryPressed }]}>{space?.memberCount === 1 ? 'Delete space' : 'Leave space'}</Text>
          </Pressable>
        ) : (
          <View style={styles.exitConfirm}>
            <Text style={[styles.membershipText, { color: palette.ink }]}>{space?.memberCount === 1 ? 'This removes the space and its memories.' : 'You’ll lose access to this timeline.'}</Text>
            <View style={styles.exitButtons}>
              <AppButton label="Cancel" palette={palette} variant="outline" compact onPress={() => setPendingExit(false)} />
              <AppButton label={space?.memberCount === 1 ? 'Delete' : 'Leave'} palette={palette} variant="danger" compact loading={isExiting} onPress={() => void confirmExit()} />
            </View>
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { paddingVertical: 8, paddingRight: 14 },
  themeButton: { height: 42, width: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18 },
  headingCopy: { flex: 1, gap: 5 },
  kindLabel: { textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { fontSize: 14, fontWeight: '600' },
  heart: { fontSize: 36, transform: [{ rotate: '-10deg' }] },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionGrow: { flex: 1 },
  notice: { marginTop: 12 },
  loader: { marginTop: 35 },
  emptyCard: { borderWidth: 1, borderRadius: 27, alignItems: 'center', padding: 24, marginTop: 22 },
  emptyFlower: { height: 54, width: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  emptyTitle: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 390, marginTop: 7 },
  emptyButton: { width: '100%', maxWidth: 350, marginTop: 18 },
  timelineIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 30, marginBottom: 12 },
  timelineLabel: { fontSize: 18, fontWeight: '900' },
  swipeHint: { fontSize: 12, fontWeight: '700' },
  timelineTrack: { gap: 15, paddingHorizontal: 1, paddingBottom: 12 },
  memoryCard: { borderRadius: 25, borderWidth: 1, padding: 10, overflow: 'hidden', shadowColor: '#4E4550', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 7 } },
  imageFrame: { width: '100%', aspectRatio: 1.04, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  memoryText: { paddingHorizontal: 7, paddingTop: 13, paddingBottom: 9, gap: 7 },
  memoryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memoryDate: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '900' },
  timelineNumber: { fontSize: 11, fontWeight: '700' },
  memoryTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  tag: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, fontSize: 11, fontWeight: '800' },
  caption: { fontSize: 13, lineHeight: 19 },
  axisWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', height: 16, marginTop: 8, marginHorizontal: 14 },
  axis: { position: 'absolute', left: 0, right: 0, height: 2 },
  axisDot: { width: 10, height: 10, borderRadius: 6, borderWidth: 2 },
  membership: { marginTop: 26, paddingTop: 17, borderTopWidth: 1, gap: 8 },
  membershipText: { fontSize: 13, lineHeight: 19 },
  leaveButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  leaveText: { fontSize: 13, fontWeight: '800' },
  exitConfirm: { gap: 11 },
  exitButtons: { flexDirection: 'row', gap: 9 }
});
