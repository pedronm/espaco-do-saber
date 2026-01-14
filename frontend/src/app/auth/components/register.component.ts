import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { RegisterRequest } from '../../shared/models/user.model';

@Component({
  selector: 'app-register',
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Register - Espaço do Saber</h2>
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" [(ngModel)]="registerData.fullName" name="fullName" required>
          </div>
          <div class="form-group">
            <label>Username</label>
            <input type="text" [(ngModel)]="registerData.username" name="username" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="registerData.email" name="email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="registerData.password" name="password" required>
          </div>
          <div class="form-group">
            <label>Role</label>
            <select [(ngModel)]="registerData.role" name="role" required>
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
            </select>
          </div>
          <button type="submit" class="btn-primary">Register</button>
          <div class="error" *ngIf="error">{{ error }}</div>
        </form>
        <p class="login-link">
          Already have an account? <a [routerLink]="['/login']">Login here</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .register-card {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 400px;
    }
    h2 {
      text-align: center;
      color: #333;
      margin-bottom: 1.5rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #555;
      font-weight: 500;
    }
    input, select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .btn-primary {
      width: 100%;
      padding: 0.75rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn-primary:hover {
      background: #1565c0;
    }
    .error {
      color: #f44336;
      margin-top: 1rem;
      text-align: center;
    }
    .login-link {
      text-align: center;
      margin-top: 1rem;
      color: #555;
    }
    .login-link a {
      color: #1976d2;
      text-decoration: none;
    }
  `]
})
export class RegisterComponent {
  registerData: RegisterRequest = {
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'STUDENT'
  };
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        const route = this.getDashboardRoute(response.role);
        this.router.navigate([route]);
      },
      error: (error) => {
        this.error = error.error.message || 'Registration failed';
      }
    });
  }

  getDashboardRoute(role: string): string {
    switch (role) {
      case 'ADMIN':
        return '/admin';
      case 'TEACHER':
        return '/teacher';
      case 'STUDENT':
        return '/student';
      default:
        return '/';
    }
  }
}
