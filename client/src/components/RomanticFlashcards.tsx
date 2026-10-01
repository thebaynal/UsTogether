import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MotionPressable, useReducedMotion } from './Motion';
import { RomanticMark } from './RomanticMark';
import { palettes } from '@/theme/palettes';

const cards = [
  { title: 'Your people.', caption: 'A little closer to the ones you love.', palette: palettes.rose },
  { title: 'Your moments.', caption: 'Keep the little things that mean everything.', palette: palettes.lavender },
  { title: 'Your story.', caption: 'A beautiful collection of days, together.', palette: palettes.peach }
];
// The boundary copies allow forward and backward loops without a visible rewind.
const slides = [cards[2], ...cards, cards[0]];
const interval = 4000;
const gap = 12;
const peek = 28;

export function RomanticFlashcards({ paused }: { paused: boolean }) {
  const reduced = useReducedMotion();
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const position = useRef(1);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [controlFocused, setControlFocused] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [screenFocused, setScreenFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [visible, setVisible] = useState(Platform.OS !== 'web' || typeof document === 'undefined' || !document.hidden);
  const stride = Math.max(1, width - peek);
  const cardWidth = stride - gap;

  useFocusEffect(useCallback(() => {
    setScreenFocused(true);
    return () => setScreenFocused(false);
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    if (Platform.OS !== 'web') return () => subscription.remove();
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { subscription.remove(); document.removeEventListener('visibilitychange', change); };
  }, []);

  useLayoutEffect(() => {
    if (!width) return;
    offset.current = position.current * stride;
    scroll.current?.scrollTo({ x: offset.current, animated: false });
  }, [stride, width]);

  const settle = useCallback(() => {
    if (!width) return;
    let next = Math.max(0, Math.min(slides.length - 1, Math.round(offset.current / stride)));
    const logical = (next + cards.length - 1) % cards.length;
    if (next === 0 || next === slides.length - 1) {
      next = logical + 1;
      offset.current = next * stride;
      scroll.current?.scrollTo({ x: offset.current, animated: false });
    }
    position.current = next;
    setActive(logical);
    setScrolling(false);
  }, [stride, width]);

  const moveTo = useCallback((next: number) => {
    if (!width) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setCountdown((value) => value + 1);
    if (Math.abs(offset.current - next * stride) < 1) {
      setScrolling(false);
      return;
    }
    if (reduced) {
      position.current = next;
      offset.current = next * stride;
      setActive((next + cards.length - 1) % cards.length);
    }
    setScrolling(!reduced);
    scroll.current?.scrollTo({ x: next * stride, animated: !reduced });
  }, [reduced, stride, width]);

  const autoPlaying = !paused && !userPaused && !reduced && !touching && !hovering && !controlFocused
    && !scrolling && screenFocused && foreground && visible && width > 0;
  useEffect(() => {
    if (!autoPlaying) return;
    const timer = setTimeout(() => moveTo(position.current + 1), interval);
    return () => clearTimeout(timer);
  }, [autoPlaying, active, countdown, moveTo]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    offset.current = event.nativeEvent.contentOffset.x;
    setScrolling(true);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    // RN Web does not emit momentum-end events, so also settle after scroll inactivity.
    settleTimer.current = setTimeout(settle, 180);
  }

  return <View accessibilityLiveRegion="none" testID="romantic-flashcards"
    onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)}
    onTouchStart={() => setTouching(true)} onTouchEnd={() => setTouching(false)} onTouchCancel={() => setTouching(false)}
    style={styles.wrap}>
    <ScrollView ref={scroll} testID="romantic-flashcards-scroll" horizontal
      pagingEnabled={Platform.OS === 'web'}
      showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      snapToInterval={stride} snapToAlignment="start" decelerationRate="fast" disableIntervalMomentum
      contentContainerStyle={{ paddingRight: peek }} style={styles.strip}
      onScroll={onScroll} scrollEventThrottle={16}
      onScrollBeginDrag={() => setScrolling(true)} onMomentumScrollEnd={settle}>
      {width > 0 && slides.map((card, index) => {
        const clone = index === 0 || index === slides.length - 1;
        return <View key={index} style={{ width: stride, paddingRight: gap }}
          accessibilityElementsHidden={clone} importantForAccessibility={clone ? 'no-hide-descendants' : 'auto'}
          aria-hidden={clone}>
          <View style={[styles.card, { width: cardWidth, backgroundColor: card.palette.surfaceSoft, borderColor: card.palette.border }]}>
            <View style={styles.cardTop}>
              <Text style={[styles.number, { color: card.palette.primaryPressed }]}>0{(index + cards.length - 1) % cards.length + 1} / 03</Text>
              <RomanticMark palette={card.palette} size={52} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: palettes.rose.ink }]}>{card.title}</Text>
            <Text style={[styles.caption, { color: palettes.rose.ink }]}>{card.caption}</Text>
          </View>
        </View>;
      })}
    </ScrollView>
    <View style={styles.controls}>
      <View style={styles.dots}>
        {cards.map((card, index) => <MotionPressable key={card.title} accessibilityRole="button"
          accessibilityLabel={`Show ${card.title} card`} accessibilityState={{ selected: active === index }}
          aria-pressed={active === index}
          onFocus={() => setControlFocused(true)} onBlur={() => setControlFocused(false)}
          onPress={() => moveTo(index + 1)} style={styles.dotButton}>
          <View style={[styles.dot, { backgroundColor: active === index ? palettes.rose.primaryPressed : palettes.rose.border }, active === index && styles.activeDot]} />
        </MotionPressable>)}
      </View>
      <MotionPressable accessibilityRole="button"
        accessibilityLabel={reduced ? 'Automatic scrolling disabled for reduced motion' : userPaused ? 'Play flashcards' : 'Pause flashcards'}
        accessibilityState={{ disabled: reduced }} disabled={reduced}
        aria-disabled={reduced}
        onFocus={() => setControlFocused(true)} onBlur={() => setControlFocused(false)}
        onPress={() => setUserPaused((value) => !value)} style={styles.playButton}>
        <Text style={[styles.playText, { color: palettes.rose.primaryPressed }]}>{reduced ? 'Manual' : userPaused ? '▷ Play' : 'Ⅱ Pause'}</Text>
      </MotionPressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 3 },
  strip: { flexGrow: 0, borderRadius: 28 },
  card: { minHeight: 205, borderRadius: 28, borderWidth: 1, padding: 22, justifyContent: 'flex-end', gap: 9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 },
  number: { fontSize: 11, letterSpacing: 1.8, fontWeight: '800' },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 31, lineHeight: 37, fontWeight: '700', letterSpacing: -0.8 },
  caption: { fontSize: 14, lineHeight: 21, maxWidth: 300 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  dots: { flexDirection: 'row' },
  dotButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  dot: { width: 7, height: 7, borderRadius: 7 },
  activeDot: { width: 22 },
  playButton: { minWidth: 76, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  playText: { fontSize: 12, fontWeight: '700' }
});
