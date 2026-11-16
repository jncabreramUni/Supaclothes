package com.example.supaclothes.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class JwtService {

    private static final Logger LOGGER = LoggerFactory.getLogger(JwtService.class);
    private final String secretKey;

    public JwtService(@Value("${supaclothes.jwt.secret}") String secretKey) {
        if (secretKey == null || secretKey.isBlank()) {
            byte[] generatedKey = new byte[32];
            new SecureRandom().nextBytes(generatedKey);
            this.secretKey = Base64.getEncoder().encodeToString(generatedKey);
            LOGGER.warn("SUPACLOTHES_JWT_SECRET no está configurada; se generó una clave temporal. "
                    + "Los tokens dejarán de ser válidos al reiniciar. Configura la variable para entornos persistentes.");
        } else {
            byte[] decodedKey = Decoders.BASE64.decode(secretKey);
            Keys.hmacShaKeyFor(decodedKey);
            this.secretKey = secretKey;
        }
    }

    public String generateToken(UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        if (userDetails instanceof com.example.supaclothes.entity.User user) {
            claims.put("tokenVersion", user.getTokenVersion());
        }
        return generateToken(claims, userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return Jwts.builder()
                .setClaims(extraClaims)
                .setSubject(userDetails.getUsername())
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + 1000 * 60 * 60 * 24)) // El token durará 24 horas
                .signWith(getSignInKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        Claims claims = extractAllClaims(token);
        Date expiration = claims.getExpiration();
        int tokenVersion = ((Number) claims.getOrDefault("tokenVersion", 0)).intValue();
        return userDetails.getUsername().equals(claims.getSubject())
                && expiration != null
                && expiration.after(new Date())
                && (!(userDetails instanceof com.example.supaclothes.entity.User user)
                    || tokenVersion == user.getTokenVersion());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignInKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Key getSignInKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}