import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { getProducts, setProductActive, setVariantActive } from '../../api/operations';
import { useSession } from '../../auth/session';
import { CatalogEditor, type CatalogEdit } from '../../components/catalog-editor';
import { money } from '../../components/format';
import { Button, Card, Copy, Field, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useAction } from '../../components/use-action';
import { useResource } from '../../components/use-resource';
import type { Product, ProductVariant } from '../../types/api';

export default function ProductsScreen() {
  const { api, session } = useSession();
  const admin = session?.role === 'ADMIN';
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState<CatalogEdit>();
  const [message, setMessage] = useState('');
  const action = useAction();
  const products = useResource(useCallback((signal: AbortSignal) => getProducts(api, signal), [api]));
  const busy = action.busy || products.loading;
  const term = query.trim().toLocaleLowerCase();
  const visibleProducts = products.data?.filter(product => [product.name, product.category, ...product.variants.map(v => v.sku)]
    .some(value => value.toLocaleLowerCase().includes(term)));

  function productSaved(saved: Product, feedback: string) {
    products.setData(current => current?.some(product => product.id === saved.id)
      ? current.map(product => product.id === saved.id ? saved : product)
      : [...(current ?? []), saved]);
    setEdit(undefined);
    setMessage(feedback);
    products.reload();
  }

  function toggleActive(product: Product, variant?: ProductVariant) {
    const active = !(variant ?? product).active;
    const label = variant ? variant.sku : product.name;
    const change = () => void action.run(async () => {
      setMessage('');
      const saved = variant
        ? await setVariantActive(api, product.id, variant.id, active)
        : await setProductActive(api, product.id, active);
      productSaved(saved, `${label} ${active ? 'se activó' : 'se desactivó'}.`);
    });

    if (active) change();
    else Alert.alert(`Desactivar ${variant ? 'variante' : 'producto'}`,
      variant ? `El SKU ${label} dejará de estar disponible para la venta.`
        : `Se desactivarán ${label} y todas sus variantes.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desactivar', style: 'destructive', onPress: change }]);
  }

  return (
    <Screen refresh={action.busy ? undefined : products.reload} refreshing={products.loading}>
      <Field label="Buscar por nombre, categoría o SKU" value={query} onChangeText={setQuery} />
      {admin && <Button label="Nuevo producto" disabled={busy} onPress={() => setEdit({ kind: 'new-product' })} />}
      {message !== '' && <Notice message={message} />}
      {action.error !== '' && <Notice message={action.error} error />}
      {products.loading && !products.data && <Loading label="Cargando catálogo…" />}
      {products.error !== '' && <Notice error message={products.error} />}
      {products.error !== '' && <Button label="Reintentar" kind="secondary" onPress={products.reload} />}
      {visibleProducts?.length === 0 && <Copy tone="muted">No hay productos para esta búsqueda.</Copy>}
      {visibleProducts?.map(product => (
        <Card key={product.id} title={product.name}>
          <Copy tone="muted">{product.category} · {product.active ? 'Activo' : 'Inactivo'}</Copy>
          {product.description ? <Copy>{product.description}</Copy> : null}
          {admin && (
            <>
              <Button label="Editar producto" kind="secondary" disabled={busy} onPress={() => setEdit({ kind: 'product', product })} />
              <Button label={product.active ? 'Desactivar producto' : 'Activar producto'}
                kind={product.active ? 'danger' : 'primary'} disabled={busy} onPress={() => toggleActive(product)} />
              {product.active ? (
                <Button label="Agregar variante" kind="secondary" disabled={busy} onPress={() => setEdit({ kind: 'variant', product })} />
              ) : (
                <Copy tone="muted">Activa el producto para agregar o reactivar variantes.</Copy>
              )}
            </>
          )}
          {product.variants.map(variant => (
            <ListRow key={variant.id}>
              <Copy strong>{variant.sku} · {variant.size} · {variant.color}</Copy>
              <Copy tone={variant.active ? 'muted' : 'warning'}>
                {money(variant.price)} · {variant.currentStock} en stock{variant.active ? '' : ' · Inactiva'}
              </Copy>
              {admin && (
                <>
                  <Button label={`Editar ${variant.sku}`} kind="secondary" disabled={busy}
                    onPress={() => setEdit({ kind: 'variant', product, variantId: variant.id })} />
                  {(variant.active || product.active) && (
                    <Button label={`${variant.active ? 'Desactivar' : 'Activar'} ${variant.sku}`}
                      kind={variant.active ? 'danger' : 'primary'} disabled={busy} onPress={() => toggleActive(product, variant)} />
                  )}
                </>
              )}
            </ListRow>
          ))}
        </Card>
      ))}
      {admin && edit && <CatalogEditor edit={edit} api={api} onSaved={productSaved} onClose={() => setEdit(undefined)} />}
    </Screen>
  );
}
