package com.example.supaclothes.repository;

import com.example.supaclothes.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // Este método buscará automáticamente al usuario en la BD por su nombre de usuario
    @EntityGraph(attributePaths = "role")
    Optional<User> findByUsername(String username);
}