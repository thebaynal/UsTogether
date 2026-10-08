import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function PaperPanel({ palette, children, style }: { palette: Palette; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  return <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border, padding: width < 600 ? 18 : 26 }, style]}>{children}</View>;
}

const styles = StyleSheet.create({ panel: { borderWidth: 1, borderRadius: 28, width: '100%' } });
