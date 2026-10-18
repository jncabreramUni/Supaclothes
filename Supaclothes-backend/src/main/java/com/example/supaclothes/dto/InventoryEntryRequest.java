package com.example.supaclothes.dto;

public record InventoryEntryRequest(
    String sku,
    int quantity,
    String reference // Ej: "Factura del proveedor #9982"
) {}