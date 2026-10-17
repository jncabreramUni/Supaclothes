package com.example.supaclothes.dto;

public record UserCreateRequest(
    String username, 
    String password, 
    String fullName, 
    String roleName
) {}    