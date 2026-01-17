package com.espacodosaber.repository;

import com.espacodosaber.model.ChatMessage;
import com.espacodosaber.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findBySenderOrReceiverOrderBySentAtDesc(User sender, User receiver);
    List<ChatMessage> findByReceiverAndIsReadFalse(User receiver);
}
