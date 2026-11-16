import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SessionProvider, useSession } from '../auth/session';
import { PreferencesProvider, usePreferences } from '../preferences';
import { useTheme } from '../theme';

function RootNavigator() {
  const { session, loading } = useSession();
  const { loading: preferencesLoading } = usePreferences();
  const { colors, isDark } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  if (loading || preferencesLoading || (!fontsLoaded && !fontError)) {
    return <View style={[styles.loading, { backgroundColor: colors.canvas }]}><ActivityIndicator color={colors.accent} /></View>;
  }
  return (
    <>
      <StatusBar style={session || isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session)}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <PreferencesProvider><SessionProvider><RootNavigator /></SessionProvider></PreferencesProvider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
