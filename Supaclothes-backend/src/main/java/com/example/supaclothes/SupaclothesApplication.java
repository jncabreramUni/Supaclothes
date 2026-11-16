package com.example.supaclothes;

import com.example.supaclothes.entity.Role;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootApplication
public class SupaclothesApplication {

    public static void main(String[] args) {
        SpringApplication.run(SupaclothesApplication.class, args);
    }

    @Bean
    public CommandLineRunner initAdminUser(
            RoleRepository roleRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PlatformTransactionManager transactionManager,
            @Value("${supaclothes.bootstrap.admin-password:}") String initialAdminPassword) {
        TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
        return args -> transactionTemplate.executeWithoutResult(status -> {
            Role adminRole = createRoleIfMissing(
                    roleRepository, "ADMIN", "Administrador principal del sistema");
            createRoleIfMissing(roleRepository, "VENDEDOR", "Empleado de ventas");
            createRoleIfMissing(roleRepository, "BODEGA", "Encargado de inventario");

            if (userRepository.count() == 0) {
                if (initialAdminPassword.isBlank()) {
                    throw new IllegalStateException(
                            "Configura SUPACLOTHES_ADMIN_PASSWORD para crear el administrador inicial.");
                }
                User adminUser = new User();
                adminUser.setUsername("admin");
                adminUser.setPasswordHash(passwordEncoder.encode(initialAdminPassword));
                adminUser.setFullName("Juan Nicolas Cabrera Miranda");
                adminUser.setActive(true);
                adminUser.setRole(adminRole);
                userRepository.save(adminUser);
            }
        });
    }

    private Role createRoleIfMissing(RoleRepository roleRepository, String name, String description) {
        return roleRepository.findByName(name).orElseGet(() -> {
            Role role = new Role();
            role.setName(name);
            role.setDescription(description);
            return roleRepository.save(role);
        });
    }
}
