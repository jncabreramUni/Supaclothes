package com.example.supaclothes;

import com.example.supaclothes.entity.Role;
import com.example.supaclothes.entity.User;
import com.example.supaclothes.repository.RoleRepository;
import com.example.supaclothes.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InitialAdminRunnerTest {

    private final RoleRepository roles = mock(RoleRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @BeforeEach
    void configureTransactionAndRoleInsert() {
        when(transactions.getTransaction(any())).thenAnswer(invocation -> new SimpleTransactionStatus());
        when(roles.save(any(Role.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void commitsRolesWithoutAnInitialPassword() throws Exception {
        runInitializer("");

        verify(transactions).commit(any());
        verify(roles, times(3)).save(any(Role.class));
        verify(users, never()).save(any(User.class));
    }

    @Test
    void commitsRolesWhenUtf8PasswordExceedsBcryptLimit() throws Exception {
        runInitializer("a".repeat(69) + "\uD83D\uDE00");

        verify(transactions).commit(any());
        verify(users, never()).save(any(User.class));
    }

    @Test
    void createsActiveAdminWhenPasswordFitsBcryptLimit() throws Exception {
        String password = "a".repeat(68) + "\uD83D\uDE00";
        runInitializer(password);

        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        verify(users).save(user.capture());
        assertEquals("admin", user.getValue().getUsername());
        assertEquals("ADMIN", user.getValue().getRole().getName());
        assertTrue(user.getValue().isActive());
        assertTrue(encoder.matches(password, user.getValue().getPasswordHash()));
    }

    private void runInitializer(String password) throws Exception {
        new SupaclothesApplication().initAdminUser(roles, users, encoder, transactions, password).run();
    }
}
