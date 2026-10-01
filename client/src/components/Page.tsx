import type { ReactNode } from 'react';
import { Animated, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '@/theme/palettes';
import { MotionView, useAnimatedColor } from './Motion';

type Props = {
  palette: Palette;
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
};

export function Page({ palette, children, scroll = true, contentContainerStyle, scrollProps }: Props) {
  const backgroundColor = useAnimatedColor(palette.background);
  return (
    <SafeAreaView testID="page" style={[styles.safe, { backgroundColor: palette.background }]}>
      <Animated.View style={[styles.safe, { backgroundColor }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, contentContainerStyle]}
          {...scrollProps}
        >
          <MotionView style={styles.fill}>{children}</MotionView>
        </ScrollView>
      ) : <MotionView style={[styles.content, styles.fill, contentContainerStyle]}>{children}</MotionView>}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 56 },
  fill: { flex: 1 }
});
