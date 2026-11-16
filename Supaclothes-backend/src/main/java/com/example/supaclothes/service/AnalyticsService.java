package com.example.supaclothes.service;

import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.SaleRepository;
import com.example.supaclothes.repository.SaleReturnRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class AnalyticsService {
    private final SaleRepository sales;
    private final SaleReturnRepository returns;
    private final ProductVariantRepository variants;

    public AnalyticsService(SaleRepository sales, SaleReturnRepository returns, ProductVariantRepository variants) {
        this.sales = sales;
        this.returns = returns;
        this.variants = variants;
    }

    public record Range(LocalDate from, LocalDate to) {}
    public record SalesRow(String receiptNumber, LocalDateTime createdAt, String status,
                           BigDecimal total, BigDecimal refundedTotal, BigDecimal netTotal) {}
    public record SalesReport(LocalDate from, LocalDate to, List<SalesRow> rows,
                              BigDecimal grossSales, BigDecimal refunds, BigDecimal netSales) {}
    public record InventoryRow(String sku, String productName, String size, String color, int stock,
                               int minStock, BigDecimal price, boolean active, boolean lowStock) {}
    public record InventoryReport(List<InventoryRow> rows, long stockUnits, long lowStockCount) {}
    public record Day(LocalDate date, BigDecimal sales, BigDecimal refunds, BigDecimal net) {}
    public record Dashboard(LocalDate from, LocalDate to, long salesCount, BigDecimal grossSales,
                            BigDecimal refunds, BigDecimal netSales, long stockUnits,
                            long lowStockCount, List<Day> daily) {}

    public Range range(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 365
                || end.equals(LocalDate.MAX)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Selecciona un rango de fechas válido de máximo 366 días");
        }
        return new Range(start, end);
    }

    /** Each row is an event in the period, so later returns do not rewrite earlier reports. */
    public SalesReport sales(LocalDate from, LocalDate to) {
        Range range = range(from, to);
        var start = range.from().atStartOfDay();
        var end = range.to().plusDays(1).atStartOfDay();
        var rows = new ArrayList<SalesRow>();
        sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end)
                .forEach(sale -> rows.add(new SalesRow(sale.getReceiptNumber(), sale.getCreatedAt(),
                        "VENTA", sale.getTotal(), BigDecimal.ZERO, sale.getTotal())));
        returns.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(start, end)
                .forEach(ret -> rows.add(new SalesRow(ret.getReceiptNumber(), ret.getCreatedAt(),
                        "DEVOLUCION", BigDecimal.ZERO, ret.getRefundTotal(), ret.getRefundTotal().negate())));
        rows.sort(Comparator.comparing(SalesRow::createdAt).reversed()
                .thenComparing(SalesRow::receiptNumber).thenComparing(SalesRow::status));
        BigDecimal gross = rows.stream().map(SalesRow::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refunded = rows.stream().map(SalesRow::refundedTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SalesReport(range.from(), range.to(), List.copyOf(rows), gross, refunded, gross.subtract(refunded));
    }

    public InventoryReport inventory() {
        var rows = variants.findAll().stream().map(variant -> {
            boolean active = variant.isActive() && variant.getProduct().isActive();
            return new InventoryRow(variant.getSku(), variant.getProduct().getName(), variant.getSize(),
                    variant.getColor(), variant.getCurrentStock(), variant.getMinStock(), variant.getPrice(),
                    active, active && variant.getCurrentStock() <= variant.getMinStock());
        }).sorted(Comparator.comparing(InventoryRow::sku)).toList();
        return new InventoryReport(rows, rows.stream().mapToLong(InventoryRow::stock).sum(),
                rows.stream().filter(InventoryRow::lowStock).count());
    }

    public Dashboard dashboard(LocalDate from, LocalDate to) {
        SalesReport report = sales(from, to);
        InventoryReport inventory = inventory();
        var daily = new ArrayList<Day>();
        for (LocalDate date = report.from(); !date.isAfter(report.to()); date = date.plusDays(1)) {
            LocalDate current = date;
            BigDecimal gross = report.rows().stream().filter(row -> row.createdAt().toLocalDate().equals(current))
                    .map(SalesRow::total).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal refunded = report.rows().stream().filter(row -> row.createdAt().toLocalDate().equals(current))
                    .map(SalesRow::refundedTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            daily.add(new Day(date, gross, refunded, gross.subtract(refunded)));
        }
        return new Dashboard(report.from(), report.to(), report.rows().stream().filter(row -> row.status().equals("VENTA")).count(),
                report.grossSales(), report.refunds(), report.netSales(), inventory.stockUnits(), inventory.lowStockCount(), List.copyOf(daily));
    }
}
