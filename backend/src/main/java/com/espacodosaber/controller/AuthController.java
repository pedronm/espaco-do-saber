package com.espacodosaber.controller;

import com.espacodosaber.security.*;
import com.espacodosaber.dto.AuthRequest;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.extern.log4j.Log4j2;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Authentication Controller - Direct Keycloak Integration
 * 
 * Flow:
 * 1. User sends credentials to this endpoint
 * 2. Backend validates against Keycloak
 * 3. Keycloak token response is returned directly to client
 */
@Log4j2
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AuthController {

    @Autowired
    private KeycloakTokenProvider keycloakTokenProvider;

    /**
     * Authenticate user with Keycloak and return the access token directly
     * 
     * Request body example:
     * {
     *   "username": "teacher",
     *   "password": "teacher123"
     * }
     * 
     * Response contains:
     * - access_token: The Keycloak JWT token
     * - token_type: "Bearer"
     * - username: User's username
     * - email: User's email from Keycloak
     * - roles: User's roles from Keycloak
     */
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody AuthRequest loginRequest) {
        log.info("Login attempt for username: " + loginRequest.username());
        
        try {
            // Step 1: Validate credentials against Keycloak and get token
            String keycloakToken = keycloakTokenProvider.getKeycloakToken(
                loginRequest.username(),
                loginRequest.password()
            );

            log.info("Successfully received Keycloak token");

            // Step 2: Get user info from Keycloak
            JsonNode userInfo = keycloakTokenProvider.getUserInfoFromKeycloak(keycloakToken);
            
            log.info("Retrieved user info from Keycloak");

            // Step 3: Build response with Keycloak token and user info
            Map<String, Object> response = new HashMap<>();
            response.put("access_token", keycloakToken);
            response.put("token_type", "Bearer");
            response.put("username", userInfo.get("preferred_username").asText());
            response.put("email", userInfo.get("email").asText());
            
            System.out.println("userInfo: " + userInfo.toString());

            // Extract roles from realm_access.roles array; fall back to STUDENT if missing
            JsonNode rolesNode = userInfo.path("realm_access").path("roles");
            List<String> roles = new ArrayList<>();
            if (rolesNode.isArray()) {
                for (JsonNode roleNode : rolesNode) {
                    roles.add(roleNode.asText());
                }
            }

            response.put("roles", roles.isEmpty() ? List.of("STUDENT") : roles);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Authentication failed: " + e.getMessage());
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "authentication_failed");
            errorResponse.put("message", "Invalid credentials");
            errorResponse.put("details", e.getMessage());
            
            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(errorResponse);
        }
    }

    /**
     * Validate a Keycloak token
     * 
     * Pass the token in the Authorization header as "Bearer <token>"
     */
    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader("Authorization") String token) {
        try {
            if (token != null && token.startsWith("Bearer ")) {
                String keycloakToken = token.substring(7);
                
                if (keycloakTokenProvider.validateKeycloakToken(keycloakToken)) {
                    JsonNode userInfo = keycloakTokenProvider.getUserInfoFromKeycloak(keycloakToken);
                    
                    Map<String, Object> response = new HashMap<>();
                    response.put("valid", true);
                    response.put("username", userInfo.get("preferred_username").asText());
                    response.put("email", userInfo.get("email").asText());
                    
                    return ResponseEntity.ok(response);
                }
            }
            
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("valid", false);
            errorResponse.put("message", "Invalid token");
            
            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(errorResponse);
                
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("valid", false);
            errorResponse.put("message", "Token validation failed");
            errorResponse.put("details", e.getMessage());
            
            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(errorResponse);
        }
    }
}
