package com.espacodosaber.service;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ObsStreamKeyService {

    public String generateForUsername(String username) {
        String safeUser = username == null ? "user" : username.replaceAll("[^a-zA-Z0-9_-]", "");
        if (safeUser.isBlank()) {
            safeUser = "user";
        }
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return safeUser + "-" + suffix;
    }
}
