import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '../../api/client';
import { createEntry, getInventory, getMovements } from '../../api/operations';
import { canRegisterEntry } from '../../auth/permissions';
import { useSession } from '../../auth/session';
import { dateTime, positiveQuantity } from '../../components/format';
import { Button, Card, Copy, Field, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useResource } from '../../components/use-resource';
import { radius, useTheme } from '../../theme';

export default function InventoryScreen() {
  const { session, api } = useSession();
  const { colors } = useTheme();
  const [filter, setFilter] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean }>();
  const busy = useRef(false);
  const stock = useResource(useCallback((signal: AbortSignal) => getInventory(api, signal), [api]));
  const movements = useResource(useCallback((signal: AbortSignal) => getMovements(api, signal), [api]));
  const editable = canRegisterEntry(session?.role);
  const term = filter.trim().toLocaleLowerCase();
  const variants = stock.data?.flatMap(product => product.variants.map(variant => {
    const active = product.active && variant.active;
    return { product, variant, active, lowStock: active && variant.currentStock <= variant.minStock };
  }));
  const lowStockCount = variants?.filter(variant => variant.lowStock).length;
  const visibleVariants = variants?.filter(({ product, variant, lowStock }) =>
    (!onlyLowStock || lowStock) && [product.name, variant.sku].some(value => value.toLocaleLowerCase().includes(term)));

  function refresh() {
    stock.reload();
    movements.reload();
  }

  async function submitEntry() {
    if (busy.current || !editable) return;
    const units = positiveQuantity(quantity);
    if (!sku.trim() || units === null || !reference.trim()) {
      setNotice({ message: 'Ingresa el SKU, una cantidad entera positiva y una referencia.', error: true });
      return;
    }
    busy.current = true;
    setSubmitting(true);
    setNotice(undefined);
    try {
      const movement = await createEntry(api, { sku: sku.trim(), quantity: units, reference: reference.trim() });
      setNotice({ message: `Entrada registrada. Stock actual: ${movement.resultingStock}.` });
      setSku('');
      setQuantity('');
      setReference('');
      refresh();
    } catch (cause) {
      setNotice({ message: errorMessage(cause), error: true });
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Screen refresh={refresh} refreshing={stock.loading || movements.loading}>
      {editable && (
        <Card title="Registrar entrada">
          <Field label="SKU" value={sku} onChangeText={setSku} autoCapitalize="none" autoCorrect={false}
            maxLength={50} editable={!submitting} />
          <Field label="Cantidad" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" editable={!submitting} />
          <Field label="Referencia" value={reference} onChangeText={setReference} maxLength={150} editable={!submitting} />
          {notice && <Notice {...notice} />}
          <Button label="Registrar entrada" busy={submitting} onPress={() => void submitEntry()} />
        </Card>
      )}
      <Card title="Stock por variante">
        {lowStockCount !== undefined && (
          <Button label={onlyLowStock ? 'Ver todas las variantes' : `Ver stock bajo (${lowStockCount})`}
            kind="secondary" onPress={() => setOnlyLowStock(previous => !previous)} />
        )}
        <Field label="Buscar por producto o SKU" value={filter} onChangeText={setFilter} />
        {stock.loading && !stock.data && <Loading />}
        {stock.error !== '' && <Notice error message={stock.error} />}
        {stock.error !== '' && <Button label="Recargar existencias" kind="secondary" onPress={stock.reload} />}
        {visibleVariants?.length === 0 && <Copy tone="muted">
          {onlyLowStock ? 'No hay variantes con stock bajo para esta búsqueda.' : 'No hay existencias para esta búsqueda.'}
        </Copy>}
        {visibleVariants?.map(({ product, variant, active, lowStock }) => (
          <ListRow key={variant.id}>
            <Copy strong>{product.name} · {variant.sku}</Copy>
            <Copy tone="muted">
              {variant.currentStock} disponibles · mínimo {variant.minStock} · {variant.size} · {variant.color}
              {active ? '' : ' · Inactiva'}
            </Copy>
            {lowStock && <View style={[styles.stockBadge, { backgroundColor: colors.warningSurface }]}>
              <Copy tone="warning" strong>{variant.currentStock === 0 ? 'Agotado' : 'Stock bajo'}</Copy>
            </View>}
          </ListRow>
        ))}
      </Card>
      <Card title="Movimientos recientes">
        {movements.loading && !movements.data && <Loading />}
        {movements.error !== '' && <Notice error message={movements.error} />}
        {movements.error !== '' && <Button label="Recargar movimientos" kind="secondary" onPress={movements.reload} />}
        {movements.data?.length === 0 && <Copy tone="muted">Todavía no hay movimientos.</Copy>}
        {movements.data?.map(movement => (
          <ListRow key={movement.id}>
            <Copy strong>{movement.type.replace(/_/g, ' ')} · {movement.sku}</Copy>
            <Copy>{movement.quantity} unidades · {movement.previousStock} → {movement.resultingStock}</Copy>
            <Copy tone="muted">{dateTime(movement.createdAt)} · {movement.username}</Copy>
            {movement.reference ? <Copy tone="muted">{movement.reference}</Copy> : null}
          </ListRow>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stockBadge: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.field },
});
