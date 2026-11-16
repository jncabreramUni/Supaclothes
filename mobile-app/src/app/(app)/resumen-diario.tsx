import { useCallback, useState } from 'react';
import { getDailySummary } from '../../api/operations';
import { useSession } from '../../auth/session';
import { isLocalDate, money } from '../../components/format';
import { Button, Card, Copy, Field, Loading, Notice, Screen } from '../../components/ui';
import { useResource } from '../../components/use-resource';

export default function DailySummaryScreen() {
  const { api } = useSession();
  const [dateInput, setDateInput] = useState('');
  const [date, setDate] = useState<string>();
  const [error, setError] = useState('');
  const overview = useResource(useCallback((signal: AbortSignal) => getDailySummary(api, date, signal), [api, date]));

  function consult() {
    const value = dateInput.trim();
    if (value && !isLocalDate(value)) {
      setError('Ingresa una fecha válida con formato AAAA-MM-DD.');
      return;
    }
    setError('');
    const next = value || undefined;
    if (next === date) overview.reload();
    else setDate(next);
  }

  return (
    <Screen refresh={overview.reload} refreshing={overview.loading}>
      <Card title="Ventas por fecha">
        <Field label="Fecha (opcional)" placeholder="AAAA-MM-DD" value={dateInput} onChangeText={setDateInput} maxLength={10} />
        {error !== '' && <Notice error message={error} />}
        <Button label="Consultar día" onPress={consult} />
        {overview.loading && <Loading />}
        {overview.error !== '' && <Notice error message={overview.error} />}
        {!overview.loading && overview.error === '' && overview.data && (
          <>
            <Copy strong>{overview.data.date} · {overview.data.count} ventas</Copy>
            <Copy>Ventas brutas {money(overview.data.grossSales)}</Copy>
            <Copy>Devoluciones {money(overview.data.refunds)}</Copy>
            <Copy size={19} strong>Ventas netas {money(overview.data.total)}</Copy>
          </>
        )}
      </Card>
    </Screen>
  );
}
