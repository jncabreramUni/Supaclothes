package com.example.supaclothes.dto;

public record ProductUpdateRequest(
    String name,
    String category,
    String description
) {}
