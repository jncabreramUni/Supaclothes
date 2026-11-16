import { useCallback, useState } from 'react';
import { createCustomer, lookupCustomers } from '../api/operations';
import { useSession } from '../auth/session';
import type { Customer } from '../types/api';
import { Button, Card, Copy, Field, FormModal, ListRow, Loading, Notice } from './ui';
import { useAction } from './use-action';
import { useResource } from './use-resource';

export function CustomerLookup({ onSelect, selectedId }: {
  onSelect?: (customer: Customer | null) => void;
  selectedId?: number | null;
}) {
  const { api } = useSession();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const customers = useResource(useCallback((signal: AbortSignal) =>
    query === null ? Promise.resolve([]) : lookupCustomers(api, query, signal), [api, query]));

  function search() {
    const next = input.trim();
    if (query === next) customers.reload();
    else setQuery(next);
  }

  return (
    <Card title="Buscar clientes">
      <Field label="Nombre o número de documento" value={input} onChangeText={setInput}
        returnKeyType="search" onSubmitEditing={search} />
      <Button label="Buscar" kind="secondary" onPress={search} />
      <Button label="Registrar cliente" onPress={() => setShowForm(true)} />
      {message !== '' && <Notice message={message} />}
      {onSelect && (
        <ListRow selected={selectedId === null} onPress={() => onSelect(null)}>
          <Copy strong>Consumidor final</Copy>
        </ListRow>
      )}
      {query !== null && customers.loading && <Loading />}
      {customers.error !== '' && <Notice message={customers.error} error />}
      {query !== null && !customers.loading && customers.error === '' && customers.data?.length === 0
        && <Copy tone="muted">No hay clientes para esta búsqueda.</Copy>}
      {query !== null && !customers.loading && customers.error === '' && customers.data?.map(customer => (
        <ListRow key={customer.id} selected={customer.id === selectedId}
          onPress={onSelect ? () => onSelect(customer) : undefined}>
          <Copy strong>{customer.name}</Copy>
          <Copy tone="muted">{[customer.documentType, customer.documentNumber].filter(Boolean).join(' ')}</Copy>
          {!onSelect && customer.phone ? <Copy tone="muted">{customer.phone}</Copy> : null}
          {!onSelect && customer.email ? <Copy tone="muted">{customer.email}</Copy> : null}
        </ListRow>
      ))}
      {showForm && <CustomerForm onClose={() => setShowForm(false)} onCreated={customer => {
        setShowForm(false);
        if (onSelect) {
          onSelect(customer);
          return;
        }
        setMessage(`Cliente ${customer.name} registrado.`);
        setInput(customer.documentNumber);
        if (query === customer.documentNumber) customers.reload();
        else setQuery(customer.documentNumber);
      }} />}
    </Card>
  );
}

const documentTypes = ['CC', 'CE', 'NIT', 'PASAPORTE', 'OTRO'];

function CustomerForm({ onClose, onCreated }: {
  onClose: () => void; onCreated: (customer: Customer) => void;
}) {
  const { api } = useSession();
  const action = useAction();
  const [documentType, setDocumentType] = useState('CC');
  const [documentNumber, setDocumentNumber] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  function submit() {
    void action.run(async () => {
      if (!name.trim() || !documentNumber.trim()) throw new Error('Ingresa el número de documento y el nombre.');
      if (phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(phone.trim())) throw new Error('Revisa el formato del teléfono.');
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Revisa el formato del correo.');
      onCreated(await createCustomer(api, { documentType, documentNumber: documentNumber.trim(), name: name.trim(),
        phone: phone.trim() || null, email: email.trim() || null }));
    });
  }

  return (
    <FormModal title="Registrar cliente" busy={action.busy} onClose={onClose}>
      <Copy strong>Tipo de documento</Copy>
      {documentTypes.map(type => (
        <ListRow key={type} selected={type === documentType} onPress={action.busy ? undefined : () => setDocumentType(type)}>
          <Copy strong={type === documentType}>{type}</Copy>
        </ListRow>
      ))}
      <Field label="Número de documento" value={documentNumber} onChangeText={setDocumentNumber}
        maxLength={30} autoCapitalize="characters" editable={!action.busy} />
      <Field label="Nombre completo" value={name} onChangeText={setName} maxLength={120}
        autoCapitalize="words" editable={!action.busy} />
      <Field label="Teléfono (opcional)" value={phone} onChangeText={setPhone} maxLength={20}
        keyboardType="phone-pad" autoComplete="tel" editable={!action.busy} />
      <Field label="Correo (opcional)" value={email} onChangeText={setEmail} maxLength={120}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!action.busy} />
      {action.error !== '' && <Notice message={action.error} error />}
      <Button label="Guardar cliente" busy={action.busy} onPress={submit} />
    </FormModal>
  );
}
