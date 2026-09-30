import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { palettes } from '@/theme/palettes';

export default function IndexRoute() {
  const { user, isLoading, isConfigured } = useAuth();
  const palette = palettes.rose;
  if (isLoading) {
    return <View style={[styles.center, { backgroundColor: palette.background }]}><ActivityIndicator color={palette.primary} /></View>;
  }
  if (!isConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Text style={[styles.brand, { color: palette.primaryPressed }]}>UsTogether ♡</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Your story starts here</Text>
        <Text style={[styles.copy, { color: palette.muted }]}>Add your Supabase project URL and publishable key to client/.env.local to connect private spaces.</Text>
      </View>
    );
  }
  return <Redirect href={user ? '/spaces' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center', gap: 12 },
  brand: { fontSize: 15, letterSpacing: 1, fontWeight: '800', textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  copy: { maxWidth: 440, fontSize: 15, lineHeight: 23, textAlign: 'center' }
});
