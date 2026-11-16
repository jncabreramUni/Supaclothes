package com.example.supaclothes.service;

import com.example.supaclothes.dto.AuthLoginRequest;
import com.example.supaclothes.dto.AuthResponse;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.UserRepository;
import com.example.supaclothes.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthService(UserRepository userRepository, JwtService jwtService, AuthenticationManager authenticationManager) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    public AuthResponse login(AuthLoginRequest request) {
        return login(request, false);
    }

    public AuthResponse loginAdmin(AuthLoginRequest request) {
        return login(request, true);
    }

    private AuthResponse login(AuthLoginRequest request, boolean adminOnly) {
        // 1. Spring Security compara la contraseña enviada con el hash de la base de datos
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        // 2. Si es correcta, buscamos la información completa del usuario
        User user = userRepository.findByUsername(request.getUsername()).orElseThrow();
        if (adminOnly && !"ADMIN".equalsIgnoreCase(user.getRole().getName())) {
            throw new BadCredentialsException("Credenciales inválidas para el acceso administrativo");
        }

        // 3. Fabricamos el token y lo devolvemos en el DTO
        String token = jwtService.generateToken(user);
        return new AuthResponse(token, user.getRole().getName(), user.getFullName());
    }

    public void logout(String username) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new BadCredentialsException("Usuario no encontrado"));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userRepository.save(user);
    }
}