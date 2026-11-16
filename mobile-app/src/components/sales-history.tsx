import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { getHistory } from '../api/operations';
import { useSession } from '../auth/session';
import type { SaleHistoryFilters } from '../types/api';
import { dateRangeError, dateTime, money } from './format';
import { Button, Card, Copy, Field, ListRow, Loading, Notice, Screen } from './ui';
import { useResource } from './use-resource';

export function SalesHistory() {
  const { api } = useSession();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [receipt, setReceipt] = useState('');
  const [filters, setFilters] = useState<SaleHistoryFilters>({});
  const [limit, setLimit] = useState(20);
  const [filterError, setFilterError] = useState('');
  const history = useResource(useCallback((signal: AbortSignal) => getHistory(api, filters, signal), [api, filters]));
  const results = !history.loading && !history.error ? history.data : undefined;

  function search() {
    const error = dateRangeError(from.trim(), to.trim());
    setFilterError(error);
    if (error) return;
    setLimit(20);
    setFilters({ from: from.trim(), to: to.trim(), receipt: receipt.trim() });
  }

  return (
    <Screen refresh={history.reload} refreshing={history.loading}>
      <Card title="Filtrar ventas">
        <Field label="Desde" placeholder="AAAA-MM-DD" value={from} onChangeText={setFrom} maxLength={10} />
        <Field label="Hasta" placeholder="AAAA-MM-DD" value={to} onChangeText={setTo} maxLength={10} />
        <Field label="Número de comprobante" value={receipt} onChangeText={setReceipt} autoCapitalize="characters"
          returnKeyType="search" onSubmitEditing={search} />
        {filterError !== '' && <Notice message={filterError} error />}
        <Button label="Buscar ventas" onPress={search} />
      </Card>
      <Card title="Ventas registradas">
        {history.loading && <Loading />}
        {history.error !== '' && <Notice message={history.error} error />}
        {history.error !== '' && <Button label="Reintentar" kind="secondary" onPress={history.reload} />}
        {results && results.length === 0 && <Copy tone="muted">No se encontraron ventas.</Copy>}
        {results && results.slice(0, limit).map(sale => (
          <ListRow key={sale.receiptNumber}
            onPress={() => router.push({ pathname: '/comprobante/[numero]', params: { numero: sale.receiptNumber } })}>
            <Copy strong>{sale.receiptNumber}</Copy>
            <Copy>{money(sale.total)} · {sale.status}</Copy>
            <Copy tone="muted">{dateTime(sale.createdAt)}</Copy>
          </ListRow>
        ))}
        {results && results.length > limit && (
          <Button label="Ver más ventas" kind="secondary" onPress={() => setLimit(current => current + 20)} />
        )}
      </Card>
    </Screen>
  );
}

