package com.espacodosaber.dto;

import lombok.Data;

@Data
public class StreamFinalizedRequest {
    private String liveId;
    private String storageObject;
    private Long durationSeconds;
}
