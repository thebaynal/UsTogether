import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { RomanticMark } from '@/components/RomanticMark';
import { useSpaceTheme } from '@/features/spaces/useSpaceTheme';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { LoadingState } from '@/components/LoadingState';
import { listMemories } from '@/features/memories/memoryService';
import { formatMemoryDate } from '@/features/memories/logic';
import { createInvite, deleteSpace, getSpace, leaveSpace } from '@/features/spaces/spaceService';
import type { Memory, Space } from '@/types/domain';
import { getPalette, spaceKindLabels } from '@/theme/palettes';
import { requireSupabase } from '@/lib/supabase';

export default function TimelineScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [space, setSpace] = useState<Space | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingExit, setPendingExit] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const active = useRef(false);
  const request = useRef(0);

  const themeKey = useSpaceTheme(spaceId, space?.themeKey ?? null);
  const palette = getPalette(space?.kind ?? 'couple', themeKey);
  const contentWidth = Math.min(width, 1120) - (width < 600 ? 36 : 64);
  const cardWidth = Math.max(220, Math.min(contentWidth - 24, 370));
  const visibleCards = Math.max(1, Math.ceil(contentWidth / (cardWidth + 18)));

  const refresh = useCallback(async () => {
    if (!active.current) return;
    const revision = ++request.current;
    try {
      const [nextSpace, nextMemories] = await Promise.allSettled([getSpace(spaceId), listMemories(spaceId)]);
      if (!active.current || revision !== request.current) return;
      if (nextSpace.status === 'fulfilled') setSpace(nextSpace.value);
      if (nextMemories.status === 'fulfilled') { setMemories(nextMemories.value); setFailedImages({}); }
      if (nextSpace.status === 'rejected') throw nextSpace.reason;
      if (nextMemories.status === 'rejected') throw nextMemories.reason;
      setError(null);
    } catch (cause) {
      if (active.current && revision === request.current) setError(cause instanceof Error ? cause.message : 'This space could not be loaded.');
    } finally {
      if (active.current && revision === request.current) setIsLoading(false);
    }
  }, [spaceId]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; request.current++; };
  }, [refresh]));

  useEffect(() => {
    const client = requireSupabase();
    const channel = client.channel(`space:${spaceId}:timeline:${Date.now()}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `space_id=eq.${spaceId}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `id=eq.${spaceId}` }, () => { void refresh(); })
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [spaceId, refresh]);

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
        <Pressable accessibilityRole="button" accessibilityLabel="Back to all spaces" onPress={() => router.replace('/spaces')} style={styles.back}>
          <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>‹  All spaces</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Change space theme" disabled={!space} onPress={() => router.push(`/spaces/${spaceId}/theme`)} style={[styles.themeButton, { backgroundColor: palette.surfaceSoft }]}>
          <Text style={{ color: palette.primaryPressed, fontSize: 20 }}>✿</Text>
        </Pressable>
      </View>

      <View style={[styles.headingRow, width < 600 && styles.smallHeading, { backgroundColor: palette.surfaceSoft, borderColor: palette.border }]}>
        <View style={styles.headingCopy}>
          <Text style={[styles.kindLabel, { color: palette.primaryPressed }]}>OUR {space ? spaceKindLabels[space.kind].toUpperCase() : 'SHARED'} ALBUM</Text>
          <Text accessibilityRole="header" style={[styles.title, width < 600 && styles.smallTitle, { color: palette.ink }]}>{space?.name ?? 'Your timeline'}</Text>
          <Text style={[styles.subtitle, { color: palette.muted }]}>{space?.memberCount ?? '—'} {space?.memberCount === 1 ? 'member' : 'members'} · {memoryCountLabel}</Text>
        </View>
        {width >= 380 ? <RomanticMark palette={palette} size={width < 600 ? 48 : 72} /> : null}
      </View>

      <View style={styles.actionRow}>
        <View style={styles.actionGrow}>
          <AppButton label="＋  Add a memory" palette={palette} disabled={!space} onPress={() => router.push(`/spaces/${spaceId}/new-memory`)} />
        </View>
        <AppButton label="Invite" palette={palette} disabled={!space} onPress={() => void shareInvite()} loading={isSharing} variant="soft" accessibilityLabel="Create an invite link" />
      </View>

      {notice ? <View style={styles.notice}><Notice palette={palette} tone="success">{notice}</Notice></View> : null}
      {error ? <View style={styles.notice}><Notice palette={palette} tone="error">{error}</Notice></View> : null}
      {isLoading ? <LoadingState palette={palette} label="Gathering your memories…" /> : null}

      {!isLoading && !error && memories.length === 0 ? (
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
            snapToInterval={cardWidth + 18}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={styles.timelineTrack}
          >
            {memories.map((memory, index) => (
              <MotionView key={memory.id} index={index < visibleCards ? index : 0} duration={index < visibleCards ? motion.entrance : 0}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${memory.title}, ${formatMemoryDate(memory.date)}. Open memory.`}
                onPress={() => router.push(`/memories/${memory.id}?spaceId=${spaceId}`)}
                style={({ pressed }) => [styles.memoryCard, { width: cardWidth, backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed ? 0.9 : 1 }]}
              >
                <View style={[styles.imageFrame, { backgroundColor: palette.surfaceSoft }]}>
                  {memory.imageUrl && !failedImages[memory.id] ? <Image source={{ uri: memory.imageUrl }} style={styles.photo} resizeMode="cover" accessibilityLabel={memory.title} onError={() => setFailedImages((current) => ({ ...current, [memory.id]: true }))} /> : <Pressable accessibilityRole="button" accessibilityLabel="Reload photo previews" onPress={(event) => { event.stopPropagation(); void refresh(); }} style={styles.photoRetry}><Text style={{ color: palette.primaryPressed, textAlign: 'center', lineHeight: 21 }}>Photo preview unavailable. Tap to reload.</Text></Pressable>}
                </View>
                <View style={styles.memoryText}>
                  <View style={styles.memoryMeta}>
                    <Text style={[styles.memoryDate, { color: palette.primaryPressed, backgroundColor: palette.surfaceSoft }]}>{formatMemoryDate(memory.date)}</Text>
                    <Text style={[styles.timelineNumber, { color: palette.muted }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <Text style={[styles.memoryTitle, { color: palette.ink }]} numberOfLines={2}>{memory.title}</Text>
                  {memory.milestoneTag ? <Text style={[styles.tag, { backgroundColor: palette.surfaceSoft, color: palette.primaryPressed }]}>{memory.milestoneTag}</Text> : null}
                  {memory.caption ? <Text style={[styles.caption, { color: palette.muted }]} numberOfLines={2}>{memory.caption}</Text> : null}
                  <View style={[styles.memoryFooter, { borderColor: palette.border }]}><Text style={[styles.openMemory, { color: palette.primaryPressed }]}>Open memory</Text><Text accessible={false} style={{ color: palette.primaryPressed, fontSize: 20 }}>↗</Text></View>
                </View>
              </Pressable>
              </MotionView>
            ))}
          </ScrollView>
        </>
      ) : null}

      {space ? <View style={[styles.membership, { borderColor: palette.border }]}>
        <Text style={[styles.membershipText, { color: palette.muted }]}>Everyone here can add and care for the shared memories.</Text>
        {!pendingExit ? (
          <Pressable accessibilityRole="button" onPress={() => setPendingExit(true)} style={styles.leaveButton}>
            <Text style={[styles.leaveText, { color: palette.primaryPressed }]}>{space?.memberCount === 1 ? 'Delete space' : 'Leave space'}</Text>
          </Pressable>
        ) : (
          <MotionView duration={motion.content} style={styles.exitConfirm}>
            <Text style={[styles.membershipText, { color: palette.ink }]}>{space?.memberCount === 1 ? 'This removes the space and its memories.' : 'You’ll lose access to this timeline.'}</Text>
            <View style={styles.exitButtons}>
              <AppButton label="Cancel" palette={palette} variant="outline" compact onPress={() => setPendingExit(false)} />
              <AppButton label={space?.memberCount === 1 ? 'Delete' : 'Leave'} palette={palette} variant="danger" compact loading={isExiting} onPress={() => void confirmExit()} />
            </View>
          </MotionView>
        )}
      </View> : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  back: { minHeight: 44, justifyContent: 'center', paddingRight: 14, borderRadius: 22 },
  themeButton: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, padding: 24, borderRadius: 32, borderWidth: 1 },
  smallHeading: { padding: 20, gap: 12 },
  headingCopy: { flex: 1, gap: 5 },
  kindLabel: { textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5, fontWeight: '900' },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -1 },
  smallTitle: { fontSize: 30, lineHeight: 37 },
  subtitle: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionGrow: { flex: 1 },
  notice: { marginTop: 12 },
  emptyCard: { borderWidth: 1, borderRadius: 27, alignItems: 'center', padding: 24, marginTop: 22 },
  emptyFlower: { height: 54, width: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  emptyTitle: { fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 390, marginTop: 7 },
  emptyButton: { width: '100%', maxWidth: 350, marginTop: 18 },
  timelineIntro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'baseline', marginTop: 30, marginBottom: 14 },
  timelineLabel: { fontSize: 18, fontWeight: '900' },
  swipeHint: { fontSize: 12, fontWeight: '700' },
  timelineTrack: { gap: 18, paddingHorizontal: 1, paddingBottom: 12 },
  memoryCard: { borderRadius: 28, borderWidth: 1, padding: 10, overflow: 'hidden' },
  imageFrame: { width: '100%', aspectRatio: 1.04, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  photoRetry: { padding: 24, minHeight: 44, justifyContent: 'center' },
  memoryText: { paddingHorizontal: 9, paddingTop: 16, paddingBottom: 4, gap: 10 },
  memoryMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memoryDate: { fontSize: 11, letterSpacing: 0.2, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' },
  timelineNumber: { fontSize: 11, fontWeight: '700' },
  memoryTitle: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 24, lineHeight: 30, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, fontSize: 11, fontWeight: '800' },
  caption: { fontSize: 13, lineHeight: 19 },
  memoryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 3, paddingTop: 10, paddingBottom: 4 },
  openMemory: { fontSize: 12, fontWeight: '700' },
  membership: { marginTop: 26, paddingTop: 17, borderTopWidth: 1, gap: 8 },
  membershipText: { fontSize: 13, lineHeight: 19 },
  leaveButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12, borderRadius: 22 },
  leaveText: { fontSize: 13, fontWeight: '800' },
  exitConfirm: { gap: 11 },
  exitButtons: { flexDirection: 'row', gap: 9 }
});
