package com.espacodosaber.dto;

import com.espacodosaber.model.Role;
import lombok.Data;

@Data
public class UserRoleUpdateRequest {
    private Role role;
}
