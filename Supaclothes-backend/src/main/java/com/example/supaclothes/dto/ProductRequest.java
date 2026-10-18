package com.example.supaclothes.dto;

import java.util.List;

public record ProductRequest(
    String name,
    String category,
    String description,
    List<ProductVariantRequest> variants
) {}