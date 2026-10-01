import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import type { Palette } from '@/theme/palettes';

type Props = TextInputProps & {
  label: string;
  palette: Palette;
  hint?: string;
};

export function TextField({ label, palette, hint, style, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette.muted}
        selectionColor={palette.primary}
        {...props}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        style={[styles.input, { backgroundColor: palette.surface, borderColor: focused ? palette.primary : palette.border, color: palette.ink }, props.multiline && styles.multiline, style]}
      />
      {hint ? <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontSize: 12, letterSpacing: 0.5, fontWeight: '800' },
  input: { minHeight: 54, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, fontSize: 16 },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  hint: { fontSize: 12, lineHeight: 17 }
});
