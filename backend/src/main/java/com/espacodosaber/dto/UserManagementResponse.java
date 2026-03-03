package com.espacodosaber.dto;

import com.espacodosaber.model.Role;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserManagementResponse {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private Role role;
    private Boolean active;
    private LocalDateTime passwordExpiresAt;
}
