import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { AppButton } from './AppButton';
import { MotionPressable, MotionView, motion, useReducedMotion, type MotionPressableHandle } from './Motion';
import { PaperPanel } from './PaperPanel';
import { formatMemoryDate } from '@/features/memories/logic';
import type { Memory } from '@/types/domain';
import type { Palette } from '@/theme/palettes';

export type PhotoTimelineHandle = { collapseDetails: () => boolean; focusActive: () => void };
type Props = {
  memories: Memory[];
  palette: Palette;
  onOpen: (memory: Memory) => void;
  onRetry: () => void;
  onRevealControls: () => void;
  restoreFocusEnabled?: boolean;
};

// RN Web 0.21 does not implement the native snapToInterval props. These styles
// keep browser scrolling native while centering the same measured card geometry.
const webRail = { scrollSnapType: 'x mandatory' } as ViewStyle;
const webCard = { scrollSnapAlign: 'center', scrollSnapStop: 'always' } as ViewStyle;

export function focusControl(control: MotionPressableHandle | null | undefined) {
  if (!control) return;
  if (Platform.OS === 'web') {
    (control as unknown as HTMLElement).focus({ preventScroll: true });
  } else control.focus();
}

export const PhotoTimeline = forwardRef<PhotoTimelineHandle, Props>(function PhotoTimeline({ memories, palette, onOpen, onRetry, onRevealControls, restoreFocusEnabled = true }, ref) {
  const reduced = useReducedMotion();
  const rail = useRef<ScrollView>(null);
  const photos = useRef(new Map<string, MotionPressableHandle>());
  const [viewport, setViewport] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const active = useRef<string | null>(null);
  const expanded = useRef<string | null>(null);
  const offset = useRef(0);
  const oldOrder = useRef<string[]>([]);
  const oldStride = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreFrame = useRef<number | null>(null);
  const restoreOffset = useRef<number | null>(null);
  const programmatic = useRef(false);
  const dragging = useRef(false);
  const touching = useRef(false);
  const press = useRef<{ x: number; y: number; offset: number; moved: boolean } | null>(null);
  const imageUrls = useRef(new Map<string, string>());
  const initialEntrances = useRef<Map<string, number> | null>(null);
  const cardWidth = Math.min(viewport * 0.82, 480);
  const stride = cardWidth + 18;
  const edge = Math.max(0, (viewport - cardWidth) / 2);
  const order = memories.map((memory) => memory.id).join(',');
  const selected = memories.find((memory) => memory.id === expandedId);
  if (viewport > 0 && memories.length > 0 && initialEntrances.current === null) {
    initialEntrances.current = new Map(memories.slice(0, Math.ceil(viewport / stride)).map((memory, index) => [memory.id, index]));
  }

  const setExpanded = useCallback((id: string | null) => {
    expanded.current = id;
    setExpandedId(id);
  }, []);

  const focusActive = useCallback(() => {
    if (active.current) focusControl(photos.current.get(active.current));
  }, []);

  const collapseDetails = useCallback(() => {
    const id = expanded.current;
    if (!id) return false;
    setExpanded(null);
    requestAnimationFrame(() => focusControl(photos.current.get(id) ?? photos.current.get(active.current ?? '')));
    return true;
  }, [setExpanded]);

  useImperativeHandle(ref, () => ({ collapseDetails, focusActive }), [collapseDetails, focusActive]);

  const markUserIntent = useCallback(() => {
    programmatic.current = false;
    restoreOffset.current = null;
    if (programTimer.current) clearTimeout(programTimer.current);
  }, []);

  const markProgrammatic = useCallback((target: number) => {
    if (programTimer.current) clearTimeout(programTimer.current);
    programmatic.current = Math.abs(offset.current - target) > 1;
    // A zero-distance scroll has no event. A bounded fallback also handles
    // platform/browser cancellation before an expected completion event.
    if (programmatic.current) programTimer.current = setTimeout(() => { programmatic.current = false; }, 500);
  }, []);

  const center = useCallback((id: string, animate = true) => {
    const index = memories.findIndex((memory) => memory.id === id);
    if (index < 0 || !viewport) return;
    active.current = id;
    setActiveId(id);
    const target = index * stride;
    markProgrammatic(target);
    rail.current?.scrollTo({ x: target, animated: animate && !reduced });
    if (!animate || reduced) offset.current = target;
  }, [markProgrammatic, memories, reduced, stride, viewport]);

  const applyRestore = useCallback(() => {
    if (restoreOffset.current === null) return;
    const target = restoreOffset.current;
    markProgrammatic(target);
    rail.current?.scrollTo({ x: target, animated: false });
    offset.current = target;
  }, [markProgrammatic]);

  useLayoutEffect(() => {
    if (!viewport || !memories.length) return;
    const previousIndex = Math.max(0, oldOrder.current.indexOf(active.current ?? ''));
    let index = memories.findIndex((memory) => memory.id === active.current);
    if (index < 0) index = Math.min(previousIndex, memories.length - 1);
    const nextId = memories[index].id;
    active.current = nextId;
    setActiveId(nextId);
    if (expanded.current && !memories.some((memory) => memory.id === expanded.current)) {
      setExpanded(null);
      if (restoreFocusEnabled) requestAnimationFrame(() => focusControl(photos.current.get(nextId)));
    }
    if (oldOrder.current.join(',') !== order || oldStride.current !== stride) {
      restoreOffset.current = index * stride;
      applyRestore();
      if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
      restoreFrame.current = requestAnimationFrame(applyRestore);
    }
    oldOrder.current = memories.map((memory) => memory.id);
    oldStride.current = stride;
  }, [applyRestore, memories, order, restoreFocusEnabled, setExpanded, stride, viewport]);

  useEffect(() => {
    const nextUrls = new Map(memories.map((memory) => [memory.id, memory.imageUrl]));
    const previousUrls = imageUrls.current;
    setFailedImages((current) => {
      const kept = Object.entries(current).filter(([id]) => nextUrls.has(id) && nextUrls.get(id) === previousUrls.get(id));
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
    });
    imageUrls.current = nextUrls;
  }, [memories]);

  const settle = useCallback(() => {
    if (!viewport || !memories.length || touching.current) return;
    const index = Math.max(0, Math.min(memories.length - 1, Math.round(offset.current / stride)));
    const id = memories[index].id;
    if (!programmatic.current && active.current !== id) setExpanded(null);
    active.current = id;
    setActiveId(id);
    dragging.current = false;
    programmatic.current = false;
    restoreOffset.current = null;
  }, [memories, setExpanded, stride, viewport]);

  useEffect(() => {
    if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
  }, [settle]);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextOffset = event.nativeEvent.contentOffset.x;
    if (press.current && Math.abs(nextOffset - press.current.offset) > 5) press.current.moved = true;
    offset.current = nextOffset;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, 160);
  }

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    if (programTimer.current) clearTimeout(programTimer.current);
  }, []);

  function togglePhoto(memory: Memory) {
    if (dragging.current || press.current?.moved) { press.current = null; return; }
    press.current = null;
    center(memory.id);
    setExpanded(expanded.current === memory.id ? null : memory.id);
    onRevealControls();
  }

  function navigatePhoto(index: number) {
    const memory = memories[Math.max(0, Math.min(memories.length - 1, index))];
    if (!memory) return;
    setExpanded(null);
    center(memory.id);
    focusControl(photos.current.get(memory.id));
    onRevealControls();
  }

  return <View testID="timeline-stage" accessibilityLiveRegion="none" onLayout={(event) => setViewport(event.nativeEvent.layout.width)} style={styles.stage}>
    <ScrollView ref={rail} testID="memory-photo-rail" horizontal
      showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      snapToInterval={Platform.OS === 'web' ? undefined : stride} snapToAlignment="start"
      decelerationRate="fast" disableIntervalMomentum
      style={[styles.rail, Platform.OS === 'web' && webRail]}
      contentContainerStyle={[styles.track, { paddingHorizontal: edge }]}
      onScroll={onScroll} scrollEventThrottle={16}
      onTouchStart={() => { touching.current = true; markUserIntent(); }}
      onTouchEnd={() => {
        touching.current = false;
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(settle, 160);
      }}
      onTouchCancel={() => { touching.current = false; }}
      {...(Platform.OS === 'web' ? { onWheel: markUserIntent } : {})}
      onScrollBeginDrag={() => { dragging.current = true; markUserIntent(); }}
      onScrollEndDrag={() => { dragging.current = false; }}
      onMomentumScrollEnd={settle}
      onContentSizeChange={applyRestore}>
      {viewport > 0 && memories.map((memory, index) => {
        const shown = expandedId === memory.id;
        const failed = !memory.imageUrl || failedImages[memory.id];
        const entranceIndex = initialEntrances.current?.get(memory.id);
        const CardEntrance = entranceIndex === undefined ? View : MotionView;
        return <CardEntrance key={memory.id} {...(entranceIndex === undefined ? {} : { index: entranceIndex, duration: motion.entrance })}
          style={[{ width: cardWidth }, Platform.OS === 'web' && webCard]}>
          <View testID={`photo-card-${memory.id}`} style={[styles.photoCard, { backgroundColor: palette.surface, shadowColor: palette.shadow, borderColor: shown ? palette.primary : activeId === memory.id ? palette.accent : palette.border }]}>
            <MotionPressable ref={(node) => { if (node) photos.current.set(memory.id, node); else photos.current.delete(memory.id); }}
              testID={`photo-toggle-${memory.id}`} accessibilityRole="button"
              accessibilityLabel={`${shown ? 'Hide' : 'Show'} details for ${memory.title}`}
              accessibilityHint="Tap to reveal this memory’s story. Swipe to browse photos."
              accessibilityState={{ expanded: shown }}
              onFocus={() => {
                if (active.current !== memory.id) { setExpanded(null); center(memory.id, false); }
                onRevealControls();
              }}
              onPressIn={(event) => { press.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, offset: offset.current, moved: false }; }}
              onTouchMove={(event) => { if (press.current && Math.hypot(event.nativeEvent.pageX - press.current.x, event.nativeEvent.pageY - press.current.y) > 8) press.current.moved = true; }}
              onPress={() => togglePhoto(memory)}
              {...(Platform.OS === 'web' ? { onKeyDown: (event) => {
                if (event.key === 'ArrowRight') { event.preventDefault(); navigatePhoto(index + 1); }
                else if (event.key === 'ArrowLeft') { event.preventDefault(); navigatePhoto(index - 1); }
                else if (event.key === 'Home') { event.preventDefault(); navigatePhoto(0); }
                else if (event.key === 'End') { event.preventDefault(); navigatePhoto(memories.length - 1); }
                else if (event.key === 'Escape' && collapseDetails()) { event.preventDefault(); event.stopPropagation(); }
              } } : {})}
              style={[styles.photoButton, { backgroundColor: palette.surfaceSoft }]}>
              {failed ? <View style={styles.unavailable}><Text style={[styles.unavailableMark, { color: palette.primaryPressed }]}>♡</Text><Text style={[styles.unavailableText, { color: palette.muted }]}>This photo needs another look.</Text></View>
                : <Image source={{ uri: memory.imageUrl }} resizeMode="contain" accessible={false} style={styles.photo}
                  onError={() => setFailedImages((current) => ({ ...current, [memory.id]: true }))} />}
            </MotionPressable>
            {failed ? <MotionPressable accessibilityRole="button" accessibilityLabel={`Reload photo for ${memory.title}`}
              onPress={() => { setFailedImages((current) => { const next = { ...current }; delete next[memory.id]; return next; }); onRetry(); }}
              style={[styles.retryPhoto, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={{ color: palette.primaryPressed, fontWeight: '800', fontSize: 12 }}>Retry photo</Text></MotionPressable> : null}
          </View>
        </CardEntrance>;
      })}
    </ScrollView>
    <View style={styles.railCaption}>
      <Text style={[styles.hint, { color: palette.muted }]}>Swipe through your days. Tap a photo for its story.</Text>
    </View>
    {selected ? <View testID={`memory-details-${selected.id}`} style={{ width: cardWidth, maxWidth: '100%', alignSelf: 'center' }}>
      <MotionView key={selected.id} duration={motion.content}>
        <PaperPanel palette={palette} style={styles.details}>
          <View style={styles.detailTop}><Text style={[styles.date, { color: palette.primaryPressed }]}>{formatMemoryDate(selected.date)}</Text>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Close memory details" onPress={collapseDetails} style={styles.closeDetails}><Text style={{ color: palette.primaryPressed, fontSize: 23 }}>×</Text></MotionPressable></View>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{selected.title}</Text>
          {selected.milestoneTag ? <Text style={[styles.tag, { color: palette.primaryPressed, backgroundColor: palette.surfaceSoft }]}>{selected.milestoneTag}</Text> : null}
          {selected.caption ? <Text style={[styles.caption, { color: palette.muted }]}>{selected.caption}</Text> : null}
          <AppButton label="Open memory" palette={palette} onPress={() => onOpen(selected)} compact />
        </PaperPanel>
      </MotionView>
    </View> : null}
  </View>;
});

const styles = StyleSheet.create({
  stage: { width: '100%' },
  rail: { flexGrow: 0, width: '100%' },
  track: { gap: 18, paddingTop: 8, paddingBottom: 14 },
  photoCard: { padding: 10, borderWidth: 1, borderRadius: 28, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 },
  photoButton: { width: '100%', aspectRatio: 1, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  unavailable: { padding: 24, alignItems: 'center', gap: 12, paddingBottom: 64 },
  unavailableMark: { fontSize: 42 },
  unavailableText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retryPhoto: { position: 'absolute', bottom: 22, alignSelf: 'center', minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, justifyContent: 'center' },
  railCaption: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingHorizontal: 18, marginTop: 4, marginBottom: 22 },
  hint: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  details: { gap: 12 },
  detailTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  date: { fontSize: 11, lineHeight: 17, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '700', flexShrink: 1 },
  closeDetails: { height: 44, width: 44, marginRight: -9, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 27, lineHeight: 34, letterSpacing: -0.6, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', fontSize: 11, lineHeight: 16, fontWeight: '700', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, overflow: 'hidden' },
  caption: { fontSize: 15, lineHeight: 23 }
});
