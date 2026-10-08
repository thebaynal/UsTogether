import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function LoadingState({ palette, label }: { palette: Palette; label: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.wrap, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    <ActivityIndicator color={palette.primary} />
    <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 24, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 12, marginVertical: 12 },
  label: { fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' }
});
