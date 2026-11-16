import { useState } from 'react';
import type { Range } from '../types/api';
import { dateRangeError } from './format';
import { Button, Field, Notice } from './ui';

export function PeriodFilter({ onApply }: { onApply: (range: Partial<Range>) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  function apply() {
    const range = { from: from.trim(), to: to.trim() };
    const validation = dateRangeError(range.from, range.to, 366);
    setError(validation);
    if (!validation) onApply(range);
  }

  return (
    <>
      <Field label="Desde" placeholder="AAAA-MM-DD" value={from} onChangeText={setFrom} maxLength={10} />
      <Field label="Hasta" placeholder="AAAA-MM-DD" value={to} onChangeText={setTo} maxLength={10} />
      {error !== '' && <Notice message={error} error />}
      <Button label="Consultar periodo" kind="secondary" onPress={apply} />
    </>
  );
}
