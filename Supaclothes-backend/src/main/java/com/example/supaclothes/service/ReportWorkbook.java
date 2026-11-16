package com.example.supaclothes.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Small OOXML writer for two tabular exports; strings are never evaluated as formulas. */
public final class ReportWorkbook {
    private ReportWorkbook() {}

    public static byte[] sales(AnalyticsService.SalesReport report) {
        var rows = new ArrayList<List<?>>();
        rows.add(List.of("SupaClothes · Movimientos de ventas y devoluciones"));
        rows.add(List.of("Desde", report.from().toString(), "Hasta", report.to().toString()));
        rows.add(List.of("Generado", LocalDateTime.now().toString()));
        rows.add(List.of("Los importes corresponden a la fecha de cada movimiento. Incluye descuentos e impuestos."));
        rows.add(List.of("Comprobante", "Fecha del movimiento", "Tipo", "Ventas", "Devoluciones", "Neto"));
        report.rows().forEach(row -> rows.add(List.of(row.receiptNumber(), row.createdAt().toString(),
                row.status(), row.total(), row.refundedTotal(), row.netTotal())));
        rows.add(List.of("TOTAL", "", "", report.grossSales(), report.refunds(), report.netSales()));
        return write("Ventas", rows, 5);
    }

    public static byte[] inventory(AnalyticsService.InventoryReport report) {
        var rows = new ArrayList<List<?>>();
        rows.add(List.of("SupaClothes · Inventario actual"));
        rows.add(List.of("Generado", LocalDateTime.now().toString()));
        rows.add(List.of("Incluye variantes activas e inactivas. Alerta de stock bajo solo para variantes activas."));
        rows.add(List.of("Unidades", report.stockUnits(), "Variantes con stock bajo", report.lowStockCount()));
        rows.add(List.of("SKU", "Producto", "Talla", "Color", "Existencias", "Mínimo", "Precio unitario", "Activo", "Stock bajo"));
        report.rows().forEach(row -> rows.add(List.of(row.sku(), row.productName(), row.size(), row.color(),
                row.stock(), row.minStock(), row.price(), row.active() ? "Sí" : "No", row.lowStock() ? "Sí" : "No")));
        return write("Inventario", rows, 5);
    }

    private static byte[] write(String sheetName, List<List<?>> rows, int headerRow) {
        try (var bytes = new ByteArrayOutputStream(); var zip = new ZipOutputStream(bytes)) {
            entry(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>");
            entry(zip, "_rels/.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            entry(zip, "xl/workbook.xml", "<?xml version=\"1.0\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"" + sheetName + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            entry(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
            entry(zip, "xl/styles.xml", "<?xml version=\"1.0\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts><fills count=\"2\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill></fills><borders count=\"1\"><border/></borders><cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs><cellXfs count=\"3\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/><xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/><xf numFmtId=\"4\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/></cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>");
            StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"5\" topLeftCell=\"A6\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews><cols><col min=\"1\" max=\"1\" width=\"34\" customWidth=\"1\"/><col min=\"2\" max=\"2\" width=\"36\" customWidth=\"1\"/><col min=\"3\" max=\"9\" width=\"20\" customWidth=\"1\"/></cols><sheetData>");
            for (int r = 0; r < rows.size(); r++) {
                sheet.append("<row r=\"").append(r + 1).append("\">");
                for (int c = 0; c < rows.get(r).size(); c++) {
                    Object value = rows.get(r).get(c);
                    String ref = String.valueOf((char) ('A' + c)) + (r + 1);
                    if (value instanceof Number) {
                        sheet.append("<c r=\"").append(ref).append("\" s=\"")
                                .append(value instanceof java.math.BigDecimal ? 2 : 0)
                                .append("\"><v>").append(value).append("</v></c>");
                    } else {
                        sheet.append("<c r=\"").append(ref).append("\" t=\"inlineStr\" s=\"")
                                .append(r == 0 || r + 1 == headerRow ? 1 : 0).append("\"><is><t xml:space=\"preserve\">")
                                .append(xml(String.valueOf(value))).append("</t></is></c>");
                    }
                }
                sheet.append("</row>");
            }
            sheet.append("</sheetData>");
            int lastDataRow = sheetName.equals("Ventas") ? rows.size() - 1 : rows.size();
            char lastColumn = (char) ('A' + rows.get(headerRow - 1).size() - 1);
            sheet.append("<autoFilter ref=\"A").append(headerRow).append(':').append(lastColumn)
                    .append(lastDataRow).append("\"/></worksheet>");
            entry(zip, "xl/worksheets/sheet1.xml", sheet.toString());
            zip.finish();
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo generar el reporte", e);
        }
    }

    private static void entry(ZipOutputStream zip, String path, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(path));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String xml(String text) {
        return text.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "")
                .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&apos;");
    }
}
