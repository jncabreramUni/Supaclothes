import { Stack } from 'expo-router';
import { canSell } from '../../auth/permissions';
import { useSession } from '../../auth/session';
import { typography, useTheme } from '../../theme';

export default function AppLayout() {
  const { colors, textScale } = useTheme();
  const { session } = useSession();
  const role = session?.role;

  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.navy }, headerTintColor: colors.white,
      headerTitleStyle: { fontFamily: typography.bold, fontSize: 17 * textScale }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'SupaClothes' }} />
      <Stack.Screen name="productos" options={{ title: 'Productos' }} />
      <Stack.Screen name="inventario" options={{ title: 'Inventario' }} />
      <Stack.Screen name="ajustes" options={{ title: 'Ajustes' }} />
      <Stack.Protected guard={canSell(role)}>
        <Stack.Screen name="ventas" options={{ title: 'Ventas' }} />
        <Stack.Screen name="clientes" options={{ title: 'Clientes' }} />
        <Stack.Screen name="historial" options={{ title: 'Historial de ventas' }} />
        <Stack.Screen name="comprobante/[numero]" options={{ title: 'Comprobante' }} />
        <Stack.Screen name="resumen-diario" options={{ title: 'Resumen diario' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'ADMIN'}>
        <Stack.Screen name="reportes" options={{ title: 'Reportes' }} />
        <Stack.Screen name="usuarios" options={{ title: 'Usuarios' }} />
      </Stack.Protected>
    </Stack>
  );
}
