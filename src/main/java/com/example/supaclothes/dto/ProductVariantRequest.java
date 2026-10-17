package com.example.supaclothes.dto;

import java.math.BigDecimal;

public record ProductVariantRequest(
    String sku,
    String size,
    String color,
    BigDecimal price,
    BigDecimal taxRate,
    int minStock
) {}