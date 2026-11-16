package com.example.supaclothes;

import com.example.supaclothes.entity.Role;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;

@SpringBootApplication
public class SupaclothesApplication {

    private static final Logger LOGGER = LoggerFactory.getLogger(SupaclothesApplication.class);
    private static final int BCRYPT_MAX_PASSWORD_BYTES = 72;

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
        Runnable initialize = () -> transactionTemplate.executeWithoutResult(status -> {
            Role adminRole = createRoleIfMissing(
                    roleRepository, "ADMIN", "Administrador principal del sistema");
            createRoleIfMissing(roleRepository, "VENDEDOR", "Empleado de ventas");
            createRoleIfMissing(roleRepository, "BODEGA", "Encargado de inventario");

            if (userRepository.count() != 0) {
                return;
            }
            if (initialAdminPassword.isBlank()) {
                LOGGER.warn("Administrador inicial pendiente: configura SUPACLOTHES_ADMIN_PASSWORD y reinicia.");
                return;
            }
            if (initialAdminPassword.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_PASSWORD_BYTES) {
                LOGGER.warn("Administrador inicial pendiente: SUPACLOTHES_ADMIN_PASSWORD supera los 72 bytes de BCrypt.");
                return;
            }

            User adminUser = new User();
            adminUser.setUsername("admin");
            adminUser.setPasswordHash(passwordEncoder.encode(initialAdminPassword));
            adminUser.setFullName("Juan Nicolas Cabrera Miranda");
            adminUser.setActive(true);
            adminUser.setRole(adminRole);
            userRepository.save(adminUser);
        });

        return args -> {
            try {
                initialize.run();
            } catch (DataIntegrityViolationException exception) {
                if (!(exception.getMostSpecificCause() instanceof SQLException sqlException)
                        || !"23505".equals(sqlException.getSQLState())) {
                    throw exception;
                }
                // Otro arranque pudo insertar los datos. Releerlos en una transacción nueva.
                initialize.run();
            }
        };
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
