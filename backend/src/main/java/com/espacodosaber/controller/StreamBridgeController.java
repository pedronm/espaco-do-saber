package com.espacodosaber.controller;

import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.service.UdpStreamingBridgeService;
import com.espacodosaber.service.VideoService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/videos/stream")
public class StreamBridgeController {

    private final UdpStreamingBridgeService udpStreamingBridgeService;
    private final VideoService videoService;

    public StreamBridgeController(UdpStreamingBridgeService udpStreamingBridgeService, VideoService videoService) {
        this.udpStreamingBridgeService = udpStreamingBridgeService;
        this.videoService = videoService;
    }

    @GetMapping("/active")
    public ResponseEntity<Map<String, Object>> getActiveStreams() {
        Map<String, Object> response = new HashMap<>();
        response.put("streams", videoService.getActiveStreamIds());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/chunk")
    public ResponseEntity<Map<String, Object>> streamChunk(
            @RequestParam("chunk") MultipartFile chunk,
            @RequestParam("liveId") String liveId,
            @RequestParam("sequence") Integer sequence
    ) {
        try {
            byte[] chunkBytes = chunk.getBytes();
            udpStreamingBridgeService.sendChunk(liveId, sequence, chunkBytes);
            udpStreamingBridgeService.persistChunk(liveId, sequence, chunkBytes);

            Map<String, Object> response = new HashMap<>();
            response.put("id", 0L);
            response.put("liveId", liveId);
            response.put("message", "Chunk forwarded and persisted");
            response.put("status", "ACTIVE");
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", 0L);
            response.put("liveId", liveId);
            response.put("message", "Failed to forward chunk: " + e.getMessage());
            response.put("status", "FAILED");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
        }
    }

    @PostMapping("/final")
    public ResponseEntity<Map<String, Object>> streamFinalRecording(
            @RequestParam("file") MultipartFile file,
            @RequestParam("liveId") String liveId
    ) {
        try {
            udpStreamingBridgeService.persistFinalRecording(liveId, file.getBytes());

            Map<String, Object> response = new HashMap<>();
            response.put("id", 0L);
            response.put("liveId", liveId);
            response.put("message", "Final recording persisted");
            response.put("status", "ACTIVE");
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", 0L);
            response.put("liveId", liveId);
            response.put("message", "Failed to persist final recording: " + e.getMessage());
            response.put("status", "FAILED");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
        }
    }

    @PostMapping("/end")
    public ResponseEntity<Map<String, Object>> endStream(@RequestBody Map<String, Object> payload, Authentication authentication) {
        String liveId = String.valueOf(payload.getOrDefault("liveId", "default"));
        int sequence = ((Number) payload.getOrDefault("sequence", 0)).intValue();
        String username = authentication != null ? authentication.getName() : null;

        try {
            udpStreamingBridgeService.sendEndOfStream(liveId, sequence);
            udpStreamingBridgeService.persistEndOfStream(liveId, sequence);
            VideoResponse savedVideo = videoService.registerCompletedLiveStream(liveId, sequence, username);

            Map<String, Object> response = new HashMap<>();
            response.put("id", savedVideo.getId());
            response.put("liveId", liveId);
            response.put("message", "End-of-stream signal forwarded and stream saved");
            response.put("status", "COMPLETED");
            response.put("videoId", savedVideo.getId());
            return ResponseEntity.ok(response);
        } catch (IOException e) {
            Map<String, Object> response = new HashMap<>();
            response.put("id", 0L);
            response.put("liveId", liveId);
            response.put("message", "Failed to end stream: " + e.getMessage());
            response.put("status", "FAILED");
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(response);
        }
    }
}