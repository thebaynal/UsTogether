import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { useAuth } from '@/features/auth/AuthProvider';
import { acceptInvite } from '@/features/spaces/spaceService';
import { palettes } from '@/theme/palettes';

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!user || !token || hasAttempted.current) return;
    hasAttempted.current = true;
    acceptInvite(token)
      .then((spaceId) => router.replace(`/spaces/${spaceId}`))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'This invite could not be accepted.'))
  }, [user, token, router]);

  if (!isLoading && !user) return <Redirect href={`/sign-in?inviteToken=${encodeURIComponent(token ?? '')}`} />;
  return (
    <Page palette={palettes.rose}>
      <View style={styles.content}>
        <Text style={styles.flower}>✿</Text>
        <BrandHeader palette={palettes.rose} title={error ? 'This invite needs a fresh start' : 'You’re almost there'} subtitle={error ? 'Ask a member for a new invite link.' : 'Joining your shared space…'} />
        {error ? <Notice palette={palettes.rose} tone="error">{error}</Notice> : <ActivityIndicator color={palettes.rose.primary} />}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({ content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, flower: { fontSize: 38, marginBottom: 15 } });
