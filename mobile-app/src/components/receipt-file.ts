import { moveAsync } from 'expo-file-system/legacy';
import { printToFileAsync } from 'expo-print';
import type { ReturnResponse, SaleReceiptResponse } from '../types/api';
import { attachmentFile } from './attachments';
import { dateTime, money } from './format';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character] ?? character);

export async function makeReceiptFile(receipt: SaleReceiptResponse, returned: ReturnResponse | null) {
  const items = receipt.items.map(item => `<tr>
    <td>${escapeHtml(item.productName)} · ${escapeHtml(item.sku)}<br>${escapeHtml(item.size)} · ${escapeHtml(item.color)}</td>
    <td>${item.quantity}</td><td>${money(item.unitPrice)}</td><td>${money(item.lineTotal)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Comprobante SupaClothes</title>
    <style>
      body { font: 13px sans-serif; color: #162235; margin: 30px; }
      h1 { font-size: 24px; } table { width: 100%; border-collapse: collapse; margin: 18px 0; }
      th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e7ebf1; }
      tr { break-inside: avoid; } .total { font-size: 17px; font-weight: bold; }
    </style></head><body>
    <h1>SupaClothes</h1><h2>Comprobante interno ${escapeHtml(receipt.receiptNumber)}</h2>
    <p>${escapeHtml(dateTime(receipt.createdAt))}</p>
    <p>Vendedor ${escapeHtml(receipt.sellerName)}<br>Cliente ${escapeHtml(receipt.customerName)}</p>
    <table><thead><tr><th>Artículo</th><th>Cantidad</th><th>Precio</th><th>Total</th></tr></thead><tbody>${items}</tbody></table>
    <p>Subtotal ${money(receipt.subtotal)} · IVA ${money(receipt.taxTotal)} · Descuento ${money(receipt.discountValue)}</p>
    <p class="total">Total ${money(receipt.total)}</p>
    <p>Pago ${escapeHtml(receipt.paymentMethod)} · Recibido ${money(receipt.amountReceived)} · Cambio ${money(receipt.changeGiven)}</p>
    ${returned ? `<h2>Venta devuelta</h2><p>${escapeHtml(dateTime(returned.createdAt))} · ${money(returned.refundTotal)}</p>
      <p>Motivo ${escapeHtml(returned.reason)}</p>` : ''}
    <p>Documento interno de SupaClothes.</p></body></html>`;
  const { uri } = await printToFileAsync({ html });
  const pdf = attachmentFile(`${receipt.receiptNumber}.pdf`);
  await moveAsync({ from: uri, to: pdf.uri });
  return pdf;
}
