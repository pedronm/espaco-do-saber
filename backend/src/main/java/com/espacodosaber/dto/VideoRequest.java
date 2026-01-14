package com.espacodosaber.dto;

import lombok.Data;

@Data
public class VideoRequest {
    private String title;
    private String description;
    private Boolean isPublic;
    private Boolean isLive;
}
