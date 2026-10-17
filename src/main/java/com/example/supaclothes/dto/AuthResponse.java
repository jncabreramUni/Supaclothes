package com.example.supaclothes.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Modelo para la respuesta de inicio de sesión exitoso")
public class AuthResponse {
    
    @Schema(description = "Token JWT", example = "eyJhbGciOiJIUzI1NiJ9...")
    private String token;

    public AuthResponse(String token) {
        this.token = token;
    }
    
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}