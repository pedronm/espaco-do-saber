package com.espacodosaber.service;

import com.espacodosaber.model.ChatMessage;
import com.espacodosaber.model.User;
import com.espacodosaber.repository.ChatMessageRepository;
import com.espacodosaber.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChatService {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private UserRepository userRepository;

    public ChatMessage sendMessage(String senderUsername, Long receiverId, String message, Long videoId) {
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        
        User receiver = null;
        if (receiverId != null) {
            receiver = userRepository.findById(receiverId)
                    .orElseThrow(() -> new RuntimeException("Receiver not found"));
        }

        ChatMessage chatMessage = new ChatMessage();
        chatMessage.setSender(sender);
        chatMessage.setReceiver(receiver);
        chatMessage.setMessage(message);
        chatMessage.setVideoId(videoId);

        return chatMessageRepository.save(chatMessage);
    }

    public List<ChatMessage> getConversation(String username, Long otherUserId) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        User otherUser = userRepository.findById(otherUserId)
                .orElseThrow(() -> new RuntimeException("Other user not found"));

        return chatMessageRepository.findBySenderOrReceiverOrderBySentAtDesc(user, otherUser);
    }

    public List<ChatMessage> getUnreadMessages(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return chatMessageRepository.findByReceiverAndIsReadFalse(user);
    }

    public void markAsRead(Long messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));
        
        message.setIsRead(true);
        chatMessageRepository.save(message);
    }
}
