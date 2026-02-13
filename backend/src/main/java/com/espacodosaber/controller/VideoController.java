package com.espacodosaber.controller;

import com.espacodosaber.dto.VideoRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.model.Video;
import com.espacodosaber.repository.VideoRepository;
import com.espacodosaber.security.KeycloakTokenProvider;
import com.espacodosaber.service.VideoService;
import com.fasterxml.jackson.databind.JsonNode;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Enumeration;
import java.util.List;

@RestController
@RequestMapping("/api/videos")
public class VideoController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private VideoRepository videoRepository;

    private String getTokenFromHeader(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ") ) {
            String token = authHeader.substring(7);
            try{ 
                JsonNode userInfo = new KeycloakTokenProvider().getUserInfoFromKeycloak(token);
                return userInfo.get("preferred_username").asText();
            } catch (Exception e ){
                return null;
            }
        }
        return null;
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
    public ResponseEntity<List<VideoResponse>> getMyVideos(@RequestHeader(value = "Authorization", required = false) String authHeader) {        
        String username = getTokenFromHeader(authHeader);

        if(username == null){
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(videoService.getTeacherVideos(username));
    }

    @GetMapping("/{id}")
    public ResponseEntity<VideoResponse> getVideo(@PathVariable Long id) {
        return ResponseEntity.ok(videoService.getVideoById(id));
    }

    @GetMapping("/stream/{id}")
    public ResponseEntity<Resource> streamVideo(@PathVariable Long id, Authentication authentication) {
        try {
            Video video = videoRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Video not found"));

            if (authentication != null) {
                videoService.trackVideoAccess(id, authentication.getName());
            }

            File file = new File(video.getFilePath());
            if (!file.exists()) {
                return ResponseEntity.notFound().build();
            }

            Resource resource = new FileSystemResource(file);
            String contentType = Files.probeContentType(file.toPath());
            if (contentType == null) {
                contentType = "application/octet-stream";
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.getName() + "\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
