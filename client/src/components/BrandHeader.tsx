import { Platform, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function BrandHeader({ palette, eyebrow = 'A little place for your story', title, subtitle }: {
  palette: Palette; eyebrow?: string; title: string; subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.kicker}><View style={[styles.dot, { backgroundColor: palette.primary }]} /><Text style={[styles.eyebrow, { color: palette.primaryPressed }]}>{eyebrow}</Text></View>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 30 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 7, width: 7, borderRadius: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: '800' },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 38, lineHeight: 44, fontWeight: '700', letterSpacing: -1.2 },
  subtitle: { fontSize: 15, lineHeight: 24, maxWidth: 560 }
});
