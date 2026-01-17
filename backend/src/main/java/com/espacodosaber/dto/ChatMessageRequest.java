package com.espacodosaber.dto;

import lombok.Data;

@Data
public class ChatMessageRequest {
    private Long receiverId;
    private String message;
    private Long videoId;
}
