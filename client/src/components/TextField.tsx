import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { Palette } from '@/theme/palettes';

type Props = TextInputProps & {
  label: string;
  palette: Palette;
  hint?: string;
};

export function TextField({ label, palette, hint, style, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        selectionColor={palette.primary}
        style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.ink }, props.multiline && styles.multiline, style]}
        {...props}
      />
      {hint ? <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontSize: 14, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 17 }
});
