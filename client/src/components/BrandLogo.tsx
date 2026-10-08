import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';

export function BrandLogo({ palette, size = 38, wordmark = true }: {
  palette: Palette; size?: number; wordmark?: boolean;
}) {
  return (
    <View accessible accessibilityLabel="UsTogether" style={styles.lockup}>
      <Image source={require('../../assets/brand/ustogether-mark.png')}
        accessible={false} style={{ width: size, height: size }} resizeMode="contain" />
      {wordmark ? <Text accessible={false} style={[styles.wordmark, { color: palette.ink }]}>UsTogether</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  wordmark: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 23, lineHeight: 29,
    letterSpacing: -0.9, fontWeight: '700' }
});
