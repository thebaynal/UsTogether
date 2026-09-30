import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor, borderColor: palette.border, opacity: disabled ? 0.55 : pressed ? 0.82 : 1 }
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.text, { color }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 40, paddingHorizontal: 14, borderRadius: 14 },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'center' }
});
