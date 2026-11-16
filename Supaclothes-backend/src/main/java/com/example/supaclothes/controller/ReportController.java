package com.example.supaclothes.controller;

import com.example.supaclothes.service.AnalyticsService;
import com.example.supaclothes.service.ReportWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final AnalyticsService analytics;

    public ReportController(AnalyticsService analytics) { this.analytics = analytics; }

    @GetMapping("/dashboard")
    public AnalyticsService.Dashboard dashboard(@RequestParam(required = false) LocalDate from,
                                               @RequestParam(required = false) LocalDate to) {
        return analytics.dashboard(from, to);
    }

    @GetMapping("/sales")
    public AnalyticsService.SalesReport sales(@RequestParam(required = false) LocalDate from,
                                            @RequestParam(required = false) LocalDate to) {
        return analytics.sales(from, to);
    }

    @GetMapping("/inventory")
    public AnalyticsService.InventoryReport inventory() { return analytics.inventory(); }

    @GetMapping("/sales/export")
    public ResponseEntity<byte[]> exportSales(@RequestParam(required = false) LocalDate from,
                                             @RequestParam(required = false) LocalDate to) {
        var report = analytics.sales(from, to);
        return download("ventas-" + report.from() + "-" + report.to() + ".xlsx", ReportWorkbook.sales(report));
    }

    @GetMapping("/inventory/export")
    public ResponseEntity<byte[]> exportInventory() {
        return download("inventario-" + LocalDate.now() + ".xlsx", ReportWorkbook.inventory(analytics.inventory()));
    }

    private ResponseEntity<byte[]> download(String filename, byte[] bytes) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
