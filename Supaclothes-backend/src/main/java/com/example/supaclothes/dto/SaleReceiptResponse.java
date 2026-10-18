package com.example.supaclothes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SaleReceiptResponse(
    String receiptNumber,
    LocalDateTime createdAt,
    String sellerName,
    List<Item> items,
    BigDecimal subtotal,
    BigDecimal taxTotal,
    BigDecimal total,
    String paymentMethod,
    BigDecimal amountReceived,
    BigDecimal changeGiven
) {
    public record Item(
        String sku,
        String productName,
        String size,
        String color,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal
    ) {}
}
