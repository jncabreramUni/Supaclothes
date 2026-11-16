import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ApiError, errorMessage } from '../../api/client';
import { createSale, getProducts } from '../../api/operations';
import {
  clearPendingSale, estimateSaleCents, readAmountCents, readPendingSale, saleDraftKey, savePendingSale, type CartLine,
} from '../../api/sale-draft';
import { useSession } from '../../auth/session';
import { CustomerLookup } from '../../components/customer-lookup';
import { money, positiveQuantity } from '../../components/format';
import { Button, Card, Copy, Field, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useResource } from '../../components/use-resource';
import type { Customer, PaymentMethod, SaleRequest } from '../../types/api';

const paymentLabels: Record<PaymentMethod, string> = {
  EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia',
};
const paymentMethods = Object.keys(paymentLabels) as PaymentMethod[];
const maxTotalCents = 999999999999n;

export default function SalesScreen() {
  const { session } = useSession();
  if (!session) return null;
  const key = saleDraftKey(session.origin, session.username);
  return <SaleForm key={key} draftKey={key} />;
}

function SaleForm({ draftKey }: { draftKey: string }) {
  const { api, session } = useSession();
  const canDiscount = session?.role === 'ADMIN';
  const products = useResource(useCallback((signal: AbortSignal) => getProducts(api, signal), [api]));
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [choosingCustomer, setChoosingCustomer] = useState(false);
  const [paymentMethod, setPayment] = useState<PaymentMethod>('EFECTIVO');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('0');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [pending, setPending] = useState<SaleRequest | null>(null);
  const [canDiscardPending, setCanDiscardPending] = useState(false);
  const [latestReceipt, setLatestReceipt] = useState<string>();
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const submitting = useRef(false);
  const discountInput = canDiscount && discount.trim() ? readAmountCents(discount) : 0;
  const discountBasisPoints = discountInput !== null && discountInput <= 10000 ? discountInput : null;
  const totals = estimateSaleCents(cart, discountBasisPoints ?? 0);
  const receivedCents = paymentMethod === 'EFECTIVO' ? readAmountCents(amount) : Number(totals.total);
  const changeCents = receivedCents !== null && discountBasisPoints !== null && receivedCents >= Number(totals.total)
    ? receivedCents - Number(totals.total) : null;
  const available = products.data?.flatMap(product => product.active ? product.variants
    .filter(variant => variant.active && variant.currentStock > 0)
    .map(variant => ({ name: product.name, variant })) : []);
  const term = sku.trim().toLocaleLowerCase();
  const options = available?.filter(({ name, variant }) =>
    [variant.sku, name].some(value => value.toLocaleLowerCase().includes(term))).slice(0, 8);

  usePreventRemove(busy, () => Alert.alert('Registrando venta', 'Espera la respuesta de SupaClothes.'));

  useEffect(() => {
    let active = true;
    void readPendingSale(draftKey)
      .then(saved => { if (active) { setPending(saved); setReady(true); } })
      .catch(() => { if (active) setStorageError('No se pudo recuperar el estado de ventas. Vuelve a abrir esta pantalla.'); });
    return () => { active = false; };
  }, [draftKey]);

  function addLine() {
    const units = positiveQuantity(quantity);
    const matches = available?.filter(entry => entry.variant.sku.toLocaleLowerCase() === term);
    const item = matches?.find(entry => entry.variant.sku === sku.trim())
      ?? (matches?.length === 1 ? matches[0] : undefined);
    if (units === null || !item) {
      setNotice({ message: 'Elige un SKU disponible e ingresa una cantidad entera positiva.', error: true });
      return;
    }
    const existing = cart.find(line => line.variant.id === item.variant.id);
    const updatedQuantity = (existing?.quantity ?? 0) + units;
    if (updatedQuantity > item.variant.currentStock) {
      setNotice({ message: `Stock disponible para ${item.variant.sku}: ${item.variant.currentStock}.`, error: true });
      return;
    }
    const nextLine = { ...item, quantity: updatedQuantity };
    setCart(existing ? cart.map(line => line.variant.id === item.variant.id ? nextLine : line) : [...cart, nextLine]);
    setSku('');
    setQuantity('1');
    setNotice(undefined);
  }

  async function submit() {
    if (submitting.current || !ready) return;
    let sale = pending;
    if (!sale) {
      if (discountBasisPoints === null) {
        setNotice({ message: 'El descuento debe estar entre 0 y 100 %, con máximo dos decimales.', error: true });
        return;
      }
      if (!cart.length || totals.total > maxTotalCents || totals.subtotal > maxTotalCents) {
        setNotice({ message: 'Agrega artículos y comprueba que el total esté dentro del rango permitido.', error: true });
        return;
      }
      if (receivedCents === null || changeCents === null) {
        setNotice({ message: 'Ingresa un importe recibido válido que cubra el total.', error: true });
        return;
      }
      sale = {
        customerId: customer?.id ?? null,
        items: cart.map(line => ({ sku: line.variant.sku, quantity: line.quantity })),
        paymentMethod,
        amountReceived: receivedCents / 100,
        discountPercent: discountBasisPoints / 100,
        idempotencyKey: randomUUID(),
      };
    }

    submitting.current = true;
    setBusy(true);
    setCanDiscardPending(false);
    setNotice(undefined);
    try {
      if (!pending) {
        await savePendingSale(draftKey, sale);
        setPending(sale);
      }
      const result = await createSale(api, sale);
      setLatestReceipt(result.receiptNumber);
      setCart([]);
      setCustomer(null);
      setChoosingCustomer(false);
      setAmount('');
      setDiscount('0');
      products.reload();
      try {
        await clearPendingSale(draftKey);
        setPending(null);
        setNotice({ message: `Venta registrada · ${result.receiptNumber} · ${money(result.total)}` });
      } catch {
        setNotice({ message: `Venta registrada · ${result.receiptNumber}. No se pudo limpiar la referencia local. Reintenta para recuperar el mismo comprobante.`, error: true });
      }
    } catch (cause) {
      const rejected = cause instanceof ApiError && [400, 403, 404, 409].includes(cause.status);
      if (!pending && rejected) {
        try {
          await clearPendingSale(draftKey);
          setPending(null);
        } catch {
          setCanDiscardPending(true);
          setNotice({ message: 'El servidor rechazó la venta y no se pudo limpiar el registro local.', error: true });
          return;
        }
      }
      if (pending && rejected) setCanDiscardPending(true);
      setNotice({ message: errorMessage(cause), error: true });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function confirmDiscard() {
    Alert.alert('Descartar referencia local', 'Revisa el historial para comprobar si la venta ya se registró antes de iniciar otra.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Descartar referencia',
        style: 'destructive',
        onPress: () => {
          void clearPendingSale(draftKey)
            .then(() => { setPending(null); setCanDiscardPending(false); setNotice(undefined); })
            .catch(() => setNotice({ message: 'No se pudo descartar la referencia local.', error: true }));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Button label="Historial de ventas" kind="secondary" disabled={busy} onPress={() => router.push('/historial')} />
      {notice && (pending || !ready || !notice.error) && <Notice {...notice} />}
      {latestReceipt && <Button label="Ver último comprobante" kind="secondary" disabled={busy}
        onPress={() => router.push({ pathname: '/comprobante/[numero]', params: { numero: latestReceipt } })} />}
      {storageError !== '' && <Notice message={storageError} error />}
      {!ready && storageError === '' && <Loading label="Comprobando ventas pendientes…" />}
      {ready && pending && (
        <Card title="Venta pendiente">
          <Copy>Reintenta con la misma referencia para saber si la venta se registró.</Copy>
          {pending.items.map(item => <Copy key={item.sku}>{item.quantity} × {item.sku}</Copy>)}
          <Copy tone="muted">{paymentLabels[pending.paymentMethod]} · Recibido {money(pending.amountReceived)}</Copy>
          <Button label="Reintentar venta" busy={busy} onPress={() => void submit()} />
          {canDiscardPending && <Button label="Descartar referencia local" kind="danger" onPress={confirmDiscard} />}
        </Card>
      )}
      {ready && !pending && (
        <>
          <Card title="Agregar artículos">
            <Field label="Buscar por producto o SKU" value={sku} onChangeText={setSku}
              autoCorrect={false} autoCapitalize="none" editable={!busy} />
            {products.loading && !products.data && <Loading label="Cargando SKUs…" />}
            {products.error !== '' && <Notice message={products.error} error />}
            {products.error !== '' && <Button label="Recargar catálogo" kind="secondary" onPress={products.reload} />}
            {options?.length === 0 && <Copy tone="muted">No hay variantes disponibles para esta búsqueda.</Copy>}
            {options?.map(({ name, variant }) => (
              <ListRow key={variant.id} selected={sku === variant.sku} onPress={() => setSku(variant.sku)}>
                <Copy strong>{name} · {variant.sku}</Copy>
                <Copy tone="muted">{variant.size} · {variant.color} · {variant.currentStock} disponibles · {money(variant.price)}</Copy>
              </ListRow>
            ))}
            <Field label="Cantidad" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" editable={!busy} />
            <Button label="Agregar al carrito" kind="secondary" disabled={busy || !available?.length} onPress={addLine} />
          </Card>
          <Card title="Carrito">
            {cart.length === 0 && <Copy tone="muted">Agrega una variante para iniciar la venta.</Copy>}
            {cart.map(({ variant, name, quantity: units }) => (
              <View key={variant.id} style={styles.cartLine}>
                <Copy strong>{units} × {name} · {variant.sku}</Copy>
                <Button label={`Quitar ${variant.sku}`} kind="secondary" disabled={busy}
                  onPress={() => setCart(cart.filter(line => line.variant.id !== variant.id))} />
              </View>
            ))}
          </Card>
          <Card title="Cliente">
            <Copy strong>{customer?.name ?? 'Consumidor final'}</Copy>
            <Button label={choosingCustomer ? 'Cerrar búsqueda' : 'Buscar y elegir cliente'}
              disabled={busy} kind="secondary" onPress={() => setChoosingCustomer(!choosingCustomer)} />
          </Card>
          {choosingCustomer && <CustomerLookup selectedId={customer?.id ?? null}
            onSelect={selected => { setCustomer(selected); setChoosingCustomer(false); }} />}
          <Card title="Pago">
            {paymentMethods.map(method => (
              <ListRow key={method} selected={method === paymentMethod} onPress={() => { if (!busy) setPayment(method); }}>
                <Copy strong={method === paymentMethod}>{paymentLabels[method]}</Copy>
              </ListRow>
            ))}
            {canDiscount && <Field label="Descuento (%)" value={discount} onChangeText={setDiscount}
              keyboardType="decimal-pad" editable={!busy} />}
            {discountBasisPoints === null ? <Copy tone="error">Ingresa un descuento válido entre 0 y 100 %.</Copy> : (
              <>
                <Copy tone="muted">Subtotal {money(Number(totals.subtotal) / 100)} · IVA {money(Number(totals.tax) / 100)}</Copy>
                {totals.discount > 0n && <Copy tone="muted">Descuento {money(Number(totals.discount) / 100)}</Copy>}
                <Copy strong size={19}>Total estimado · {money(Number(totals.total) / 100)}</Copy>
              </>
            )}
            {paymentMethod === 'EFECTIVO' && (
              <>
                <Field label="Efectivo recibido" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!busy} />
                {amount !== '' && discountBasisPoints !== null && (
                  <Copy tone={changeCents === null ? 'warning' : 'accent'} strong accessibilityLiveRegion="polite">
                    {changeCents !== null ? `Cambio ${money(changeCents / 100)}` :
                      receivedCents === null ? 'Ingresa un importe válido.' : 'El efectivo no cubre el total.'}
                  </Copy>
                )}
              </>
            )}
            {notice?.error && <Notice {...notice} />}
            <Button label="Registrar venta" busy={busy} disabled={!cart.length} onPress={() => void submit()} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ cartLine: { gap: 6 } });
