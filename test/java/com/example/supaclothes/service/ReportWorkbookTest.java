package com.example.supaclothes.service;

import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.zip.ZipInputStream;
import static org.junit.jupiter.api.Assertions.*;

class ReportWorkbookTest {
    @Test
    void exportsRealOpenXmlWithNumericAmountsAndLiteralFormulaLikeText() throws Exception {
        LocalDate day = LocalDate.of(2026, 10, 27);
        var row = new AnalyticsService.SalesRow("=HYPERLINK(\"bad\")<&", day.atStartOfDay(), "VENTA",
                new BigDecimal("12.50"), BigDecimal.ZERO, new BigDecimal("12.50"));
        var report = new AnalyticsService.SalesReport(day, day, List.of(row), row.total(), BigDecimal.ZERO, row.total());
        var entries = new HashMap<String, String>();
        try (var zip = new ZipInputStream(new ByteArrayInputStream(ReportWorkbook.sales(report)))) {
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        assertTrue(entries.containsKey("[Content_Types].xml"));
        assertTrue(entries.containsKey("xl/workbook.xml"));
        assertTrue(entries.containsKey("xl/styles.xml"));
        String sheet = entries.get("xl/worksheets/sheet1.xml");
        assertTrue(sheet.contains("t=\"inlineStr\""));
        assertTrue(sheet.contains("=HYPERLINK(&quot;bad&quot;)&lt;&amp;"));
        assertTrue(sheet.contains("<v>12.50</v>"));
        assertFalse(sheet.contains("<f>"));
        var factory = javax.xml.parsers.DocumentBuilderFactory.newInstance();
        for (String xml : entries.values()) {
            assertNotNull(factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))));
        }
    }
}
