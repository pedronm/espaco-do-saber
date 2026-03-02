package com.espacodosaber.controller;

import com.espacodosaber.dto.VideoRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.service.VideoService;
import com.espacodosaber.service.VideoService.StreamedFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.io.File;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

@RestController
@RequestMapping("/api/videos")
public class VideoController {

    private static final Logger logger = LoggerFactory.getLogger(VideoController.class);

    @Autowired
    private VideoService videoService;

    @Value("${streaming.auth-debug-log:false}")
    private boolean streamingAuthDebugLog;

    private void logLiveAuth(String endpoint, String liveId, Authentication authentication) {
        if (!streamingAuthDebugLog) {
            return;
        }

        String username = authentication != null ? authentication.getName() : "anonymous";
        Object authorities = authentication != null ? authentication.getAuthorities() : "[]";
        logger.info("[LIVE_AUTH_DEBUG] endpoint={}, liveId={}, user={}, authorities={}", endpoint, liveId, username, authorities);
    }

    private String extractUsernameFromAuthentication(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            String username = jwt.getClaimAsString("preferred_username");
            logger.info("Username extracted from JWT (Authentication): {}", username);
            return username;
        }
        logger.warn("Authentication is null or principal is not JWT");
        return null;
    }

    private String getTokenFromAuthorizationHeader(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        logger.info("Authorization header value: {}", bearerToken);
        if (hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }

    private String getTokenFromCookies(HttpServletRequest request) {
        if (request.getCookies() != null) {
            Optional<Cookie> tokenCookie = Arrays.stream(request.getCookies())
                    .filter(cookie -> "access_token".equals(cookie.getName()) || 
                                    "KEYCLOAK_TOKEN".equals(cookie.getName()) ||
                                    "oauth_token".equals(cookie.getName()))
                    .findFirst();
            if (tokenCookie.isPresent()) {
                logger.info("Token found in cookies: {}", tokenCookie.get().getName());
                return tokenCookie.get().getValue();
            }
        }
        logger.warn("No token found in cookies");
        return null;
    }

    private String extractPreferredUsernameFromToken(String token) {
        if (token == null) {
            return null;
        }
        try {
            // Simple JWT parsing without validation (just to extract the claim)
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                logger.error("Invalid JWT format: expected 3 parts, got {}", parts.length);
                return null;
            }
            
            // Decode the payload (second part)
            String payload = parts[1];
            // Add padding if needed
            int padding = 4 - (payload.length() % 4);
            if (padding != 4) {
                payload += "=".repeat(padding);
            }
            
            byte[] decodedBytes = java.util.Base64.getUrlDecoder().decode(payload);
            String decodedPayload = new String(decodedBytes);
            logger.info("JWT Payload: {}", decodedPayload);
            
            // Extract preferred_username using simple string parsing
            String searchStr = "\"preferred_username\":\"";
            int startIdx = decodedPayload.indexOf(searchStr);
            if (startIdx != -1) {
                startIdx += searchStr.length();
                int endIdx = decodedPayload.indexOf("\"", startIdx);
                if (endIdx != -1) {
                    String username = decodedPayload.substring(startIdx, endIdx);
                    logger.info("Username extracted from token payload: {}", username);
                    return username;
                }
            }
            logger.warn("Could not find preferred_username in JWT payload");
            return null;
        } catch (Exception e) {
            logger.error("Error parsing JWT token: {}", e.getMessage());
            return null;
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<VideoResponse> uploadVideo(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam("description") String description,
            @RequestParam(value = "isPublic", defaultValue = "false") Boolean isPublic,
            @RequestParam(value = "isLive", defaultValue = "false") Boolean isLive,
            Authentication authentication) throws IOException {
        
        VideoRequest request = new VideoRequest();
        request.setTitle(title);
        request.setDescription(description);
        request.setIsPublic(isPublic);
        request.setIsLive(isLive);

        VideoResponse response = videoService.uploadVideo(file, request, authentication.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/public")
    public ResponseEntity<List<VideoResponse>> getPublicVideos() {
        return ResponseEntity.ok(videoService.getAllPublicVideos());
    }

    @GetMapping("/my-videos")
    public ResponseEntity<List<VideoResponse>> getMyVideos(
            Authentication authentication,
            HttpServletRequest request) {
        
        logger.info("=== /my-videos endpoint called ===");
        logger.info("Authentication object: {}", authentication);
        
        // Try 1: Extract from Spring Security Authentication
        String username = extractUsernameFromAuthentication(authentication);
        
        // Try 2: Extract from Authorization header
        if (username == null) {
            logger.info("Attempting to extract token from Authorization header...");
            String token = getTokenFromAuthorizationHeader(request);
            username = extractPreferredUsernameFromToken(token);
        }
        
        // Try 3: Extract from cookies
        if (username == null) {
            logger.info("Attempting to extract token from cookies...");
            String token = getTokenFromCookies(request);
            username = extractPreferredUsernameFromToken(token);
        }

        if (username == null) {
            logger.warn("=== Authentication failed: no valid token or username found ===");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        logger.info("=== Successfully authenticated user: {} ===", username);
        return ResponseEntity.ok(videoService.getTeacherVideos(username));
    }

    @GetMapping("/{id}")
    public ResponseEntity<VideoResponse> getVideo(@PathVariable @NonNull Long id) {
        return ResponseEntity.ok(videoService.getVideoById(id));
    }

    @PostMapping("/{id}/access")
    public ResponseEntity<Void> trackAccess(@PathVariable @NonNull Long id, Authentication authentication) {
        if (authentication != null) {
            videoService.trackVideoAccess(id, authentication.getName());
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/stream/{id}")
    public ResponseEntity<Resource> streamVideo(@PathVariable @NonNull Long id) {
        try {
            StreamedFile streamedFile = videoService.resolveStreamFile(id);
            File file = Objects.requireNonNull(streamedFile.getFile(), "streamed file cannot be null");
            Resource resource = new FileSystemResource(file);
            String contentType = Objects.requireNonNull(streamedFile.getContentType(), "content type cannot be null");

            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .body(resource);
        } catch (RuntimeException e) {
            logger.error("Erro ao transmitir vídeo {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            logger.error("Erro inesperado ao transmitir vídeo {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/stream/live/{liveId}/recording")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> streamLiveRecording(@PathVariable String liveId, Authentication authentication) {
        logLiveAuth("recording", liveId, authentication);
        return videoService.getLiveRecording(liveId);
    }

    @GetMapping("/stream/live/{liveId}/status")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<java.util.Map<String, Object>> streamLiveStatus(@PathVariable String liveId, Authentication authentication) {
        logLiveAuth("status", liveId, authentication);
        return ResponseEntity.ok(videoService.getLiveStreamStatus(liveId));
    }
}
