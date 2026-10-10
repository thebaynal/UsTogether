import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion, useHoverCapability, type MotionPressableHandle } from '@/components/Motion';
import { AlbumOptionsDialog } from '@/components/AlbumOptionsDialog';
import { PhotoTimeline, focusControl, type PhotoTimelineHandle } from '@/components/PhotoTimeline';
import { useSpaceTheme } from '@/features/spaces/useSpaceTheme';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { LoadingState } from '@/components/LoadingState';
import { listMemories } from '@/features/memories/memoryService';
import { createInvite, deleteSpace, getSpace, leaveSpace } from '@/features/spaces/spaceService';
import type { Memory, Space } from '@/types/domain';
import { getPalette } from '@/theme/palettes';
import { requireSupabase } from '@/lib/supabase';
import { isProtectedReadDenied } from '@/lib/protectedRead';
import { rememberSpaceTheme } from '@/features/spaces/themeCache';

const unavailableAlbum = 'This album is unavailable. Ask a member for an invite, or return to your albums.';

export default function TimelineScreen() {
  const canHover = useHoverCapability();
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const router = useRouter();
  const [space, setSpace] = useState<Space | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [controlsPinned, setControlsPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [controlsDismissed, setControlsDismissed] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pendingExit, setPendingExit] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const active = useRef(false);
  const focusGeneration = useRef(0);
  const request = useRef(0);
  const sharing = useRef(false);
  const exiting = useRef(false);
  const accessRevision = useRef(0);
  const photoTimeline = useRef<PhotoTimelineHandle>(null);
  const controlsTrigger = useRef<MotionPressableHandle>(null);
  const optionsTrigger = useRef<MotionPressableHandle>(null);
  const themeKey = useSpaceTheme(spaceId, space?.themeKey ?? null);
  const palette = getPalette(space?.kind ?? 'couple', themeKey);
  const controlsVisible = controlsPinned || (canHover && hovering && !controlsDismissed) || isSharing || optionsOpen;

  const refresh = useCallback(async () => {
    if (!active.current) return;
    const revision = ++request.current;
    try {
      const [nextSpace, nextMemories] = await Promise.allSettled([getSpace(spaceId), listMemories(spaceId)]);
      if (!active.current || revision !== request.current) return;
      // A successful sibling request must not briefly repopulate private data
      // when the other protected read confirms that access has been revoked.
      for (const result of [nextSpace, nextMemories]) {
        if (result.status === 'rejected' && isProtectedReadDenied(result.reason)) throw result.reason;
      }
      if (nextSpace.status === 'fulfilled') setSpace(nextSpace.value);
      if (nextMemories.status === 'fulfilled') setMemories(nextMemories.value);
      if (nextSpace.status === 'rejected') throw nextSpace.reason;
      if (nextMemories.status === 'rejected') throw nextMemories.reason;
      setError(null);
    } catch (cause) {
      if (active.current && revision === request.current) {
        if (isProtectedReadDenied(cause)) {
          accessRevision.current++;
          setSpace(null);
          setMemories([]);
          setOptionsOpen(false);
          setPendingExit(false);
          setExitError(null);
          setNotice(null);
          setControlsPinned(false);
          setControlsDismissed(true);
          setHovering(false);
          setIsSharing(false);
          setIsExiting(false);
          rememberSpaceTheme(spaceId, null);
          setError(unavailableAlbum);
        } else setError(cause instanceof Error ? cause.message : 'This space could not be loaded.');
      }
    } finally {
      if (active.current && revision === request.current) setIsLoading(false);
    }
  }, [spaceId]);

  useFocusEffect(useCallback(() => {
    focusGeneration.current++;
    active.current = true;
    void refresh();
    return () => { active.current = false; focusGeneration.current++; request.current++; };
  }, [refresh]));

  useEffect(() => {
    const client = requireSupabase();
    const channel = client.channel(`space:${spaceId}:timeline:${Date.now()}:${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memories', filter: `space_id=eq.${spaceId}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces', filter: `id=eq.${spaceId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [spaceId, refresh]);

  const revealControls = useCallback(() => { setControlsPinned(true); setControlsDismissed(false); }, []);
  const closeOptions = useCallback(() => {
    if (exiting.current) return;
    setOptionsOpen(false);
    setPendingExit(false);
    setExitError(null);
    requestAnimationFrame(() => focusControl(optionsTrigger.current ?? controlsTrigger.current));
  }, []);

  const dismissLayer = useCallback(() => {
    if (!active.current) return false;
    if (optionsOpen) { closeOptions(); return true; }
    if (photoTimeline.current?.collapseDetails()) return true;
    if (controlsVisible) {
      setControlsPinned(false);
      setControlsDismissed(true);
      requestAnimationFrame(() => focusControl(controlsTrigger.current));
      return true;
    }
    return false;
  }, [closeOptions, controlsVisible, optionsOpen]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const escape = (event: KeyboardEvent) => {
        // RN Web's Modal owns Escape while its focus trap is active.
        if (!optionsOpen && event.key === 'Escape' && !event.defaultPrevented && dismissLayer()) event.preventDefault();
      };
      document.addEventListener('keydown', escape);
      return () => document.removeEventListener('keydown', escape);
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', dismissLayer);
    return () => subscription.remove();
  }, [dismissLayer, optionsOpen]);

  async function shareInvite() {
    if (sharing.current || !space) return;
    sharing.current = true;
    const revision = accessRevision.current;
    setIsSharing(true);
    setError(null);
    try {
      const invite = await createInvite(spaceId);
      if (!active.current || revision !== accessRevision.current) return;
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await Clipboard.setStringAsync(invite.url);
        if (active.current && revision === accessRevision.current) setNotice('Invite link copied. It expires in 7 days and works once.');
      } else {
        await Share.share({ message: `Come add memories with us: ${invite.url}`, url: invite.url, title: `Join ${space.name}` });
        if (active.current && revision === accessRevision.current) setNotice('Your invite link is ready. It expires in 7 days and works once.');
      }
    } catch (cause) {
      if (active.current && revision === accessRevision.current) setError(cause instanceof Error ? cause.message : 'Could not create an invite link.');
    } finally { sharing.current = false; setIsSharing(false); }
  }

  async function confirmExit() {
    if (!space || exiting.current) return;
    exiting.current = true;
    const revision = accessRevision.current;
    const originFocus = focusGeneration.current;
    setIsExiting(true);
    setExitError(null);
    try {
      if (space.memberCount === 1) await deleteSpace(space.id);
      else await leaveSpace(space.id);
      // A realtime refresh may observe our successful exit before the RPC
      // responds. Complete that exit while still on its originating screen.
      if (active.current && originFocus === focusGeneration.current) router.replace('/spaces');
    } catch (cause) {
      if (active.current && revision === accessRevision.current) setExitError(cause instanceof Error ? cause.message : 'Could not leave this space.');
    } finally { exiting.current = false; setIsExiting(false); }
  }

  return <Page palette={palette}>
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to all spaces" onPress={() => router.replace('/spaces')} style={styles.back}>
        <Text accessible={false} style={{ color: palette.primaryPressed, fontSize: 29, lineHeight: 34 }}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" accessibilityLabel={space?.name ?? 'Your timeline'} numberOfLines={1} style={[styles.title, { color: palette.ink }]}>{space?.name ?? 'Your timeline'}</Text>
      <Pressable ref={controlsTrigger} accessibilityRole="button"
        accessibilityLabel={controlsVisible ? 'Hide album controls' : 'Show album controls'} accessibilityState={{ expanded: controlsVisible }}
        disabled={!space} onPress={() => { setControlsPinned(!controlsVisible); setControlsDismissed(controlsVisible); }}
        style={[styles.controlsTrigger, { backgroundColor: palette.surfaceSoft }]}><Text accessible={false} style={{ color: palette.primaryPressed, fontSize: 22 }}>{controlsVisible ? '×' : '•••'}</Text></Pressable>
    </View>
    <View onPointerEnter={(event) => {
      if (canHover && (event.nativeEvent.pointerType === 'mouse' || event.nativeEvent.pointerType === 'pen')) {
        setHovering(true); setControlsDismissed(false);
      }
    }} onPointerLeave={() => setHovering(false)}>
      <View testID="album-controls" style={styles.toolbarSlot}>
        {controlsVisible && space ? <MotionView duration={motion.content} style={styles.toolbarWrap}>
          <View style={[styles.toolbar, { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Add a memory" disabled={!space} onFocus={revealControls}
              onPress={() => router.push(`/spaces/${spaceId}/new-memory`)} style={[styles.addButton, { backgroundColor: palette.primary }]}><Text style={styles.addText}>＋  Add a memory</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Create an invite link" accessibilityState={{ busy: isSharing }} disabled={!space || isSharing} onFocus={revealControls}
              onPress={() => void shareInvite()} style={[styles.toolbarButton, { backgroundColor: palette.surfaceSoft }]}><Text style={[styles.toolbarText, { color: palette.primaryPressed, opacity: isSharing ? 0 : 1 }]}>Invite</Text>{isSharing ? <ActivityIndicator color={palette.primaryPressed} style={StyleSheet.absoluteFill} /> : null}</Pressable>
            <Pressable ref={optionsTrigger} accessibilityRole="button" accessibilityLabel="Album options" accessibilityState={{ expanded: optionsOpen }} disabled={!space} onFocus={revealControls}
              onPress={() => { revealControls(); setOptionsOpen(true); }} style={[styles.optionsButton, { backgroundColor: palette.surfaceSoft }]}><Text accessible={false} style={{ color: palette.primaryPressed, fontSize: 20 }}>•••</Text></Pressable>
          </View>
        </MotionView> : null}
      </View>
      {notice ? <View style={styles.notice}><Notice palette={palette} tone="success">{notice}</Notice></View> : null}
      {error ? <View style={styles.error}><Notice palette={palette} tone="error">{error}</Notice><View style={styles.retry}><AppButton label="Retry loading memories" palette={palette} variant="outline" compact onPress={() => void refresh()} /></View></View> : null}
      {isLoading ? <LoadingState palette={palette} label="Gathering your memories…" /> : null}
      {!isLoading && !error && memories.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text accessible={false} style={[styles.emptyMark, { color: palette.primaryPressed }]}>♡</Text>
        <Text style={[styles.emptyTitle, { color: palette.ink }]}>Your first memory is waiting</Text>
        <Text style={[styles.emptyCopy, { color: palette.muted }]}>Add a photo and a date. It will find its place in your timeline.</Text>
        <View style={styles.emptyButton}><AppButton label="Add the first memory" palette={palette} disabled={!space} onPress={() => router.push(`/spaces/${spaceId}/new-memory`)} /></View>
      </View> : null}
      {memories.length > 0 ? <PhotoTimeline ref={photoTimeline} memories={memories} palette={palette} onRevealControls={revealControls}
        restoreFocusEnabled={!optionsOpen} onRetry={() => void refresh()} onOpen={(memory) => router.push(`/memories/${memory.id}?spaceId=${spaceId}`)} /> : null}
    </View>
    {space ? <AlbumOptionsDialog visible={optionsOpen} space={space} memoryCount={memories.length} palette={palette} pendingExit={pendingExit} isExiting={isExiting} error={exitError}
      onClose={closeOptions} onChangeTheme={() => { setOptionsOpen(false); setPendingExit(false); router.push(`/spaces/${spaceId}/theme`); }}
      onRequestExit={() => setPendingExit(true)} onCancelExit={() => { setPendingExit(false); setExitError(null); }} onConfirmExit={() => void confirmExit()} /> : null}
  </Page>;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  back: { height: 44, width: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  controlsTrigger: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 24, lineHeight: 30, letterSpacing: -0.6, fontWeight: '700', textAlign: 'center' },
  toolbarSlot: { height: 72, justifyContent: 'center', alignItems: 'center' },
  toolbarWrap: { width: '100%', maxWidth: 480 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 31, borderWidth: 1, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  addButton: { flex: 1, minHeight: 44, borderRadius: 22, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  toolbarButton: { minHeight: 44, minWidth: 68, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  toolbarText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  optionsButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  notice: { marginBottom: 16 },
  error: { gap: 12, marginBottom: 18 },
  retry: { width: '100%', maxWidth: 240, alignSelf: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 28, alignItems: 'center', padding: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  emptyMark: { fontSize: 46, marginBottom: 14 },
  emptyTitle: { fontSize: 19, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 360, marginTop: 8 },
  emptyButton: { width: '100%', maxWidth: 300, marginTop: 22 }
});
