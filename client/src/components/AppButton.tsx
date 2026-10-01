import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MotionPressable } from './Motion';
import type { Palette } from '@/theme/palettes';

type Props = {
  label: string;
  palette: Palette;
  onPress: () => void;
  variant?: 'primary' | 'soft' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
};

export function AppButton({ label, palette, onPress, variant = 'primary', disabled, loading, compact, accessibilityLabel }: Props) {
  const backgroundColor = variant === 'primary' ? palette.primary
    : variant === 'danger' ? palette.danger
      : variant === 'soft' ? palette.surfaceSoft : 'transparent';
  const color = variant === 'soft' || variant === 'outline' ? palette.ink : '#FFFFFF';

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor, borderColor: palette.border, opacity: disabled ? 0.55 : pressed ? 0.82 : 1 }
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.text, { color, opacity: loading ? 0 : 1 }]}>{label}</Text>
        {loading ? <ActivityIndicator color={color} style={StyleSheet.absoluteFill} /> : null}
      </View>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, paddingHorizontal: 23, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 44, paddingHorizontal: 18, borderRadius: 24 },
  content: { alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' }
});
