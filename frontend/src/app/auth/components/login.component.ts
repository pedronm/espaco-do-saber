import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { ChangePasswordRequest, LoginRequest } from '../../shared/models/user.model';

@Component({
  standalone: false,
  selector: 'app-login',
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Login - Espaço do Saber</h2>
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Login</label>
            <input type="text" [(ngModel)]="credentials.username" name="username" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" [(ngModel)]="credentials.password" name="password" required>
          </div>
          <button type="submit" class="btn-primary">Login</button>
          <div class="error" *ngIf="error">{{ error }}</div>
        </form>

        <div class="password-change-box" *ngIf="requiresPasswordChange">
          <h3>Troca de senha obrigatória</h3>
          <p>Seu acesso requer atualização de senha antes de continuar.</p>
          <form (ngSubmit)="onChangePassword()">
            <div class="form-group">
              <label>Senha atual</label>
              <input type="password" [(ngModel)]="passwordChange.currentPassword" name="currentPassword" required>
            </div>
            <div class="form-group">
              <label>Nova senha</label>
              <input type="password" [(ngModel)]="passwordChange.newPassword" name="newPassword" required>
            </div>
            <div class="form-group">
              <label>Confirmar nova senha</label>
              <input type="password" [(ngModel)]="passwordChange.confirmNewPassword" name="confirmNewPassword" required>
            </div>
            <button type="submit" class="btn-primary">Alterar senha</button>
          </form>
        </div>
        <p class="register-link">
          Cadastre-se <a [routerLink]="['/register']">aqui</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .login-card {
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
    input {
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
    .register-link {
      text-align: center;
      margin-top: 1rem;
      color: #555;
    }
    .password-change-box {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid #ececec;
    }
    .password-change-box h3 {
      margin: 0 0 0.5rem;
      color: #333;
      font-size: 1rem;
    }
    .password-change-box p {
      margin: 0 0 1rem;
      color: #555;
      font-size: 0.9rem;
    }
    .register-link a {
      color: #1976d2;
      text-decoration: none;
    }
  `]
})
export class LoginComponent {
  credentials: LoginRequest = {
    username: '',
    password: ''
  };
  error: string = '';
  requiresPasswordChange: boolean = false;
  pendingRoles: string[] = [];
  passwordChange: ChangePasswordRequest = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  };

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.error = '';
    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        this.pendingRoles = response.roles ?? [];
        this.requiresPasswordChange = !!response.passwordChangeRequired;

        if (this.requiresPasswordChange) {
          return;
        }

        const route = this.getDashboardRoute(this.pendingRoles);
        this.router.navigate([route]);
      },
      error: (error) => {
        this.error = 'Invalid username or password';
      }
    });
  }

  onChangePassword(): void {
    this.error = '';

    if (this.passwordChange.newPassword !== this.passwordChange.confirmNewPassword) {
      this.error = 'A confirmação da nova senha não confere';
      return;
    }

    this.authService.changePassword(this.passwordChange).subscribe({
      next: () => {
        this.requiresPasswordChange = false;
        this.passwordChange = {
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        };

        const route = this.getDashboardRoute(this.pendingRoles);
        this.router.navigate([route]);
      },
      error: (error) => {
        this.error = error.error?.message || 'Não foi possível alterar a senha';
      }
    });
  }

  getDashboardRoute(roles: string[]): string {
    let route = '/'
    roles.forEach( role => {
      switch (role) {
        case 'ADMIN':
          route ='/admin';
          break;
        case 'TEACHER':
          route ='/teacher';
          break;
        case 'STUDENT':
          route = '/student';
          break;
        default:
          break;
      }
    })    
    return route
  }
}
