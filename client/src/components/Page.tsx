import type { ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, useWindowDimensions, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '@/theme/palettes';
import { MotionView, useAnimatedColor } from './Motion';

type Props = {
  palette: Palette;
  children: ReactNode;
  scroll?: boolean;
  layout?: 'wide' | 'form' | 'reading';
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
};

export function Page({ palette, children, scroll = true, layout = 'wide', contentContainerStyle, scrollProps }: Props) {
  const { width } = useWindowDimensions();
  const backgroundColor = useAnimatedColor(palette.background);
  const sizing = { maxWidth: layout === 'form' ? 640 : layout === 'reading' ? 820 : 1120, paddingHorizontal: width < 600 ? 18 : 32 };
  return (
    <SafeAreaView testID="page" style={[styles.safe, { backgroundColor: palette.background }]}>
      <Animated.View style={[styles.safe, { backgroundColor }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, sizing, contentContainerStyle]}
          {...scrollProps}
        >
          <MotionView style={styles.fill}>{children}</MotionView>
        </ScrollView>
      ) : <MotionView style={[styles.content, sizing, styles.fill, contentContainerStyle]}>{children}</MotionView>}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, width: '100%', alignSelf: 'center', paddingTop: 24, paddingBottom: 56 },
  fill: { flex: 1 }
});
