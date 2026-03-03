package com.espacodosaber.service;

import com.espacodosaber.dto.PresignedUrlResponse;
import com.espacodosaber.dto.StreamFinalizedRequest;
import com.espacodosaber.dto.VideoProcessingResponse;
import com.espacodosaber.dto.VideoRequest;
import com.espacodosaber.dto.VideoResponse;
import com.espacodosaber.model.Role;
import com.espacodosaber.model.User;
import com.espacodosaber.model.Video;
import com.espacodosaber.model.VideoAccess;
import com.espacodosaber.repository.UserRepository;
import com.espacodosaber.repository.VideoAccessRepository;
import com.espacodosaber.repository.VideoRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class VideoService {

    private static final Logger logger = LoggerFactory.getLogger(VideoService.class);
    private static final DateTimeFormatter LIVE_TITLE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Autowired
    private VideoRepository videoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private VideoAccessRepository videoAccessRepository;

    @Value("${video-processing.base-uri:http://localhost:8000/videos}")
    private String videoProcessingUrl;

    @Value("${video-streaming.base-uri:http://localhost:8083}")
    private String videoStreamingUrl;

    @Value("${video.api-base-url:http://localhost:8080}")
    private String videoApiBaseUrl;

    @Value("${video.temp-cache-ttl-seconds:300}")
    private long tempCacheTtlSeconds;
 
    private RestTemplate pyRest = new RestTemplate();

    private final Map<Long, Path> tempVideoFiles = new ConcurrentHashMap<>();
    private final ScheduledExecutorService tempCleanupScheduler = Executors.newSingleThreadScheduledExecutor();

    public static class StreamedFile {
        private final File file;
        private final String contentType;

        public StreamedFile(File file, String contentType) {
            this.file = file;
            this.contentType = contentType;
        }

        public File getFile() {
            return file;
        }

        public String getContentType() {
            return contentType;
        }
    }

    private String getVideoUrl(Video video) {
        if (video.getFilePath() != null && video.getFilePath().startsWith("live:")) {
            return "/streaming/streams/" + extractLiveId(video.getFilePath()) + "/recording";
        }

        // For live streams, return the live stream endpoint from Go server
        if (video.getIsLive()) {
            return videoStreamingUrl + "/streams/" + extractStreamKey(video.getFilePath()) + "/live";
        }
        
        // For recorded videos, fetch presigned URL from MinIO via Python service
        String recordedUrl = getRecordedVideoUrl(video.getFilePath());
        if (recordedUrl == null) {
            System.err.println("Warning: Failed to get presigned URL for video: " + video.getFilePath() + 
                ", returning direct MinIO path");
            // Return a fallback direct MinIO URL as fallback
            return videoProcessingUrl + "/" + video.getFilePath();
        }
        return recordedUrl;
    }

    private String extractLiveId(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return "default";
        }
        if (filePath.startsWith("live:")) {
            return filePath.substring("live:".length());
        }
        return filePath;
    }

    private String extractStreamKey(String filePath) {
        // Extract stream key from file path if needed
        // For now, assume filePath contains the stream key or use a default
        if (filePath == null || filePath.isEmpty()) {
            return "default";
        }
        // Handle format like "uuid-filename.ext"
        return filePath.split("-")[0];
    }

    private String getRecordedVideoUrl(String videoInfo) {
        try {
            logger.debug("Fetching presigned URL from Python service for videoInfo: {}", videoInfo);
            String videoDetailsUrl = videoProcessingUrl + "/" + videoInfo;
            PresignedUrlResponse response = pyRest.getForObject(videoDetailsUrl, PresignedUrlResponse.class);
            
            if (response != null && response.url() != null) {
                logger.debug("Successfully fetched presigned URL: {}", response.url());
                return response.url();
            } else {
                logger.warn("Python service returned null or empty response for videoInfo: {}", videoInfo);
                return null;
            }
        } catch (Exception e) {
            logger.error("Failed to fetch presigned URL for video: {}, Error: {}", videoInfo, e.getMessage());
            return null;
        }
    }   

    public Optional<Path> getTempVideoPath(Long videoId) {
        return Optional.ofNullable(tempVideoFiles.get(videoId));
    }

    private void cacheTempVideoFile(Long videoId, Path tempFilePath) {
        Path previous = tempVideoFiles.put(videoId, tempFilePath);
        if (previous != null && !previous.equals(tempFilePath)) {
            try {
                Files.deleteIfExists(previous);
            } catch (IOException e) {
                logger.warn("Failed to delete previous temp file for video {}: {}", videoId, e.getMessage());
            }
        }

        tempCleanupScheduler.schedule(() -> {
            Path cached = tempVideoFiles.get(videoId);
            if (tempFilePath.equals(cached)) {
                tempVideoFiles.remove(videoId);
                try {
                    Files.deleteIfExists(tempFilePath);
                } catch (IOException e) {
                    logger.warn("Failed to delete temp file for video {}: {}", videoId, e.getMessage());
                }
            }
        }, tempCacheTtlSeconds, TimeUnit.SECONDS);
    }

    private String resolveFileExtension(String filePath, String contentType) {
        if (filePath != null) {
            int dotIndex = filePath.lastIndexOf('.');
            if (dotIndex > -1 && dotIndex < filePath.length() - 1) {
                return filePath.substring(dotIndex);
            }
        }
        if (contentType != null && contentType.startsWith("video/")) {
            String subtype = contentType.substring("video/".length());
            if (!subtype.isBlank()) {
                return "." + subtype;
            }
        }
        return ".mp4";
    }

    private String buildStreamUrl(Long id) {
        return videoApiBaseUrl + "/api/videos/stream/" + id;
    }
    
    public VideoResponse uploadVideo(MultipartFile file, VideoRequest request, String username) throws IOException {

        logger.info("Starting video upload for username: {}, title: {}", username, request.getTitle());

        User teacher = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Prepare multipart form data to send to Python service
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        });

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        logger.info("Sending video to Python service: {}", videoProcessingUrl + "/upload");
        // Send to Python video processing service
        VideoProcessingResponse response = pyRest.postForObject(videoProcessingUrl +"/upload", requestEntity, VideoProcessingResponse.class);
        
        logger.info("Python service responded with videoInfo: {}", response.videoInfo());
        
        // Create video entity
        Video video = new Video();
        video.setTitle(request.getTitle());
        video.setDescription(request.getDescription());
        video.setFilePath(response.videoInfo());
        video.setTeacher(teacher);
        video.setDuration(0L); // Could be calculated from video metadata
        video.setIsLive(request.getIsLive() != null ? request.getIsLive() : false);
        video.setIsPublic(request.getIsPublic() != null ? request.getIsPublic() : false);

        Video savedVideo = videoRepository.save(video);
        logger.info("Video saved with ID: {}, title: {}", savedVideo.getId(), savedVideo.getTitle());

        // Return complete response with streaming URL
        VideoResponse videoResponse = convertToResponse(savedVideo);
        videoResponse.setStreamingUrl(getVideoUrl(savedVideo));
        
        logger.info("Returning upload response with streamingUrl: {}", videoResponse.getStreamingUrl());
        return videoResponse;
    }

    public List<VideoResponse> getAllPublicVideos() {
        return videoRepository.findByIsPublicTrue().stream()
                .map(video -> {
                    VideoResponse response = convertToResponse(video);
                    response.setStreamingUrl(getVideoUrl(video));
                    return response;
                })
                .collect(Collectors.toList());
    }

    public List<VideoResponse> getTeacherVideos(String username) {
        User teacher = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        return videoRepository.findByTeacher(teacher).stream()
                .map(video -> {
                    VideoResponse response = convertToResponse(video);
                    response.setStreamingUrl(getVideoUrl(video));
                    return response;
                })
                .collect(Collectors.toList());
    }

    public VideoResponse getVideoById(Long id) {
        
        logger.info("[ Video Service] Fetching video by ID: {}", id);

        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Vídeo não encontrado"));

        VideoResponse response = convertToResponse(video);

        if (video.getFilePath() != null && video.getFilePath().startsWith("live:")) {
            response.setStreamingUrl(getVideoUrl(video));
            return response;
        }

        logger.info("[ Video Service ] Thats the url for streaming: {}", response.getStreamingUrl());
        logger.info("[ Video Service ] And what do we have in this object?: {}", response.toString());

        try {
            ResponseEntity<byte[]> pyResponse = pyRest.getForEntity(
                videoProcessingUrl + "/" + response.getStreamingUrl(), 
                byte[].class
            );

            logger.info("Resposta do serviço Python para vídeo {}: status={}, contentType={}, contentLength={}", 
                id, pyResponse.getStatusCode(), pyResponse.getHeaders().getContentType(), pyResponse.getHeaders().getContentLength());

            byte[] payload = pyResponse.getBody();
            if (payload != null && payload.length > 0) {
                String contentType = pyResponse.getHeaders().getContentType() != null
                        ? pyResponse.getHeaders().getContentType().toString()
                        : null;
                String extension = resolveFileExtension(video.getFilePath(), contentType);
                Path tempFile = Files.createTempFile("video-" + id + "-", extension);
                Files.write(tempFile, payload);
                tempFile.toFile().deleteOnExit();
                cacheTempVideoFile(id, tempFile);

                response.setStreamingUrl(buildStreamUrl(id));
                return response;
            }
        } catch (Exception e) {
            logger.warn("Falha ao baixar o vídeo {} do serviço Python: {}", id, e.getMessage());
        }

        response.setStreamingUrl(getVideoUrl(video));
        return response;
    }

    public VideoResponse registerCompletedLiveStream(String liveId, int finalSequence, String username) {
        if (liveId == null || liveId.isBlank()) {
            throw new RuntimeException("LiveId inválido para registrar gravação");
        }
        if (username == null || username.isBlank()) {
            throw new RuntimeException("Usuário não autenticado para registrar gravação ao vivo");
        }

        String storageKey = "live:" + liveId;
        Optional<Video> existingVideo = videoRepository.findByFilePath(storageKey);
        if (existingVideo.isPresent()) {
            VideoResponse existingResponse = convertToResponse(existingVideo.get());
            existingResponse.setStreamingUrl(getVideoUrl(existingVideo.get()));
            return existingResponse;
        }

        User teacher = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Video recordedLive = new Video();
        String readableDate = LocalDateTime.now().format(LIVE_TITLE_FORMATTER);
        recordedLive.setTitle("Live gravada em " + readableDate);
        recordedLive.setDescription("Transmissão ao vivo encerrada e salva automaticamente.");
        recordedLive.setFilePath(storageKey);
        recordedLive.setTeacher(teacher);
        recordedLive.setDuration(Math.max(0L, (long) finalSequence));
        recordedLive.setIsLive(false);
        recordedLive.setWasLive(true);
        recordedLive.setIsPublic(true);

        Video savedVideo = videoRepository.save(recordedLive);
        VideoResponse response = convertToResponse(savedVideo);
        response.setStreamingUrl(getVideoUrl(savedVideo));
        return response;
    }

    public VideoResponse registerFinalizedLiveStream(StreamFinalizedRequest request) {
        if (request == null || request.getLiveId() == null || request.getLiveId().isBlank()) {
            throw new RuntimeException("LiveId inválido para finalizar stream");
        }

        String storageKey = "live:" + request.getLiveId();
        Optional<Video> existingVideo = videoRepository.findByFilePath(storageKey);
        if (existingVideo.isPresent()) {
            VideoResponse existingResponse = convertToResponse(existingVideo.get());
            existingResponse.setStreamingUrl(getVideoUrl(existingVideo.get()));
            return existingResponse;
        }

        String guessedUsername = request.getLiveId().split("-")[0];
        User teacher = userRepository.findByUsername(guessedUsername)
                .or(() -> userRepository.findAll().stream()
                        .filter(user -> user.getRole() == Role.TEACHER || user.getRole() == Role.ADMIN)
                        .findFirst())
                .orElseThrow(() -> new RuntimeException("No teacher/admin user found to assign finalized stream"));

        Video recordedLive = new Video();
        String readableDate = LocalDateTime.now().format(LIVE_TITLE_FORMATTER);
        recordedLive.setTitle("Live gravada em " + readableDate);
        String storageRef = request.getStorageObject() == null ? "N/A" : request.getStorageObject();
        recordedLive.setDescription("Transmissão ao vivo encerrada e salva automaticamente. Objeto: " + storageRef);
        recordedLive.setFilePath(storageKey);
        recordedLive.setTeacher(teacher);
        recordedLive.setDuration(Math.max(0L, request.getDurationSeconds() == null ? 0L : request.getDurationSeconds()));
        recordedLive.setIsLive(false);
        recordedLive.setWasLive(true);
        recordedLive.setIsPublic(true);

        Video savedVideo = videoRepository.save(recordedLive);
        VideoResponse response = convertToResponse(savedVideo);
        response.setStreamingUrl(getVideoUrl(savedVideo));
        return response;
    }

    public List<String> getActiveStreamIds() {
        try {
            ResponseEntity<Map> response = pyRest.getForEntity(videoStreamingUrl + "/streams", Map.class);
            Map<?, ?> body = response.getBody();
            if (body == null) {
                return Collections.emptyList();
            }

            Object streams = body.get("streams");
            if (!(streams instanceof List<?> streamList)) {
                return Collections.emptyList();
            }

            return streamList.stream()
                    .map(String::valueOf)
                    .toList();
        } catch (Exception e) {
            logger.warn("Falha ao buscar streams ativas: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Map<String, Object> getLiveStreamStatus(String liveId) {
        Map<String, Object> response = new HashMap<>();
        String storageKey = "live:" + liveId;

        List<String> activeStreams = getActiveStreamIds();
        if (activeStreams.contains(liveId)) {
            response.put("status", "ACTIVE");
            return response;
        }

        Optional<Video> existingVideo = videoRepository.findByFilePath(storageKey);
        if (existingVideo.isPresent()) {
            response.put("status", "COMPLETED");
            response.put("videoId", existingVideo.get().getId());
            response.put("title", existingVideo.get().getTitle());
            return response;
        }

        response.put("status", "NOT_FOUND");
        return response;
    }

    public ResponseEntity<Resource> getLiveRecording(String liveId) {
        try {
            URL url = new URL(videoStreamingUrl + "/streams/" + liveId + "/recording");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(0);

            int statusCode = connection.getResponseCode();
            if (statusCode >= 300) {
                return ResponseEntity.notFound().build();
            }

            InputStream inputStream = connection.getInputStream();
            InputStreamResource resource = new InputStreamResource(inputStream);

            HttpHeaders headers = new HttpHeaders();
            String contentType = connection.getContentType();
            headers.setContentType(contentType != null
                    ? MediaType.parseMediaType(contentType)
                    : MediaType.parseMediaType("video/x-flv"));

            String contentDisposition = connection.getHeaderField(HttpHeaders.CONTENT_DISPOSITION);
            if (contentDisposition != null && !contentDisposition.isBlank()) {
                headers.set(HttpHeaders.CONTENT_DISPOSITION, contentDisposition);
            }

            String recordingFilename = connection.getHeaderField("X-Recording-Filename");
            if (recordingFilename != null && !recordingFilename.isBlank()) {
                headers.set("X-Recording-Filename", recordingFilename);
            }

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(resource);
        } catch (Exception e) {
            logger.warn("Falha ao recuperar gravação ao vivo {}: {}", liveId, e.getMessage());
            return ResponseEntity.notFound().build();
        }
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

    public StreamedFile resolveStreamFile(Long id) {
        Video video = videoRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Video não encontrado"));

        Optional<Path> tempPath = getTempVideoPath(id);
        File file = tempPath.map(Path::toFile).orElseGet(() -> new File(video.getFilePath()));
        if (!file.exists()) {
            throw new RuntimeException("Video file not found");
        }

        try {
            String contentType = Files.probeContentType(file.toPath());
            if (contentType == null) {
                contentType = "application/octet-stream";
            }
            return new StreamedFile(file, contentType);
        } catch (IOException e) {
            throw new RuntimeException("Failed to resolve video content type", e);
        }
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
        response.setWasLive(video.getWasLive());
        response.setIsPublic(video.getIsPublic());
        response.setUploadedAt(video.getUploadedAt());
        response.setStreamingUrl(video.getFilePath());
        return response;
    }
}
