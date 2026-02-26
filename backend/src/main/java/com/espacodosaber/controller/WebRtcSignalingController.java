package com.espacodosaber.controller;

import com.espacodosaber.service.WebRtcSignalingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/videos/stream/live/webrtc")
public class WebRtcSignalingController {

    private static final Logger logger = LoggerFactory.getLogger(WebRtcSignalingController.class);

    private static final String LIVE_ID_KEY = "liveId";
    private static final String ANONYMOUS_USER = "anonymous";

    private final WebRtcSignalingService signalingService;

    public WebRtcSignalingController(WebRtcSignalingService signalingService) {
        this.signalingService = signalingService;
    }

    @PostMapping("/offer")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> postOffer(
            @RequestBody Map<String, Object> payload,
            Authentication authentication
    ) {
        String liveId = String.valueOf(payload.getOrDefault(LIVE_ID_KEY, "")).trim();
        String sdp = String.valueOf(payload.getOrDefault("sdp", "")).trim();
        String type = String.valueOf(payload.getOrDefault("type", "offer")).trim();

        if (liveId.isEmpty() || sdp.isEmpty()) {
            return ResponseEntity.badRequest().body(error("liveId and sdp are required"));
        }

        String username = authentication != null ? authentication.getName() : ANONYMOUS_USER;
        logger.info("[WEBRTC_SIGNAL] offer posted liveId={} user={} type={} sdpLength={}", liveId, username, type, sdp.length());
        return ResponseEntity.ok(signalingService.saveOffer(liveId, sdp, type, username));
    }

    @GetMapping("/{liveId}/offer")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getOffer(@PathVariable String liveId) {
        logger.debug("[WEBRTC_SIGNAL] offer requested liveId={}", liveId);
        return ResponseEntity.ok(signalingService.getOffer(liveId));
    }

    @PostMapping("/answer")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> postAnswer(
            @RequestBody Map<String, Object> payload,
            Authentication authentication
    ) {
        String liveId = String.valueOf(payload.getOrDefault(LIVE_ID_KEY, "")).trim();
        String sdp = String.valueOf(payload.getOrDefault("sdp", "")).trim();
        String type = String.valueOf(payload.getOrDefault("type", "answer")).trim();

        if (liveId.isEmpty() || sdp.isEmpty()) {
            return ResponseEntity.badRequest().body(error("liveId and sdp are required"));
        }

        String username = authentication != null ? authentication.getName() : ANONYMOUS_USER;
        logger.info("[WEBRTC_SIGNAL] answer posted liveId={} user={} type={} sdpLength={}", liveId, username, type, sdp.length());
        return ResponseEntity.ok(signalingService.saveAnswer(liveId, sdp, type, username));
    }

    @GetMapping("/{liveId}/answer")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getAnswer(@PathVariable String liveId) {
        logger.debug("[WEBRTC_SIGNAL] answer requested liveId={}", liveId);
        return ResponseEntity.ok(signalingService.getAnswer(liveId));
    }

    @PostMapping("/candidate")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> postCandidate(
            @RequestBody Map<String, Object> payload,
            Authentication authentication
    ) {
        String liveId = String.valueOf(payload.getOrDefault(LIVE_ID_KEY, "")).trim();
        String sourceRole = String.valueOf(payload.getOrDefault("sourceRole", "viewer")).trim();
        String candidate = String.valueOf(payload.getOrDefault("candidate", "")).trim();
        String sdpMid = payload.get("sdpMid") != null ? String.valueOf(payload.get("sdpMid")) : null;
        Integer sdpMLineIndex = null;
        Object sdpMLineIndexRaw = payload.get("sdpMLineIndex");
        if (sdpMLineIndexRaw instanceof Number numberValue) {
            sdpMLineIndex = numberValue.intValue();
        }

        if (liveId.isEmpty() || candidate.isEmpty()) {
            return ResponseEntity.badRequest().body(error("liveId and candidate are required"));
        }

        String username = authentication != null ? authentication.getName() : ANONYMOUS_USER;
        logger.debug("[WEBRTC_SIGNAL] candidate posted liveId={} user={} sourceRole={} candidateLength={}", liveId, username, sourceRole, candidate.length());
        return ResponseEntity.ok(signalingService.addCandidate(liveId, sourceRole, candidate, sdpMid, sdpMLineIndex, username));
    }

    @GetMapping("/{liveId}/candidates")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getCandidates(
            @PathVariable String liveId,
            @RequestParam(value = "targetRole", defaultValue = "viewer") String targetRole,
            @RequestParam(value = "sinceId", required = false) Long sinceId
    ) {
        logger.debug("[WEBRTC_SIGNAL] candidates requested liveId={} targetRole={} sinceId={}", liveId, targetRole, sinceId);
        return ResponseEntity.ok(signalingService.getCandidates(liveId, targetRole, sinceId));
    }

    @DeleteMapping("/{liveId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> resetSignaling(@PathVariable String liveId) {
        logger.info("[WEBRTC_SIGNAL] signaling reset liveId={}", liveId);
        signalingService.reset(liveId);
        Map<String, Object> response = new HashMap<>();
        response.put("cleared", true);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> response = new HashMap<>();
        response.put("error", message);
        return response;
    }
}
