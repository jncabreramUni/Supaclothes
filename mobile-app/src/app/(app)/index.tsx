import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { getDailySummary } from '../../api/operations';
import { canSell, roleLabels } from '../../auth/permissions';
import { useSession } from '../../auth/session';
import { DashboardPanel } from '../../components/dashboard';
import { money } from '../../components/format';
import { Button, Card, Copy, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useResource } from '../../components/use-resource';
import { radius, useTheme } from '../../theme';

const actions: { path: Href; label: string; details: string; visible: (role: keyof typeof roleLabels) => boolean }[] = [
  { path: '/productos', label: 'Productos', details: 'Catálogo, precios y variantes', visible: () => true },
  { path: '/inventario', label: 'Inventario', details: 'Existencias y movimientos', visible: () => true },
  { path: '/ventas', label: 'Ventas', details: 'Registra una venta y consulta comprobantes', visible: canSell },
  { path: '/clientes', label: 'Clientes', details: 'Busca por nombre o documento', visible: canSell },
  { path: '/resumen-diario', label: 'Resumen diario', details: 'Consulta ventas y devoluciones por fecha', visible: canSell },
  { path: '/reportes', label: 'Reportes', details: 'Consulta resultados de ventas e inventario', visible: role => role === 'ADMIN' },
  { path: '/usuarios', label: 'Usuarios', details: 'Gestiona las cuentas del equipo', visible: role => role === 'ADMIN' },
  { path: '/ajustes', label: 'Ajustes', details: 'Cambia el tema y el tamaño de texto', visible: () => true },
];

export default function HomeScreen() {
  const { session, signOut } = useSession();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session) return null;
  const { role, fullName } = session;

  async function endSession() {
    setBusy(true);
    setError('');
    try {
      await signOut();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Copy size={13} strong style={{ color: colors.heroAccent }}>{roleLabels[role]}</Copy>
        <Copy accessibilityRole="header" tone="white" size={28} strong>Hola, {fullName.trim().split(/\s+/)[0] || session.username}</Copy>
        <Copy style={{ color: colors.heroText }}>Resumen de tu tienda</Copy>
      </LinearGradient>
      <Card title="Accesos rápidos">
        {actions.filter(action => action.visible(role)).map(({ path, label, details }) => (
          <ListRow key={String(path)} onPress={() => router.push(path)}>
            <Copy strong>{label}</Copy>
            <Copy tone="muted">{details}</Copy>
          </ListRow>
        ))}
      </Card>
      {role === 'ADMIN' && <DashboardPanel />}
      {role === 'VENDEDOR' && <SalesOverview />}
      {error !== '' && <Notice message={error} error />}
      <Button label="Cerrar sesión" kind="secondary" busy={busy} onPress={() => void endSession()} />
    </Screen>
  );
}

function SalesOverview() {
  const { api } = useSession();
  const overview = useResource(useCallback((signal: AbortSignal) => getDailySummary(api, undefined, signal), [api]));

  return (
    <Card title="Ventas de hoy">
      {overview.loading && !overview.data && <Loading />}
      {overview.error !== '' && <Notice message={overview.error} error />}
      {overview.error !== '' && <Button label="Volver a consultar" kind="secondary" onPress={overview.reload} />}
      {overview.data && (
        <View style={styles.metrics}>
          <View><Copy size={20} strong>{money(overview.data.total)}</Copy><Copy tone="muted">Ventas netas</Copy></View>
          <View><Copy size={20} strong>{overview.data.count}</Copy><Copy tone="muted">Ventas</Copy></View>
          <View><Copy size={20} strong>{money(overview.data.refunds)}</Copy><Copy tone="muted">Devoluciones</Copy></View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 24, gap: 6, borderRadius: radius.card },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
});
