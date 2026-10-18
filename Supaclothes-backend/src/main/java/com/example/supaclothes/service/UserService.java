package com.example.supaclothes.service;

import com.example.supaclothes.dto.UserCreateRequest;
import com.example.supaclothes.dto.UserResponse;
import com.example.supaclothes.entity.Role;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 1. Listar todos los usuarios
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
            .map(user -> new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole().getName(),
                user.isActive()
            )).toList();
    }

    // 2. Crear un nuevo usuario
    public UserResponse createUser(UserCreateRequest request) {
        if (request == null
                || request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()
                || request.fullName() == null || request.fullName().isBlank()
                || request.roleName() == null || request.roleName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todos los campos son obligatorios");
        }

        String username = request.username().trim();
        String fullName = request.fullName().trim();
        if (request.password().length() < 6 || username.length() > 50 || fullName.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario, nombre o contraseña no cumplen los límites requeridos");
        }
        if (userRepository.findByUsername(username).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El nombre de usuario ya está registrado");
        }

        Role role = roleRepository.findByName(request.roleName())
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "El rol especificado no existe"
            ));

        User user = new User();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(fullName);
        user.setRole(role);
        user.setActive(true);

        User savedUser = userRepository.save(user);

        return new UserResponse(
            savedUser.getId(),
            savedUser.getUsername(),
            savedUser.getFullName(),
            role.getName(),
            savedUser.isActive()
        );
    }

    // 3. Desactivar usuario (Soft Delete de la HU-02)
    public void deactivateUser(Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        user.setActive(false);
        userRepository.save(user);
    }
}