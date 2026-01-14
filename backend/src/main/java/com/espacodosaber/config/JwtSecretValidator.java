package com.espacodosaber.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class JwtSecretValidator {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @EventListener(ApplicationReadyEvent.class)
    public void validateJwtSecret() {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET environment variable must be set. " +
                "Generate a secure key with: openssl rand -base64 64"
            );
        }

        byte[] secretBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        int bits = secretBytes.length * 8;
        
        if (bits < 256) {
            throw new IllegalStateException(
                String.format(
                    "JWT secret is too short (%d bits). Must be at least 256 bits. " +
                    "Generate a secure key with: openssl rand -base64 64",
                    bits
                )
            );
        }
    }
}
