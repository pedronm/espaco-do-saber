package com.espacodosaber.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class VideoResponse {
    private Long id;
    private String title;
    private String description;
    private String thumbnailPath;
    private Long teacherId;
    private String teacherName;
    private Long duration;
    private Boolean isLive;
    private Boolean isPublic;
    private LocalDateTime uploadedAt;
}
