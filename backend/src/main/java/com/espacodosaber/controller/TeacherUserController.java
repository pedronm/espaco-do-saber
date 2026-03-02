package com.espacodosaber.controller;

import com.espacodosaber.dto.UserManagementResponse;
import com.espacodosaber.service.UserManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teacher/users")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class TeacherUserController {

    private final UserManagementService userManagementService;

    public TeacherUserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping("/students")
    public ResponseEntity<List<UserManagementResponse>> listStudents() {
        return ResponseEntity.ok(userManagementService.listStudents());
    }

    @PutMapping("/students/{id}")
    public ResponseEntity<UserManagementResponse> updateStudent(
            @PathVariable Long id,
            @RequestBody Map<String, String> request
    ) {
        String fullName = request.get("fullName");
        return ResponseEntity.ok(userManagementService.updateStudentAsTeacher(id, fullName));
    }
}
