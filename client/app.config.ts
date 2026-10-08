import type { ExpoConfig } from 'expo/config';

const publicAppUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();
const appDomain = publicAppUrl ? new URL(publicAppUrl).hostname : null;

const config: ExpoConfig = {
  name: 'UsTogether',
  slug: 'ustogether',
  scheme: 'ustogether',
  version: '1.0.0',
  icon: './assets/brand/app-icon.png',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  experiments: { typedRoutes: true },
  plugins: [
    'expo-router',
    ['expo-image-picker', {
      photosPermission: 'Choose a photo to add to your shared timeline.',
      cameraPermission: 'Take a photo to add to your shared timeline.'
    }]
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.ustogether.app',
    associatedDomains: appDomain ? [`applinks:${appDomain}`] : []
  },
  android: {
    package: 'com.ustogether.app',
    intentFilters: appDomain ? [{
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: appDomain, pathPrefix: '/invite/' }],
      category: ['BROWSABLE', 'DEFAULT']
    }] : []
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/brand/favicon.png' }
};

export default config;
