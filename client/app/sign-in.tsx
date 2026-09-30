import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandHeader } from '@/components/BrandHeader';
import { Notice } from '@/components/Notice';
import { Page } from '@/components/Page';
import { TextField } from '@/components/TextField';
import { signIn, signUp } from '@/features/auth/authService';
import { palettes } from '@/theme/palettes';

export default function SignInScreen() {
  const palette = palettes.rose;
  const router = useRouter();
  const { inviteToken } = useLocalSearchParams<{ inviteToken?: string }>();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    setError(null);
    setInfo(null);
    if (isCreatingAccount && displayName.trim().length < 1) {
      setError('Add a name your friends will recognize.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    setIsSaving(true);
    try {
      if (isCreatingAccount) {
        const signedIn = await signUp(email, password, displayName);
        if (signedIn) router.replace(inviteToken ? `/invite/${inviteToken}` : '/spaces');
        else setInfo('Your account was created. Check your inbox to confirm your email, then sign in here.');
      } else {
        await signIn(email, password);
        router.replace(inviteToken ? `/invite/${inviteToken}` : '/spaces');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette} contentContainerStyle={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.card}>
        <View style={[styles.flower, { backgroundColor: palette.surfaceSoft }]}><Text style={{ fontSize: 29 }}>✿</Text></View>
        <BrandHeader
          palette={palette}
          eyebrow="UsTogether"
          title={isCreatingAccount ? 'Make a little space' : 'Come back to your story'}
          subtitle={isCreatingAccount ? 'Create a private home for the moments you want to keep.' : 'Sign in to see the memories you share.'}
        />
        <View style={styles.fields}>
          {isCreatingAccount ? <TextField label="Your name" palette={palette} value={displayName} onChangeText={setDisplayName} autoCapitalize="words" maxLength={60} /> : null}
          <TextField label="Email" palette={palette} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <TextField label="Password" palette={palette} value={password} onChangeText={setPassword} secureTextEntry autoComplete={isCreatingAccount ? 'new-password' : 'password'} textContentType={isCreatingAccount ? 'newPassword' : 'password'} />
          {error ? <Notice palette={palette} tone="error">{error}</Notice> : null}
          {info ? <Notice palette={palette} tone="success">{info}</Notice> : null}
          <AppButton label={isCreatingAccount ? 'Create account' : 'Sign in'} palette={palette} onPress={submit} loading={isSaving} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setIsCreatingAccount((value) => !value); setError(null); setInfo(null); }} style={styles.switch}>
          <Text style={[styles.switchText, { color: palette.muted }]}>
            {isCreatingAccount ? 'Already have an account? ' : 'New around here? '}
            <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>{isCreatingAccount ? 'Sign in' : 'Create one'}</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 480, gap: 8, borderRadius: 28, padding: 28, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2D5DB', shadowColor: '#D98A9B', shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 10 } },
  flower: { width: 54, height: 54, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  fields: { gap: 15 },
  switch: { paddingTop: 12, paddingBottom: 4 },
  switchText: { textAlign: 'center', fontSize: 14 }
});
