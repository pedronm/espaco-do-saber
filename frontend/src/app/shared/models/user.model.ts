export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'administrador' | 'professor' | 'aluno' | 'medium';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  accessType: 'medium' | 'aluno';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface RegisterResponse {
  message: string;
  pendingApproval: boolean;
}

export interface AuthResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  obs_stream_key?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  type?: string;
  id?: number;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  passwordChangeRequired?: boolean;
}
