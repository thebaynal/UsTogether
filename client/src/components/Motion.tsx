import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

export const motion = { press: 120, content: 220, entrance: 300 };
const ReducedMotion = createContext(true);

export function MotionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [reduced, setReduced] = useState(() => Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      const change = () => setReduced(query.matches);
      change();
      query.addEventListener('change', change);
      return () => query.removeEventListener('change', change);
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) { setReduced(value); setReady(true); } })
      .catch(() => { if (active) setReady(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return <ReducedMotion.Provider value={reduced}>{ready ? children : null}</ReducedMotion.Provider>;
}

export const useReducedMotion = () => useContext(ReducedMotion);

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
export function MotionPressable({ style, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...props }: PressableProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const resolvedStyle = typeof style === 'function' ? style({ pressed, hovered }) : style;
  const styleOpacity = StyleSheet.flatten(resolvedStyle)?.opacity;
  const baseOpacity = typeof styleOpacity === 'number' ? styleOpacity : 1;
  const targetOpacity = hovered && !props.disabled ? Math.min(baseOpacity, 0.9) : baseOpacity;
  useEffect(() => {
    const animation = Animated.timing(opacity, { toValue: targetOpacity, duration: reduced ? 0 : pressed ? motion.press : motion.content, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [opacity, pressed, reduced, targetOpacity]);
  const animate = (next: boolean) => {
    setPressed(next);
    Animated.timing(scale, { toValue: next && !reduced ? 0.975 : 1, duration: reduced ? 0 : motion.press, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  useEffect(() => { if (reduced || props.disabled) { scale.stopAnimation(); scale.setValue(1); setPressed(false); } }, [reduced, props.disabled, scale]);
  return <AnimatedPressable {...props}
    onPressIn={(event) => { animate(true); onPressIn?.(event); }}
    onPressOut={(event) => { animate(false); onPressOut?.(event); }}
    onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
    onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }}
    style={[resolvedStyle,
      focused && { outlineColor: '#502B42', outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 4 },
      { opacity, transform: [{ scale }] }]}
  />;
}

export function useAnimatedColor(color: string) {
  const reduced = useReducedMotion();
  const previous = useRef(color);
  const [range, setRange] = useState([color, color]);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { progress.stopAnimation(); progress.setValue(1); }
    if (previous.current === color) return;
    progress.stopAnimation();
    setRange([previous.current, color]);
    previous.current = color;
    progress.setValue(reduced ? 1 : 0);
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : motion.content, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [color, progress, reduced]);
  return reduced ? color : progress.interpolate({ inputRange: [0, 1], outputRange: range });
}
