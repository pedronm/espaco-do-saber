package com.espacodosaber.repository;

import com.espacodosaber.model.VideoAccess;
import com.espacodosaber.model.Video;
import com.espacodosaber.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoAccessRepository extends JpaRepository<VideoAccess, Long> {
    List<VideoAccess> findByStudent(User student);
    List<VideoAccess> findByVideo(Video video);
    Optional<VideoAccess> findByVideoAndStudent(Video video, User student);
}
