import 'react-native-gesture-handler';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { MotionProvider, useReducedMotion } from '@/components/Motion';

function Navigation() {
  const reduced = useReducedMotion();
  const { user, isLoading, isConfigured } = useAuth();
  const segments = useSegments();
  const privateRoute = segments[0] === 'spaces' || segments[0] === 'memories';
  if (!isLoading && privateRoute && !user) return <Redirect href={isConfigured ? '/sign-in' : '/'} />;
  return <Stack screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'fade', animationDuration: 300, contentStyle: { backgroundColor: '#FAF4E9' } }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MotionProvider>
        <StatusBar style="dark" />
        <Navigation />
        </MotionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
