import { createContext, forwardRef, useContext, useEffect, useRef, useState, type ComponentRef, type KeyboardEvent, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export const motion = { press: 120, content: 220, entrance: 300 };
const ReducedMotion = createContext(true);
const HoverCapability = createContext(false);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : true);
  const [canHover, setCanHover] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches : false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const hoverQuery = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
      const change = () => setReduced(query.matches);
      const hoverChange = () => setCanHover(hoverQuery.matches);
      change();
      hoverChange();
      query.addEventListener('change', change);
      hoverQuery.addEventListener('change', hoverChange);
      return () => { query.removeEventListener('change', change); hoverQuery.removeEventListener('change', hoverChange); };
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) { setReduced(value); setReady(true); } })
      .catch(() => { if (active) setReady(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}><HoverCapability.Provider value={canHover}>{ready ? children : null}</HoverCapability.Provider></ReducedMotion.Provider>;
}

export const useReducedMotion = () => useContext(ReducedMotion);
export const useHoverCapability = () => useContext(HoverCapability);

export function MotionView({ children, style, index = 0, duration = motion.entrance }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; index?: number; duration?: number;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.stopAnimation(); progress.setValue(1); return; }
    const animation = Animated.timing(progress, {
      toValue: 1, duration, delay: Math.min(index * 40, 200),
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web'
    });
    animation.start();
    return () => animation.stop();
  }, [duration, index, progress, reduced]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{children}</Animated.View>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export type MotionPressableHandle = ComponentRef<typeof Pressable>;
type MotionPressableProps = PressableProps & {
  'aria-pressed'?: boolean | 'mixed';
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};
export const MotionPressable = forwardRef<MotionPressableHandle, MotionPressableProps>(function MotionPressable({ style, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...props }, ref) {
  const reduced = useReducedMotion();
  const canHover = useHoverCapability();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // React Native Web 0.21 reads ARIA props rather than accessibilityState.
  // Keep the native state and expose the equivalent web state on the same node.
  const state = props.accessibilityState;
  const webState = Platform.OS === 'web' ? {
    'aria-busy': props['aria-busy'] ?? state?.busy,
    'aria-checked': props['aria-checked'] ?? state?.checked,
    // RN Web Pressable derives aria-disabled from disabled; callers also pass that prop.
    'aria-disabled': props['aria-disabled'] ?? (props.disabled || state?.disabled),
    'aria-expanded': props['aria-expanded'] ?? state?.expanded,
    'aria-pressed': props['aria-pressed'] ?? (props.accessibilityRole === 'button' ? state?.selected : undefined)
  } : {};
  const resolvedStyle = typeof style === 'function' ? style({ pressed, hovered }) : style;
  const styleOpacity = StyleSheet.flatten(resolvedStyle)?.opacity;
  const baseOpacity = typeof styleOpacity === 'number' ? styleOpacity : 1;
  const targetOpacity = !props.disabled && pressed ? Math.min(baseOpacity, 0.86)
    : canHover && hovered && !props.disabled ? Math.min(baseOpacity, 0.94) : baseOpacity;
  useEffect(() => {
    opacity.stopAnimation();
    const animation = Animated.timing(opacity, { toValue: targetOpacity, duration: reduced ? 0 : pressed ? motion.press : motion.content, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [opacity, pressed, reduced, targetOpacity]);
  const animate = (next: boolean) => {
    setPressed(next);
    // Retarget the presentation value on press-down/release. Rapid taps never
    // finish an old animation or reset the control to an earlier logical target.
    scale.stopAnimation();
    if (reduced) { scale.setValue(1); return; }
    Animated.timing(scale, { toValue: next && !props.disabled ? 0.975 : 1, duration: motion.press,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  };
  useEffect(() => { if (reduced || props.disabled) { scale.stopAnimation(); scale.setValue(1); setPressed(false); } }, [reduced, props.disabled, scale]);
  useEffect(() => { if (!canHover) setHovered(false); }, [canHover]);
  useEffect(() => () => { scale.stopAnimation(); opacity.stopAnimation(); }, [opacity, scale]);
  return <AnimatedPressable ref={ref} {...props} {...webState}
    onPressIn={(event) => { animate(true); onPressIn?.(event); }}
    onPressOut={(event) => { animate(false); onPressOut?.(event); }}
    onHoverIn={(event) => { if (canHover) { setHovered(true); onHoverIn?.(event); } }}
    onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
    onFocus={(event) => {
      const node = event.currentTarget as unknown as HTMLElement;
      setFocused(Platform.OS !== 'web' || !node.matches || node.matches(':focus-visible'));
      onFocus?.(event);
    }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[resolvedStyle,
      focused && { outlineColor: '#502B42', outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 4 },
      { opacity, transform: [{ scale }] }]}
  />;
});

// Palette colors are opaque hex values. Mirror Animated's RGB interpolation to
// capture the visible color when a second palette is selected mid-transition.
function presentedColor(from: string, to: string, fraction: number) {
  if (!/^#[\da-f]{6}$/i.test(from) || !/^#[\da-f]{6}$/i.test(to)) return fraction < 1 ? from : to;
  const amount = Math.max(0, Math.min(1, fraction));
  return `#${[1, 3, 5].map((index) => {
    const start = parseInt(from.slice(index, index + 2), 16);
    const end = parseInt(to.slice(index, index + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  }).join('')}`;
}

export function useAnimatedColor(color: string) {
  const reduced = useReducedMotion();
  const transition = useRef({ from: color, to: color });
  const revision = useRef(0);
  const [range, setRange] = useState([color, color]);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const currentRevision = ++revision.current;
    if (reduced) {
      progress.stopAnimation();
      transition.current = { from: color, to: color };
      setRange([color, color]);
      progress.setValue(1);
      return;
    }
    if (transition.current.to === color) return;
    let animation: Animated.CompositeAnimation | undefined;
    progress.stopAnimation((value) => {
      if (revision.current !== currentRevision) return;
      const from = presentedColor(transition.current.from, transition.current.to, value);
      transition.current = { from, to: color };
      setRange([from, color]);
      progress.setValue(0);
      animation = Animated.timing(progress, { toValue: 1, duration: motion.content,
        easing: Easing.out(Easing.cubic), useNativeDriver: false });
      animation.start();
    });
    return () => { revision.current++; animation?.stop(); };
  }, [color, progress, reduced]);
  return reduced ? color : progress.interpolate({ inputRange: [0, 1], outputRange: range });
}
