package com.espacodosaber.controller;

import com.espacodosaber.dto.StreamFinalizedRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.service.VideoService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/internal/streams")
public class InternalStreamEventsController {

    private final VideoService videoService;

    @Value("${streaming.finalization.internal-token:internal-stream-finalize-token}")
    private String internalToken;

    public InternalStreamEventsController(VideoService videoService) {
        this.videoService = videoService;
    }

    @PostMapping("/finalized")
    public ResponseEntity<?> streamFinalized(
            @RequestBody StreamFinalizedRequest request,
            @RequestHeader(value = "X-Internal-Token", required = false) String providedToken
    ) {
        if (providedToken == null || !providedToken.equals(internalToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "unauthorized",
                    "message", "Invalid internal token"
            ));
        }

        VideoResponse saved = videoService.registerFinalizedLiveStream(request);
        return ResponseEntity.ok(saved);
    }
}
