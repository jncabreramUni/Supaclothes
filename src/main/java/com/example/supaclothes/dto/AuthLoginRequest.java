package com.example.supaclothes.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Modelo para la petición de inicio de sesión")
public class AuthLoginRequest {

    @Schema(description = "Nombre de usuario", example = "admin123")
    private String username;

    @Schema(description = "Contraseña en texto plano", example = "SupaSecret99!")
    private String password;

    // Genera los Getters y Setters
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}