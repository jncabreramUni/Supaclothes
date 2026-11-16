import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getDashboard } from '../api/operations';
import { useSession } from '../auth/session';
import { useTheme } from '../theme';
import type { Day, Range } from '../types/api';
import { money } from './format';
import { PeriodFilter } from './period-filter';
import { Button, Card, Copy, ListRow, Loading, Notice } from './ui';
import { useResource } from './use-resource';

export function DashboardPanel() {
  const { api } = useSession();
  const [filters, setFilters] = useState<Partial<Range>>({});
  const stats = useResource(useCallback((signal: AbortSignal) => getDashboard(api, filters, signal), [api, filters]));
  const dashboard = stats.error ? undefined : stats.data;
  return (
    <Card title="Resultados de la tienda">
      <PeriodFilter onApply={setFilters} />
      {stats.loading && <Loading />}
      {stats.error !== '' && <Notice error message={stats.error} />}
      {stats.error !== '' && <Button label="Reintentar" kind="secondary" onPress={stats.reload} />}
      {!stats.loading && dashboard && (
        <>
          <Copy tone="muted">{dashboard.from} a {dashboard.to}</Copy>
          <Copy strong size={20}>Ventas netas {money(dashboard.netSales)}</Copy>
          <Copy>{dashboard.salesCount} ventas · {money(dashboard.grossSales)} en ventas brutas</Copy>
          <Copy>{money(dashboard.refunds)} en devoluciones</Copy>
          <Copy>{dashboard.stockUnits} unidades · {dashboard.lowStockCount} variantes con stock bajo</Copy>
          <Trend days={dashboard.daily} />
        </>
      )}
    </Card>
  );
}

function Trend({ days }: { days: Day[] }) {
  const { colors } = useTheme();
  if (days.length === 0) return null;

  const groupSize = Math.ceil(days.length / 14);
  const groups = [];
  for (let start = 0; start < days.length; start += groupSize) {
    const batch = days.slice(start, start + groupSize);
    groups.push({
      from: batch[0].date,
      to: batch[batch.length - 1].date,
      sales: batch.reduce((sum, day) => sum + day.sales, 0),
      refunds: batch.reduce((sum, day) => sum + day.refunds, 0),
    });
  }
  const scale = Math.max(1, ...groups.flatMap(period => [period.sales, period.refunds]));

  return (
    <>
      <Copy size={16} strong>Ventas y devoluciones por {groupSize === 1 ? 'día' : 'periodo'}</Copy>
      {groups.map(({ from, to, sales, refunds }) => (
        <ListRow key={from}>
          <Copy strong>{from === to ? from : `${from} a ${to}`}</Copy>
          <Copy tone="muted">Ventas {money(sales)}</Copy>
          <View accessible={false} style={[styles.track, { backgroundColor: colors.line }]}>
            <View style={[styles.bar, { width: `${sales / scale * 100}%`, backgroundColor: colors.brand }]} />
          </View>
          <Copy tone="muted">Devoluciones {money(refunds)}</Copy>
          <View accessible={false} style={[styles.track, { backgroundColor: colors.line }]}>
            <View style={[styles.bar, { width: `${refunds / scale * 100}%`, backgroundColor: colors.chartRefunds }]} />
          </View>
        </ListRow>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
});
