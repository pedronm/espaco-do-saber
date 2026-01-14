package com.espacodosaber.dto;

import com.espacodosaber.model.Role;
import lombok.Data;

@Data
public class RegisterRequest {
    private String username;
    private String email;
    private String password;
    private String fullName;
    private Role role;
}
