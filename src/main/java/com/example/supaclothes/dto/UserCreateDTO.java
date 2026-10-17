package com.example.supaclothes.dto;

// Usamos "record" de Java 17, ideal para DTOs inmutables
public record UserCreateDTO(
    String username,
    String password,
    String fullName,
    String role
) {}