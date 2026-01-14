package com.espacodosaber.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "video_access")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VideoAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id", nullable = false)
    private Video video;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false)
    private LocalDateTime accessTime = LocalDateTime.now();

    @Column(nullable = false)
    private Long watchedDuration = 0L; // in seconds

    @Column(nullable = false)
    private Boolean completed = false;
}
