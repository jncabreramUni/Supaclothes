import type { ConfigContext, ExpoConfig } from 'expo/config';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';
const allowLocalHttp = /^http:\/\//i.test(apiUrl.trim());

export default ({ config }: ConfigContext): Partial<ExpoConfig> => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', {
      android: {
        useHermesV1: true,
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
        usesCleartextTraffic: allowLocalHttp,
      },
    }],
  ],
});
