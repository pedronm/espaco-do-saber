package com.espacodosaber.controller;

import com.espacodosaber.dto.RegisterRequest;
import com.espacodosaber.dto.ChangePasswordRequest;
import com.espacodosaber.model.Role;
import com.espacodosaber.model.User;
import com.espacodosaber.repository.UserRepository;
import com.espacodosaber.security.*;
import com.espacodosaber.service.ObsStreamKeyService;
import com.espacodosaber.service.UserManagementService;
import com.espacodosaber.dto.AuthRequest;
import com.fasterxml.jackson.databind.JsonNode;

import lombok.extern.log4j.Log4j2;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private ObsStreamKeyService obsStreamKeyService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserManagementService userManagementService;

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
            JsonNode tokenResponse = keycloakTokenProvider.getKeycloakTokenResponse(
                loginRequest.username(),
                loginRequest.password()
            );
            String keycloakToken = tokenResponse.get("access_token").asText();

            log.info("Successfully received Keycloak token");

            // Step 2: Get user info from Keycloak
            JsonNode userInfo = keycloakTokenProvider.getUserInfoFromKeycloak(keycloakToken);
            
            log.info("Retrieved user info from Keycloak");

            // Step 3: Build response with Keycloak token and user info
            Map<String, Object> response = new HashMap<>();
            response.put("access_token", keycloakToken);
            response.put("refresh_token", tokenResponse.path("refresh_token").asText(""));
            response.put("expires_in", tokenResponse.path("expires_in").asLong(0));
            response.put("refresh_expires_in", tokenResponse.path("refresh_expires_in").asLong(0));
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

            User dbUser = userRepository.findByUsername(loginRequest.username())
                    .orElse(null);

            if (dbUser == null) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "user_not_registered");
                errorResponse.put("message", "Usuário não cadastrado no sistema.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }

            if (!Boolean.TRUE.equals(dbUser.getActive())) {
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("error", "pending_approval");
                errorResponse.put("message", "Seu cadastro ainda está pendente de aprovação do administrador.");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
            }

            boolean passwordChangeRequired = dbUser.getPasswordExpiresAt() != null
                    && !dbUser.getPasswordExpiresAt().isAfter(java.time.LocalDateTime.now());

            response.put("passwordChangeRequired", passwordChangeRequired);

            if (roles.contains("ADMIN") || roles.contains("TEACHER")) {
                response.put("obs_stream_key", obsStreamKeyService.generateForUsername(loginRequest.username()));
            }

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

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest registerRequest) {
        if (registerRequest.getPassword() == null || registerRequest.getConfirmPassword() == null
                || !registerRequest.getPassword().equals(registerRequest.getConfirmPassword())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "password_mismatch",
                    "message", "A confirmação de senha não confere"
            ));
        }

        if (userRepository.existsByUsername(registerRequest.getUsername())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "username_exists",
                    "message", "Nome de usuário já existe"
            ));
        }

        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "email_exists",
                    "message", "Email já está em uso"
            ));
        }

        User user = new User();
        user.setUsername(registerRequest.getUsername());
        user.setEmail(registerRequest.getEmail());
        user.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
        user.setFullName(registerRequest.getFullName());
        user.setRole(Role.STUDENT);
        user.setActive(false);

        userRepository.save(user);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Cadastro recebido. Aguarde aprovação do administrador para acessar o sistema.",
                "pendingApproval", true
        ));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody ChangePasswordRequest request
    ) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "unauthorized",
                    "message", "Token de autenticação inválido"
            ));
        }

        if (request.getNewPassword() == null || request.getConfirmNewPassword() == null
                || !request.getNewPassword().equals(request.getConfirmNewPassword())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "password_mismatch",
                    "message", "A confirmação da nova senha não confere"
            ));
        }

        if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "invalid_current_password",
                    "message", "Senha atual é obrigatória"
            ));
        }

        if (request.getCurrentPassword().equals(request.getNewPassword())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "password_not_changed",
                    "message", "A nova senha deve ser diferente da senha atual"
            ));
        }

        String accessToken = authorization.substring(7);

        try {
            JsonNode userInfo = keycloakTokenProvider.getUserInfoFromKeycloak(accessToken);
            String username = userInfo.path("preferred_username").asText();

            keycloakTokenProvider.changePassword(accessToken, request.getCurrentPassword(), request.getNewPassword());

            userRepository.findByUsername(username).ifPresent(user -> {
                user.setPassword(passwordEncoder.encode(request.getNewPassword()));
                userRepository.save(user);
            });
            userManagementService.clearPasswordExpiration(username);

            return ResponseEntity.ok(Map.of("message", "Senha alterada com sucesso"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "password_change_failed",
                    "message", "Não foi possível alterar a senha",
                    "details", e.getMessage()
            ));
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refresh_token");
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "invalid_request",
                "message", "refresh_token is required"
            ));
        }

        try {
            JsonNode tokenResponse = keycloakTokenProvider.refreshKeycloakToken(refreshToken);
            Map<String, Object> response = new HashMap<>();
            response.put("access_token", tokenResponse.path("access_token").asText(""));
            response.put("refresh_token", tokenResponse.path("refresh_token").asText(refreshToken));
            response.put("expires_in", tokenResponse.path("expires_in").asLong(0));
            response.put("refresh_expires_in", tokenResponse.path("refresh_expires_in").asLong(0));
            response.put("token_type", tokenResponse.path("token_type").asText("Bearer"));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "error", "invalid_token",
                "message", "Unable to refresh token",
                "details", e.getMessage()
            ));
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
