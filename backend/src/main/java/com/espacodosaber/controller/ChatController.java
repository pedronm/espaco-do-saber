package com.espacodosaber.controller;

import com.espacodosaber.dto.ChatMessageRequest;
import com.espacodosaber.model.ChatMessage;
import com.espacodosaber.service.ChatService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
public class ChatController {

    @Autowired
    private ChatService chatService;

    @MessageMapping("/chat.send")
    @SendTo("/topic/messages")
    public ChatMessage sendMessage(ChatMessageRequest request, Authentication authentication) {
        return chatService.sendMessage(
                authentication.getName(),
                request.getReceiverId(),
                request.getMessage(),
                request.getVideoId()
        );
    }

    @GetMapping("/api/chat/conversation/{userId}")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> getConversation(
            @PathVariable Long userId,
            Authentication authentication) {
        return ResponseEntity.ok(chatService.getConversation(authentication.getName(), userId));
    }

    @GetMapping("/api/chat/unread")
    @ResponseBody
    public ResponseEntity<List<ChatMessage>> getUnreadMessages(Authentication authentication) {
        return ResponseEntity.ok(chatService.getUnreadMessages(authentication.getName()));
    }

    @PutMapping("/api/chat/{messageId}/read")
    @ResponseBody
    public ResponseEntity<Void> markAsRead(@PathVariable Long messageId) {
        chatService.markAsRead(messageId);
        return ResponseEntity.ok().build();
    }
}
