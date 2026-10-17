package com.example.supaclothes.dto;

public record SaleItemRequest(
    String sku,
    int quantity
) {}