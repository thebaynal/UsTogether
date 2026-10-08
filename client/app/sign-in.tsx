import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { MotionPressable as Pressable, MotionView, motion } from '@/components/Motion';
import { RomanticFlashcards } from '@/components/RomanticFlashcards';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppButton } from '@/components/AppButton';
import { BrandLogo } from '@/components/BrandLogo';
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
  const saving = useRef(false);
  const [formFocused, setFormFocused] = useState(false);
  const [formHovering, setFormHovering] = useState(false);
  const [formTouching, setFormTouching] = useState(false);

  async function submit() {
    if (saving.current) return;
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
    saving.current = true;
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
      saving.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Page palette={palette} contentContainerStyle={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.layout}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        onFocus={() => setFormFocused(true)} onBlur={() => setFormFocused(false)}
        onPointerEnter={() => setFormHovering(true)} onPointerLeave={() => setFormHovering(false)}
        onTouchStart={() => setFormTouching(true)} onTouchEnd={() => setFormTouching(false)} onTouchCancel={() => setFormTouching(false)}>
        <BrandLogo palette={palette} size={38} />
        <Text accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>{isCreatingAccount ? 'Create account' : 'Sign in'}</Text>
        <View style={styles.fields}>
          {isCreatingAccount ? <MotionView duration={motion.content}><TextField label="Your name" palette={palette} editable={!isSaving} value={displayName} onChangeText={setDisplayName} onFocus={() => setFormFocused(true)} onBlur={() => setFormFocused(false)} autoCapitalize="words" maxLength={60} /></MotionView> : null}
          <TextField label="Email" palette={palette} editable={!isSaving} value={email} onChangeText={setEmail} onFocus={() => setFormFocused(true)} onBlur={() => setFormFocused(false)} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <TextField label="Password" palette={palette} editable={!isSaving} value={password} onChangeText={setPassword} onFocus={() => setFormFocused(true)} onBlur={() => setFormFocused(false)} secureTextEntry autoComplete={isCreatingAccount ? 'new-password' : 'password'} textContentType={isCreatingAccount ? 'newPassword' : 'password'} />
          {error ? <Notice palette={palette} tone="error">{error}</Notice> : null}
          {info ? <Notice palette={palette} tone="success">{info}</Notice> : null}
          <AppButton label={isCreatingAccount ? 'Create account' : 'Sign in'} palette={palette} onPress={submit} loading={isSaving} />
        </View>
        <Pressable disabled={isSaving} accessibilityRole="button" onPress={() => { setIsCreatingAccount((value) => !value); setError(null); setInfo(null); }} style={styles.switch}>
          <Text style={[styles.switchText, { color: palette.muted }]}>
            {isCreatingAccount ? 'Already have an account? ' : 'New around here? '}
            <Text style={{ color: palette.primaryPressed, fontWeight: '800' }}>{isCreatingAccount ? 'Sign in' : 'Create one'}</Text>
          </Text>
        </Pressable>
      </View>
      <RomanticFlashcards paused={formFocused || formHovering || formTouching || isSaving} />
      </KeyboardAvoidingView>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'stretch' },
  layout: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 24 },
  wordmark: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontFamily: Platform.OS === 'web' ? 'Georgia' : undefined, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, marginBottom: 9 },
  card: { width: '100%', gap: 14, borderRadius: 30, padding: 24, borderWidth: 1 },
  fields: { gap: 17 },
  switch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 22 },
  switchText: { textAlign: 'center', fontSize: 14, lineHeight: 21 }
});
