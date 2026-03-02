export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  accessType: 'PUBLICO' | 'ALUNO';
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
}
