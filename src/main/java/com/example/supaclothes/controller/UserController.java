package com.example.supaclothes.controller;

import com.example.supaclothes.dto.UserCreateRequest;
import com.example.supaclothes.dto.UserResponse;
import com.example.supaclothes.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import java.util.List;

@RestController
@RequestMapping("/api/users")
@Tag(name = "Administración de Usuarios", description = "Endpoints para la HU-02 (Crear, listar y desactivar usuarios)")
@SecurityScheme(
        name = "bearerAuth",
        type = SecuritySchemeType.HTTP,
        scheme = "bearer",
        bearerFormat = "JWT"
)
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Listar usuarios", description = "Devuelve una lista de todos los usuarios registrados en el sistema.")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping
    @Operation(summary = "Crear usuario", description = "Registra un nuevo usuario asignándole un rol específico (ej. ADMIN o VENDEDOR).")
    public ResponseEntity<UserResponse> createUser(@RequestBody UserCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }

    @PatchMapping("/{id}/deactivate")
    @Operation(summary = "Desactivar usuario", description = "Realiza un borrado lógico cambiando el estado activo a falso, impidiendo su acceso sin borrar su historial.")
    public ResponseEntity<Void> deactivateUser(@PathVariable Long id) {
        userService.deactivateUser(id);
        return ResponseEntity.noContent().build(); // Devuelve un 204 sin contenido, el estándar para operaciones exitosas que no retornan datos
    }
}