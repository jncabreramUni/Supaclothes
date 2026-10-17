package com.example.supaclothes.dto;

import java.util.List;

public record SaleRequest(
    // Por ahora dejaremos customerId y descuento como nulos/opcionales 
    // hasta que llegues a las HU-06 y HU-09.
    Integer customerId,
    List<SaleItemRequest> items
) {}