import { useCallback, useState } from 'react';
import { xlsxMime, type WorkbookDownload } from '../../api/client';
import { downloadInventoryReport, downloadSalesReport, getInventoryReport, getSalesReport } from '../../api/operations';
import { useSession } from '../../auth/session';
import { attachmentFile, saveAttachment, shareAttachment } from '../../components/attachments';
import { dateTime, money } from '../../components/format';
import { PeriodFilter } from '../../components/period-filter';
import { Button, Card, Copy, ListRow, Loading, Notice, Screen } from '../../components/ui';
import { useAction } from '../../components/use-action';
import { useResource } from '../../components/use-resource';
import type { Range } from '../../types/api';

export default function ReportsScreen() {
  const [report, setReport] = useState<'sales' | 'inventory'>('sales');
  return (
    <Screen>
      <Card title="Consulta de reportes">
        <Button label="Ventas y devoluciones" kind={report === 'sales' ? 'primary' : 'secondary'} onPress={() => setReport('sales')} />
        <Button label="Inventario actual" kind={report === 'inventory' ? 'primary' : 'secondary'} onPress={() => setReport('inventory')} />
      </Card>
      {report === 'sales' ? <SalesReportView /> : <InventoryReportView />}
    </Screen>
  );
}

function SalesReportView() {
  const { api } = useSession();
  const [filters, setFilters] = useState<Partial<Range>>({});
  const report = useResource(useCallback((signal: AbortSignal) => getSalesReport(api, filters, signal), [api, filters]));
  const result = !report.loading && !report.error ? report.data : undefined;
  return (
    <Card title="Ventas y devoluciones">
      <PeriodFilter onApply={setFilters} />
      {report.loading && <Loading />}
      {report.error !== '' && <Notice error message={report.error} />}
      {report.error !== '' && <Button label="Reintentar" kind="secondary" onPress={report.reload} />}
      {result && (
        <>
          <Copy tone="muted">{result.from} a {result.to}</Copy>
          <Copy strong>Ventas netas {money(result.netSales)}</Copy>
          <Copy>Ventas brutas {money(result.grossSales)} · Devoluciones {money(result.refunds)}</Copy>
          <WorkbookActions key={`${result.from}/${result.to}`} download={() => downloadSalesReport(api, result)} />
          {result.rows.length === 0 && <Copy tone="muted">No hay ventas para este periodo.</Copy>}
          {result.rows.map(row => (
            <ListRow key={`${row.receiptNumber}-${row.status}`}>
              <Copy strong>{row.receiptNumber} · {row.status === 'DEVOLUCION' ? 'Devolución' : 'Venta'}</Copy>
              <Copy tone="muted">{dateTime(row.createdAt)} · Neto {money(row.netTotal)}</Copy>
            </ListRow>
          ))}
        </>
      )}
    </Card>
  );
}

function InventoryReportView() {
  const { api } = useSession();
  const report = useResource(useCallback((signal: AbortSignal) => getInventoryReport(api, signal), [api]));
  return (
    <Card title="Inventario actual">
      {report.loading && <Loading />}
      {report.error !== '' && <Notice error message={report.error} />}
      {report.error !== '' && <Button label="Reintentar" kind="secondary" onPress={report.reload} />}
      {!report.loading && report.error === '' && report.data && (
        <>
          <Copy strong>{report.data.stockUnits} unidades · {report.data.lowStockCount} variantes con stock bajo</Copy>
          <WorkbookActions download={() => downloadInventoryReport(api)} />
          {report.data.rows.length === 0 && <Copy tone="muted">No hay variantes en inventario.</Copy>}
          {report.data.rows.map(row => (
            <ListRow key={row.sku}>
              <Copy strong>{row.sku} · {row.productName}</Copy>
              <Copy tone={row.lowStock ? 'warning' : 'muted'}>{row.stock} en stock · mínimo {row.minStock}</Copy>
            </ListRow>
          ))}
        </>
      )}
    </Card>
  );
}

function WorkbookActions({ download }: { download: () => Promise<WorkbookDownload> }) {
  const action = useAction();
  const [message, setMessage] = useState('');

  function exportWorkbook(save: boolean) {
    void action.run(async () => {
      setMessage('');
      const { filename, bytes } = await download();
      const file = attachmentFile(filename);
      file.create();
      await file.write(bytes);
      if (!save) await shareAttachment(file, xlsxMime);
      else if (await saveAttachment(file, xlsxMime)) setMessage(`Se guardó ${file.name}.`);
    });
  }

  return (
    <>
      {message !== '' && <Notice message={message} />}
      {action.error !== '' && <Notice message={action.error} error />}
      <Button label="Descargar Excel" kind="secondary" busy={action.busy} onPress={() => exportWorkbook(true)} />
      <Button label="Compartir Excel" kind="secondary" busy={action.busy} onPress={() => exportWorkbook(false)} />
    </>
  );
}
