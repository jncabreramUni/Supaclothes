package com.example.supaclothes.security;

import com.example.supaclothes.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.AuthenticationEntryPoint;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final UserRepository userRepository;
    private final JwtService jwtService;

    public SecurityConfig(UserRepository userRepository, JwtService jwtService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        AuthenticationEntryPoint authenticationEntryPoint =
                (request, response, exception) -> response.sendError(401, "Authentication required");

        http.csrf(csrf -> csrf.disable());
        http.authorizeHttpRequests(auth -> {
            auth.requestMatchers(
                    "/", "/index.html", "/css/**", "/js/**", "/favicon.ico", "/favicon.svg",
                    "/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html"
                ).permitAll();
            auth.requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/admin/login").permitAll();
            auth.requestMatchers("/api/auth/**").authenticated();
            auth.requestMatchers("/api/users/**").hasRole("ADMIN");
            auth.requestMatchers("/api/reports/**").hasRole("ADMIN");
            auth.requestMatchers(HttpMethod.GET, "/api/products/**")
                    .hasAnyRole("ADMIN", "VENDEDOR", "BODEGA");
            auth.requestMatchers("/api/products/**").hasRole("ADMIN");
            auth.requestMatchers(HttpMethod.GET, "/api/inventory/**")
                    .hasAnyRole("ADMIN", "VENDEDOR", "BODEGA");
            auth.requestMatchers("/api/inventory/**").hasAnyRole("ADMIN", "BODEGA");
            auth.requestMatchers("/api/customers/**").hasAnyRole("ADMIN", "VENDEDOR");
            auth.requestMatchers("/api/sales/**").hasAnyRole("ADMIN", "VENDEDOR");
            auth.anyRequest().authenticated();
        });
        http.exceptionHandling(configurer -> configurer.authenticationEntryPoint(authenticationEntryPoint));
        http.sessionManagement(configurer -> configurer.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(
                new JwtAuthenticationFilter(jwtService, userDetailsService()),
                UsernamePasswordAuthenticationFilter.class
        );
        return http.build();
    }

    @Bean
    public UserDetailsService userDetailsService() {
        return username -> userRepository.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado"));
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService());
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // El estándar de la industria para hashear contraseñas
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}