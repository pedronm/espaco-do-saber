package com.espacodosaber.repository;

import com.espacodosaber.model.Video;
import com.espacodosaber.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByTeacher(User teacher);
    List<Video> findByIsPublicTrue();
    List<Video> findByIsLiveTrue();
    Optional<Video> findByFilePath(String filePath);
}
