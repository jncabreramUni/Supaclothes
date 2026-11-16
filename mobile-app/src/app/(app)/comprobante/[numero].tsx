import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { createSaleReturn, getHistory, getReceipt, getSaleReturn } from '../../../api/operations';
import { useSession } from '../../../auth/session';
import { pdfMime, saveAttachment, shareAttachment } from '../../../components/attachments';
import { dateTime, money } from '../../../components/format';
import { makeReceiptFile } from '../../../components/receipt-file';
import { Button, Card, Copy, Field, FormModal, ListRow, Loading, Notice, Screen } from '../../../components/ui';
import { useAction } from '../../../components/use-action';
import { useResource } from '../../../components/use-resource';

export default function ReceiptScreen() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { api } = useSession();
  const [showReturn, setShowReturn] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const fileAction = useAction();
  const returnAction = useAction();

  const detail = useResource(useCallback(async (signal: AbortSignal) => {
    if (!numero) throw new Error('Selecciona un comprobante en el historial.');
    const [receipt, summaries] = await Promise.all([
      getReceipt(api, numero, signal), getHistory(api, { receipt: numero }, signal),
    ]);
    const status = summaries.find(item => item.receiptNumber === receipt.receiptNumber)?.status;
    const returned = status === 'DEVUELTA' ? await getSaleReturn(api, numero, signal) : null;
    return { receipt, status, returned };
  }, [api, numero]));

  function exportReceipt(save: boolean) {
    if (!detail.data) return;
    const { receipt, returned } = detail.data;
    void fileAction.run(async () => {
      setFeedback('');
      const pdf = await makeReceiptFile(receipt, returned);
      if (!save) await shareAttachment(pdf, pdfMime);
      else if (await saveAttachment(pdf, pdfMime)) setFeedback(`Se guardó ${pdf.name}.`);
    });
  }

  function registerReturn() {
    void returnAction.run(async () => {
      if (!reason.trim()) throw new Error('Ingresa el motivo de la devolución.');
      try {
        const returned = await createSaleReturn(api, numero, { reason: reason.trim() });
        detail.setData(current => current && { ...current, status: 'DEVUELTA', returned });
        setReason('');
        setShowReturn(false);
        setFeedback('Devolución registrada. Las unidades se reintegraron al inventario.');
      } catch (error) {
        detail.reload();
        throw error;
      }
    });
  }

  const { receipt, status, returned } = detail.data ?? {};

  return (
    <Screen refresh={returnAction.busy ? undefined : detail.reload} refreshing={detail.loading}>
      {detail.loading && !receipt && <Loading label="Cargando comprobante…" />}
      {detail.error !== '' && <Notice message={detail.error} error />}
      {detail.error !== '' && <Button label="Reintentar" kind="secondary" onPress={detail.reload} />}
      {receipt && (
        <>
          <Card title={receipt.receiptNumber}>
            <Copy tone="muted">{dateTime(receipt.createdAt)}{status ? ` · ${status}` : ''}</Copy>
            <Copy>Vendedor {receipt.sellerName}</Copy>
            <Copy>Cliente {receipt.customerName}</Copy>
            {receipt.items.map((item, index) => (
              <ListRow key={`${item.sku}-${index}`}>
                <Copy strong>{item.quantity} × {item.productName}</Copy>
                <Copy tone="muted">{item.sku} · {item.size} · {item.color} · {money(item.unitPrice)} por unidad</Copy>
                <Copy>{money(item.lineTotal)}</Copy>
              </ListRow>
            ))}
            <Copy>Subtotal {money(receipt.subtotal)} · IVA {money(receipt.taxTotal)}</Copy>
            <Copy>Descuento {receipt.discountPercent} % · {money(receipt.discountValue)}</Copy>
            <Copy size={19} strong>Total {money(receipt.total)}</Copy>
            <Copy>Pago {receipt.paymentMethod} · Recibido {money(receipt.amountReceived)}</Copy>
            <Copy>Cambio {money(receipt.changeGiven)}</Copy>
          </Card>
          <Card title="Devolución">
            {returned && (
              <>
                <Copy strong>Venta devuelta · {money(returned.refundTotal)}</Copy>
                <Copy tone="muted">{dateTime(returned.createdAt)}</Copy>
                <Copy>{returned.reason}</Copy>
              </>
            )}
            {status === 'CONFIRMADA' && <Button label="Registrar devolución total" kind="danger"
              disabled={detail.loading || fileAction.busy || detail.error !== ''} onPress={() => setShowReturn(true)} />}
            {!status && <Copy tone="muted">Estado de la venta no disponible.</Copy>}
          </Card>
          {feedback !== '' && <Notice message={feedback} />}
          {fileAction.error !== '' && <Notice message={fileAction.error} error />}
          <Button label="Compartir PDF" kind="secondary" disabled={detail.loading || detail.error !== ''}
            busy={fileAction.busy} onPress={() => exportReceipt(false)} />
          <Button label="Guardar PDF" kind="secondary" disabled={detail.loading || detail.error !== ''}
            busy={fileAction.busy} onPress={() => exportReceipt(true)} />
          {showReturn && status === 'CONFIRMADA' && <FormModal title="Registrar devolución total"
            onClose={() => { setShowReturn(false); setReason(''); }} busy={returnAction.busy}>
            <Copy>Se reintegrarán los artículos y se registrará una devolución de {money(receipt.total)}.</Copy>
            <Field label="Motivo de devolución" value={reason} onChangeText={setReason} maxLength={500}
              multiline editable={!returnAction.busy} />
            {returnAction.error !== '' && <Notice message={returnAction.error} error />}
            <Button label="Confirmar devolución" kind="danger" busy={returnAction.busy}
              disabled={detail.loading} onPress={registerReturn} />
          </FormModal>}
        </>
      )}
    </Screen>
  );
}
