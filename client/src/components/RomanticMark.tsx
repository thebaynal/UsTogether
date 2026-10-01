import { StyleSheet, Text, View } from 'react-native';
import type { Palette } from '@/theme/palettes';

/** A tiny paper flower built from shapes; no remote images or animation loops. */
export function RomanticMark({ palette, size = 90 }: { palette: Palette; size?: number }) {
  return <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {[0, 60, 120, 180, 240, 300].map((angle) => <View key={angle} style={[styles.petal, {
      width: size * 0.3, height: size * 0.56, backgroundColor: palette.accent,
      transform: [{ rotate: `${angle}deg` }, { translateY: -size * 0.18 }]
    }]} />)}
    <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFDF6', fontSize: size * 0.2 }}>♡</Text>
    </View>
  </View>;
}
const styles = StyleSheet.create({ petal: { position: 'absolute', borderRadius: 100 } });
