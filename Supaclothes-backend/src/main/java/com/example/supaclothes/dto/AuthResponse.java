package com.example.supaclothes.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Modelo para la respuesta de inicio de sesión exitoso")
public class AuthResponse {
    
    @Schema(description = "Token JWT", example = "eyJhbGciOiJIUzI1NiJ9...")
    private String token;
    private String role;
    private String fullName;

    public AuthResponse(String token, String role, String fullName) {
        this.token = token;
        this.role = role;
        this.fullName = fullName;
    }
    
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
}