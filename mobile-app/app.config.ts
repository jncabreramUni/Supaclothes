import type { ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const allowLocalHttp = /^http:\/\//i.test(apiUrl.trim());

export default {
  name: 'SupaClothes',
  slug: 'supaclothes-mobile',
  version: '1.0.0',
  scheme: 'supaclothes',
  platforms: ['android', 'ios'],
  userInterfaceStyle: 'automatic',
  android: { package: 'com.supaclothes' },
  ios: { bundleIdentifier: 'com.supaclothes' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-build-properties', { android: { usesCleartextTraffic: allowLocalHttp } }],
  ],
} satisfies ExpoConfig;
