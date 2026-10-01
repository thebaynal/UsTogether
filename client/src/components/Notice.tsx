import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';
import { MotionView, motion } from './Motion';

export function Notice({ palette, children, tone = 'info' }: { palette: Palette; children: string; tone?: 'info' | 'error' | 'success' }) {
  const color = tone === 'error' ? palette.danger : tone === 'success' ? palette.primaryPressed : palette.ink;
  const backgroundColor = tone === 'error' ? '#FFF0F1' : palette.surfaceSoft;
  return (
    <MotionView duration={motion.content}>
    <View accessibilityRole="alert" style={[styles.box, { backgroundColor, borderColor: palette.border }]}>
      <Text style={[styles.text, { color }]}>{children}</Text>
    </View>
    </MotionView>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12 },
  text: { fontSize: 14, lineHeight: 20, fontWeight: '600' }
});
