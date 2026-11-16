package com.example.supaclothes.controller;

import com.example.supaclothes.dto.AuthLoginRequest;
import com.example.supaclothes.dto.AuthResponse;
import com.example.supaclothes.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticación", description = "Endpoints para inicio de sesión y gestión de tokens (HU-01)")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión", description = "Valida las credenciales del usuario y devuelve un token JWT real.")
    @ApiResponse(responseCode = "200", description = "Inicio de sesión exitoso")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthLoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/admin/login")
    @Operation(summary = "Acceso administrativo", description = "Autentica únicamente cuentas con rol ADMIN.")
    @ApiResponse(responseCode = "200", description = "Inicio de sesión administrativo exitoso")
    public ResponseEntity<AuthResponse> loginAdmin(@RequestBody AuthLoginRequest request) {
        return ResponseEntity.ok(authService.loginAdmin(request));
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(Principal principal) {
        authService.logout(principal.getName());
    }
}