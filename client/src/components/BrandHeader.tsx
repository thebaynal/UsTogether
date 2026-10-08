import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function BrandHeader({ palette, eyebrow = 'A little place for your story', title, subtitle }: {
  palette: Palette; eyebrow?: string; title: string; subtitle?: string;
}) {
  const { width } = useWindowDimensions();
  return (
    <View style={styles.wrap}>
      <View style={styles.kicker}><View style={[styles.dot, { backgroundColor: palette.primary }]} /><Text style={[styles.eyebrow, { color: palette.primaryPressed }]}>{eyebrow}</Text></View>
      <Text accessibilityRole="header" style={[styles.title, width < 600 && styles.smallTitle, { color: palette.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 30 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dot: { height: 7, width: 7, borderRadius: 4 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '800', flexShrink: 1 },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  smallTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, lineHeight: 24, maxWidth: 560 }
});
