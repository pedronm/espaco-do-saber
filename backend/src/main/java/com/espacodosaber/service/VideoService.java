package com.espacodosaber.service;

import com.espacodosaber.dto.VideoRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.model.User;
import com.espacodosaber.model.Video;
import com.espacodosaber.model.VideoAccess;
import com.espacodosaber.repository.UserRepository;
import com.espacodosaber.repository.VideoAccessRepository;
import com.espacodosaber.repository.VideoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VideoService {

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private VideoAccessRepository videoAccessRepository;

    private static final String UPLOAD_DIR = "uploads/videos/";

    public VideoResponse uploadVideo(MultipartFile file, VideoRequest request, String username) throws IOException {
        User teacher = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Create upload directory if it doesn't exist
        File uploadDir = new File(UPLOAD_DIR);
        if (!uploadDir.exists()) {
            uploadDir.mkdirs();
        }

        // Generate unique filename
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String filename = UUID.randomUUID().toString() + extension;
        String filePath = UPLOAD_DIR + filename;

        // Save file
        Path path = Paths.get(filePath);
        Files.write(path, file.getBytes());

        // Create video entity
        Video video = new Video();
        video.setTitle(request.getTitle());
        video.setDescription(request.getDescription());
        video.setFilePath(filePath);
        video.setTeacher(teacher);
        video.setDuration(0L); // Could be calculated from video metadata
        video.setIsLive(request.getIsLive() != null ? request.getIsLive() : false);
        video.setIsPublic(request.getIsPublic() != null ? request.getIsPublic() : false);

        Video savedVideo = videoRepository.save(video);

        return convertToResponse(savedVideo);
    }

    public List<VideoResponse> getAllPublicVideos() {
        return videoRepository.findByIsPublicTrue().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public List<VideoResponse> getTeacherVideos(String username) {
        User teacher = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return videoRepository.findByTeacher(teacher).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    public VideoResponse getVideoById(Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video not found"));
        return convertToResponse(video);
    }

    public void trackVideoAccess(Long videoId, String username) {
        User student = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("Video not found"));

        VideoAccess access = videoAccessRepository.findByVideoAndStudent(video, student)
                .orElse(new VideoAccess());
        
        access.setVideo(video);
        access.setStudent(student);
        access.setAccessTime(LocalDateTime.now());
        
        videoAccessRepository.save(access);
    }

    private VideoResponse convertToResponse(Video video) {
        VideoResponse response = new VideoResponse();
        response.setId(video.getId());
        response.setTitle(video.getTitle());
        response.setDescription(video.getDescription());
        response.setThumbnailPath(video.getThumbnailPath());
        response.setTeacherId(video.getTeacher().getId());
        response.setTeacherName(video.getTeacher().getFullName());
        response.setDuration(video.getDuration());
        response.setIsLive(video.getIsLive());
        response.setIsPublic(video.getIsPublic());
        response.setUploadedAt(video.getUploadedAt());
        return response;
    }
}
