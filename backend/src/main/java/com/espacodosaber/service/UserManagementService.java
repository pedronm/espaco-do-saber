package com.espacodosaber.service;

import com.espacodosaber.dto.UserManagementResponse;
import com.espacodosaber.model.Role;
import com.espacodosaber.model.User;
import com.espacodosaber.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
public class UserManagementService {

    private final UserRepository userRepository;

    public UserManagementService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<UserManagementResponse> listPendingRegistrations() {
        return userRepository.findByActive(false)
                .stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    public List<UserManagementResponse> listUsers() {
        return userRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    public List<UserManagementResponse> listStudents() {
        return userRepository.findByRole(Role.STUDENT)
                .stream()
                .sorted(Comparator.comparing(User::getCreatedAt).reversed())
                .map(this::toResponse)
                .toList();
    }

    public UserManagementResponse approveRegistration(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));
        user.setActive(true);
        return toResponse(userRepository.save(user));
    }

    public void rejectRegistration(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));
        userRepository.delete(user);
    }

    public UserManagementResponse updateUserRoleAsAdmin(Long userId, Role role) {
        if (role != Role.TEACHER && role != Role.STUDENT) {
            throw new RuntimeException("Administrador só pode definir papéis de ALUNO ou PROFESSOR");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));

        if (user.getRole() == Role.ADMIN) {
            throw new RuntimeException("Não é permitido alterar papel de administrador");
        }

        user.setRole(role);
        return toResponse(userRepository.save(user));
    }

    public UserManagementResponse updateStudentAsTeacher(Long userId, String fullName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Usuário não encontrado"));

        if (user.getRole() != Role.STUDENT) {
            throw new RuntimeException("Professor só pode editar alunos");
        }

        user.setFullName(fullName);
        return toResponse(userRepository.save(user));
    }

    private UserManagementResponse toResponse(User user) {
        UserManagementResponse response = new UserManagementResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setFullName(user.getFullName());
        response.setRole(user.getRole());
        response.setActive(user.getActive());
        return response;
    }
}
