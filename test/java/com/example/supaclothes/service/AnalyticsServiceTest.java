package com.example.supaclothes.service;

import com.example.supaclothes.entity.Product;
import com.example.supaclothes.entity.ProductVariant;
import com.example.supaclothes.entity.Sale;
import com.example.supaclothes.entity.SaleReturn;
import com.example.supaclothes.repository.ProductVariantRepository;
import com.example.supaclothes.repository.SaleRepository;
import com.example.supaclothes.repository.SaleReturnRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {
    @Mock SaleRepository sales;
    @Mock SaleReturnRepository returns;
    @Mock ProductVariantRepository variants;
    @InjectMocks AnalyticsService analytics;

    @Test
    void countsReturnsOnTheirOwnDateEvenWhenTheOriginalSaleIsOutsideThePeriod() {
        LocalDate day = LocalDate.of(2026, 10, 27);
        Sale sale = new Sale();
        sale.setCreatedAt(day.atTime(10, 0)); sale.setReceiptNumber("FAC-NEW");
        sale.setTotal(new BigDecimal("90.00")); sale.setStatus("DEVUELTA");
        SaleReturn returned = mock(SaleReturn.class);
        when(returned.getCreatedAt()).thenReturn(day.plusDays(1).atTime(11, 0));
        when(returned.getReceiptNumber()).thenReturn("FAC-OLD");
        when(returned.getRefundTotal()).thenReturn(new BigDecimal("120.00"));
        when(sales.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(day.atStartOfDay(), day.plusDays(3).atStartOfDay())).thenReturn(List.of(sale));
        when(returns.findByCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(day.atStartOfDay(), day.plusDays(3).atStartOfDay())).thenReturn(List.of(returned));
        when(variants.findAll()).thenReturn(List.of());
        var dashboard = analytics.dashboard(day, day.plusDays(2));
        assertEquals(1, dashboard.salesCount());
        assertEquals(new BigDecimal("90.00"), dashboard.grossSales());
        assertEquals(new BigDecimal("120.00"), dashboard.refunds());
        assertEquals(new BigDecimal("-30.00"), dashboard.netSales());
        assertEquals(3, dashboard.daily().size());
        assertEquals(new BigDecimal("-120.00"), dashboard.daily().get(1).net());
        assertEquals(BigDecimal.ZERO, dashboard.daily().get(2).net());
    }

    @Test
    void validatesDateRangesBeforeQuerying() {
        LocalDate day = LocalDate.of(2026, 1, 1);
        assertThrows(ResponseStatusException.class, () -> analytics.sales(day, day.minusDays(1)));
        assertThrows(ResponseStatusException.class, () -> analytics.sales(day, day.plusDays(366)));
        verifyNoInteractions(sales, returns);
        assertEquals(new AnalyticsService.Range(day.minusDays(6), day), analytics.range(null, day));
    }

    @Test
    void inventoryIncludesInactiveStockButOnlyAlertsOnActiveVariants() {
        Product product = new Product(); product.setName("Camisa"); product.setActive(true);
        ProductVariant active = new ProductVariant(); active.setProduct(product); active.setSku("A");
        active.setCurrentStock(2); active.setMinStock(2); active.setActive(true);
        ProductVariant inactive = new ProductVariant(); inactive.setProduct(product); inactive.setSku("B");
        inactive.setCurrentStock(1); inactive.setMinStock(3); inactive.setActive(false);
        when(variants.findAll()).thenReturn(List.of(inactive, active));
        var inventory = analytics.inventory();
        assertEquals(3, inventory.stockUnits()); assertEquals(1, inventory.lowStockCount());
        assertEquals("A", inventory.rows().get(0).sku()); assertFalse(inventory.rows().get(1).lowStock());
    }
}
