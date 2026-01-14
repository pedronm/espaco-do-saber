package com.espacodosaber.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "videos")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private String filePath;

    @Column
    private String thumbnailPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(nullable = false)
    private Long duration; // in seconds

    @Column(nullable = false)
    private Boolean isLive = false;

    @Column(nullable = false)
    private Boolean isPublic = false;

    @Column(nullable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now();

    @Column
    private LocalDateTime scheduledAt;

    @OneToMany(mappedBy = "video", cascade = CascadeType.ALL)
    private Set<VideoAccess> videoAccesses = new HashSet<>();
}
