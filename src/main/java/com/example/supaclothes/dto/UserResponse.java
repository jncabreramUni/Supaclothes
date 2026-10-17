package com.example.supaclothes.dto;

public record UserResponse(
    Long id, 
    String username, 
    String fullName, 
    String role, 
    boolean active
) {}