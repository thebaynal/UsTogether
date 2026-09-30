import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Palette } from '@/theme/palettes';

type Props = {
  palette: Palette;
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
};

export function Page({ palette, children, scroll = true, contentContainerStyle, scrollProps }: Props) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, contentContainerStyle]}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      ) : <View style={[styles.content, styles.fill, contentContainerStyle]}>{children}</View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14, paddingBottom: 36 },
  fill: { flex: 1 }
});
