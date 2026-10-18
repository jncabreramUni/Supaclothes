package com.example.supaclothes.dto;

import java.time.LocalDateTime;

public record InventoryMovementResponse(
    int id,
    String sku,
    String type,
    int quantity,
    int previousStock,
    int resultingStock,
    String username,
    String reference,
    LocalDateTime createdAt
) {}
