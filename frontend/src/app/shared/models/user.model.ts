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
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
}

export interface AuthResponse {
  token?: string;
  access_token?: string;
  type?: string;
  id?: number;
  username?: string;
  email?: string;
  roles?: [string];
}
