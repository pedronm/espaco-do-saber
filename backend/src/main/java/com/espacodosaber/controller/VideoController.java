package com.espacodosaber.controller;

import com.espacodosaber.dto.VideoRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.model.Video;
import com.espacodosaber.repository.VideoRepository;
import com.espacodosaber.service.VideoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;

@RestController
@RequestMapping("/api/videos")
public class VideoController {

    @Autowired
    private VideoService videoService;

    @Autowired
    private VideoRepository videoRepository;

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
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
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<List<VideoResponse>> getMyVideos(Authentication authentication) {
        return ResponseEntity.ok(videoService.getTeacherVideos(authentication.getName()));
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
