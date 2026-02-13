package com.espacodosaber.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.log4j.Log4j2;

/**
 * Keycloak Token Provider - Bridges Keycloak OIDC tokens with application JWT tokens
 * 
 * Option A: Hybrid approach - Uses Keycloak as user source but maintains JWT token generation
 * This allows gradual migration and compatibility with existing JWT infrastructure
 */
@Log4j2
@Component
public class KeycloakTokenProvider {

    @Value("${keycloak.server-url:http://keycloak:8080}")
    private String keycloakServerUrl;

    @Value("${keycloak.realm:espacodosaber}")
    private String keycloakRealm;

    @Value("${keycloak.client-id:backend-client}")
    private String clientId;

    @Value("${keycloak.client-secret:backend-secret}")
    private String clientSecret;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Exchange Keycloak user credentials for token
     * Used during login to verify user against Keycloak
     */
    public String getKeycloakToken(String username, String password) throws Exception {
        String tokenUrl = String.format("%s/realms/%s/protocol/openid-connect/token", 
            keycloakServerUrl, keycloakRealm);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("username", username);
        body.add("password", password);
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("grant_type", "password");
        body.add("scope", "email openid profile");

        log.info("Requesting Keycloak token for user: " + username);
        log.info("Token URL: " + tokenUrl);
        log.info("Request Body: " + body.toString());
        log.info("Headers: " + headers.toString());
        log.info("Client ID: " + clientId);
        log.info("Client Secret: " + clientSecret);
        
        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            String response = restTemplate.postForObject(tokenUrl, request, String.class);
            JsonNode jsonNode = objectMapper.readTree(response);
            log.info("Received Keycloak token for user: " + response);
            return jsonNode.get("access_token").asText();   
        } catch (Exception e) {
            throw new RuntimeException("Failed to authenticate with Keycloak: " + e.getMessage());
        }
    }

    /**
     * Extract user info from Keycloak token
     * Used to map Keycloak user data to application User entity
     */
    public JsonNode getUserInfoFromKeycloak(String accessToken) throws Exception {
        String userInfoUrl = String.format("%s/realms/%s/protocol/openid-connect/userinfo", 
            keycloakServerUrl, keycloakRealm);

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<String> request = new HttpEntity<>(headers);

        try {
            String response = restTemplate.postForObject(userInfoUrl, request, String.class);
            return objectMapper.readTree(response);
        } catch (Exception e) {
            throw new RuntimeException("Failed to get user info from Keycloak: " + e.getMessage());
        }
    }

    /**
     * Verify token is valid in Keycloak
     */
    public boolean validateKeycloakToken(String token) {
        try {
            getUserInfoFromKeycloak(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
