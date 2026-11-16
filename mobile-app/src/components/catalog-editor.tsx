import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ApiRequest } from '../api/client';
import { createProduct, createVariant, updateProduct, updateVariant } from '../api/operations';
import type { Product, ProductVariantRequest } from '../types/api';
import { radius, useTheme } from '../theme';
import { Button, Copy, Field, FormModal, Notice } from './ui';
import { useAction } from './use-action';

export type CatalogEdit =
  | { kind: 'new-product' }
  | { kind: 'product'; product: Product }
  | { kind: 'variant'; product: Product; variantId?: number };

type VariantDraft = Record<keyof ProductVariantRequest, string>;

function variantDraft(variant?: ProductVariantRequest): VariantDraft {
  return {
    sku: variant?.sku ?? '',
    size: variant?.size ?? '',
    color: variant?.color ?? '',
    price: variant ? String(variant.price) : '',
    taxRate: String(variant?.taxRate ?? 0.19),
    minStock: String(variant?.minStock ?? 0),
  };
}

function decimal(text: string, integerDigits: number) {
  const normalized = text.trim().replace(',', '.');
  return new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,2})?$`).test(normalized) ? Number(normalized) : null;
}

function parseVariant(draft: VariantDraft, label: string): ProductVariantRequest {
  const sku = draft.sku.trim();
  const size = draft.size.trim();
  const color = draft.color.trim();
  if (!sku || !size || !color) throw new Error(`${label}. Ingresa el SKU, la talla y el color.`);
  const price = decimal(draft.price, 10);
  const taxRate = decimal(draft.taxRate, 3);
  if (price === null || taxRate === null) {
    throw new Error(`${label}. Ingresa un precio y una tasa de IVA válidos, con hasta dos decimales.`);
  }
  const minStock = Number(draft.minStock.trim());
  if (!/^\d+$/.test(draft.minStock.trim()) || minStock > 2147483647) {
    throw new Error(`${label}. El stock mínimo debe ser un entero entre 0 y 2.147.483.647.`);
  }
  return { sku, size, color, price, taxRate, minStock };
}

export function CatalogEditor({ edit, api, onSaved, onClose }: {
  edit: CatalogEdit; api: ApiRequest; onSaved: (product: Product, message: string) => void; onClose: () => void;
}) {
  const action = useAction();
  const { colors } = useTheme();
  const product = edit.kind === 'new-product' ? undefined : edit.product;
  const existingVariant = edit.kind === 'variant' ? edit.product.variants.find(variant => variant.id === edit.variantId) : undefined;
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [rows, setRows] = useState(() => [{ key: 0, fields: variantDraft(existingVariant) }]);
  const nextKey = useRef(1);
  const title = edit.kind === 'new-product' ? 'Nuevo producto' : edit.kind === 'product'
    ? 'Editar producto' : existingVariant ? `Editar variante ${existingVariant.sku}` : `Agregar variante a ${edit.product.name}`;

  function save() {
    void action.run(async () => {
      if (edit.kind === 'variant') {
        const body = parseVariant(rows[0].fields, 'Variante');
        const saved = edit.variantId === undefined
          ? await createVariant(api, edit.product.id, body)
          : await updateVariant(api, edit.product.id, edit.variantId, body);
        onSaved(saved, `Variante ${body.sku} guardada.`);
        return;
      }

      const fields = { name: name.trim(), category: category.trim(), description: description.trim() || null };
      if (!fields.name || !fields.category) throw new Error('Ingresa el nombre y la categoría.');
      if (edit.kind === 'product') {
        onSaved(await updateProduct(api, edit.product.id, fields), 'Producto actualizado.');
        return;
      }

      const variants = rows.map(({ fields: draft }, index) => parseVariant(draft, `Variante ${index + 1}`));
      if (new Set(variants.map(variant => variant.sku)).size !== variants.length) {
        throw new Error('Cada variante debe tener un SKU distinto.');
      }
      onSaved(await createProduct(api, { ...fields, variants }), 'Producto creado.');
    });
  }

  return (
    <FormModal title={title} busy={action.busy} onClose={onClose}>
      {edit.kind !== 'variant' && (
        <>
          <Field label="Nombre" autoCapitalize="sentences" value={name} onChangeText={setName} maxLength={120} editable={!action.busy} />
          <Field label="Categoría" value={category} onChangeText={setCategory} maxLength={80} editable={!action.busy} />
          <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} maxLength={255}
            multiline editable={!action.busy} />
        </>
      )}
      {edit.kind !== 'product' && rows.map(({ key, fields }, index) => (
        <View key={key} style={[styles.variant, { borderColor: colors.line }]}>
          {edit.kind === 'new-product' && <Copy strong>Variante {index + 1}</Copy>}
          <VariantFields draft={fields} disabled={action.busy} onChange={(field, value) =>
            setRows(current => current.map(row => row.key === key
              ? { key, fields: { ...row.fields, [field]: value } } : row))} />
          {rows.length > 1 && <Button label={`Quitar variante ${index + 1}`} kind="secondary" disabled={action.busy}
            onPress={() => setRows(current => current.filter(row => row.key !== key))} />}
        </View>
      ))}
      {edit.kind === 'new-product' && <Button label="Añadir otra variante" kind="secondary" disabled={action.busy} onPress={() => {
        const key = nextKey.current++;
        setRows(current => [...current, { key, fields: variantDraft() }]);
      }} />}
      {action.error !== '' && <Notice message={action.error} error />}
      <Button label={edit.kind === 'new-product' ? 'Crear producto' : 'Guardar cambios'} busy={action.busy} onPress={save} />
    </FormModal>
  );
}

function VariantFields({ draft, disabled, onChange }: {
  draft: VariantDraft; disabled: boolean; onChange: (field: keyof VariantDraft, value: string) => void;
}) {
  return (
    <>
      <Field label="SKU" value={draft.sku} maxLength={50} autoCapitalize="none" autoCorrect={false}
        onChangeText={value => onChange('sku', value)} editable={!disabled} />
      <Field label="Talla" value={draft.size} maxLength={20} onChangeText={value => onChange('size', value)} editable={!disabled} />
      <Field label="Color" value={draft.color} maxLength={40} onChangeText={value => onChange('color', value)} editable={!disabled} />
      <Field label="Precio (COP)" keyboardType="decimal-pad" value={draft.price}
        onChangeText={value => onChange('price', value)} editable={!disabled} />
      <Field label="Tasa de IVA (0,19 equivale a 19 %)" keyboardType="decimal-pad" value={draft.taxRate}
        onChangeText={value => onChange('taxRate', value)} editable={!disabled} />
      <Field label="Stock mínimo" keyboardType="number-pad" value={draft.minStock}
        onChangeText={value => onChange('minStock', value)} editable={!disabled} />
    </>
  );
}

const styles = StyleSheet.create({ variant: { padding: 12, gap: 10, borderWidth: 1, borderRadius: radius.field } });
