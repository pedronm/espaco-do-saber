package com.espacodosaber.controller;

import com.espacodosaber.dto.UserManagementResponse;
import com.espacodosaber.dto.UserRoleUpdateRequest;
import com.espacodosaber.service.UserManagementService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AdminUserController {

    private final UserManagementService userManagementService;

    public AdminUserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping
    public ResponseEntity<Page<UserManagementResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(userManagementService.listUsers(pageable));
    }

    @GetMapping("/pending")
    public ResponseEntity<List<UserManagementResponse>> listPendingRegistrations() {
        return ResponseEntity.ok(userManagementService.listPendingRegistrations());
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<UserManagementResponse> approveRegistration(@PathVariable Long id) {
        return ResponseEntity.ok(userManagementService.approveRegistration(id));
    }

    @DeleteMapping("/{id}/reject")
    public ResponseEntity<Map<String, String>> rejectRegistration(@PathVariable Long id) {
        userManagementService.rejectRegistration(id);
        return ResponseEntity.ok(Map.of("message", "Cadastro rejeitado com sucesso"));
    }

    @PutMapping("/{id}/role")
    public ResponseEntity<UserManagementResponse> updateUserRole(
            @PathVariable Long id,
            @RequestBody UserRoleUpdateRequest request
    ) {
        return ResponseEntity.ok(userManagementService.updateUserRoleAsAdmin(id, request.getRole()));
    }

    @PostMapping("/{id}/password/expire")
    public ResponseEntity<UserManagementResponse> expireUserPassword(@PathVariable Long id) {
        return ResponseEntity.ok(userManagementService.expireUserPassword(id));
    }
}
