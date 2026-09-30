import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function BrandHeader({ palette, eyebrow = 'A little place for your story', title, subtitle }: {
  palette: Palette; eyebrow?: string; title: string; subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: palette.primaryPressed }]}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 22 },
  eyebrow: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '800' },
  title: { fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22, maxWidth: 620 }
});
