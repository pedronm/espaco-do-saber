package com.espacodosaber.controller;

import com.espacodosaber.service.ObsStreamKeyService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/teacher/stream-key")
public class TeacherStreamKeyController {

    private final ObsStreamKeyService obsStreamKeyService;

    public TeacherStreamKeyController(ObsStreamKeyService obsStreamKeyService) {
        this.obsStreamKeyService = obsStreamKeyService;
    }

    @PostMapping("/regenerate")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Map<String, String>> regenerate(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "unauthorized"
            ));
        }

        String streamKey = obsStreamKeyService.generateForUsername(authentication.getName());
        return ResponseEntity.ok(Map.of(
                "obs_stream_key", streamKey
        ));
    }
}
