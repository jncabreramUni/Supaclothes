package com.example.supaclothes.dto;

import java.util.List;

public record SaleRequest(
    Integer customerId,
    List<SaleItemRequest> items,
    String paymentMethod,
    java.math.BigDecimal amountReceived
) {}