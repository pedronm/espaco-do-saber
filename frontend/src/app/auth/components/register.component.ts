import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { RegisterRequest } from '../../shared/models/user.model';
import { FormMessage } from '../../shared/constants/form-messages';

@Component({
  standalone: false,
  selector: 'app-register',
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Cadastro - Espaço do Saber</h2>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="fullName">Nome completo</label>
            <input
              id="fullName"
              type="text"
              name="fullName"
              [(ngModel)]="registerData.fullName"
              required
            >
          </div>

          <div class="form-group">
            <label for="email">E-mail</label>
            <input
              id="email"
              type="email"
              name="email"
              [(ngModel)]="registerData.email"
              required
            >
          </div>

          <div class="form-group">
            <label for="password">Senha</label>
            <div class="password-input-wrapper">
              <input
                id="password"
                [type]="showPassword ? 'text' : 'password'"
                name="password"
                [(ngModel)]="registerData.password"
                required
              >
              <button
                type="button"
                class="toggle-password"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                [attr.title]="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              >
                {{ showPassword ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar senha</label>
            <div class="password-input-wrapper">
              <input
                id="confirmPassword"
                [type]="showConfirmPassword ? 'text' : 'password'"
                name="confirmPassword"
                [(ngModel)]="registerData.confirmPassword"
                required
              >
              <button
                type="button"
                class="toggle-password"
                (click)="toggleConfirmPasswordVisibility()"
                [attr.aria-label]="showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'"
                [attr.title]="showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'"
              >
                {{ showConfirmPassword ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="accessType">Tipo de acesso</label>
            <select
              id="accessType"
              name="accessType"
              [(ngModel)]="registerData.accessType"
            >
              <option value="aluno">Aluno</option>
              <option value="medium">Medium</option>
            </select>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Cadastrando...' : 'Cadastrar' }}
          </button>
        </form>

        <p class="error" *ngIf="error">{{ error }}</p>
        <p class="success" *ngIf="success">{{ success }}</p>

        <p class="login-link">
          Já tem conta? <a [routerLink]="['/login']">Entrar</a>
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
    .password-input-wrapper {
      position: relative;
    }
    .password-input-wrapper input {
      padding-right: 5.5rem;
    }
    .toggle-password {
      position: absolute;
      top: 50%;
      right: 0.5rem;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: #1976d2;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      z-index: 10;
      font-weight: 600;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .toggle-password:hover {
      background: #eef5ff;
      color: #0d47a1;
    }
    .toggle-password:active {
      transform: translateY(-50%) scale(0.95);
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }
    .checkbox-group input[type='checkbox'] {
      width: auto;
      padding: 0;
    }
    .hint {
      display: block;
      margin-top: 0.35rem;
      color: #666;
      font-size: 0.82rem;
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
    .success {
      color: #2e7d32;
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
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    accessType: 'medium'
  };

  loading = false;
  error = '';
  success = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    this.success = '';

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.error = FormMessage.REGISTER_PASSWORD_MISMATCH;
      return;
    }

    if ((this.registerData.password || '').length < 8) {
      this.error = FormMessage.REGISTER_PASSWORD_MIN_LENGTH;
      return;
    }

    this.loading = true;
    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        this.success = response.message || FormMessage.REGISTER_SUCCESS_SENT;
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 1000);
      },
      error: (error) => {
        this.error = this.extractRegisterErrorMessage(error);
        this.loading = false;
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private extractRegisterErrorMessage(error: any): string {
    if (error?.status === 409) {
      return FormMessage.REGISTER_DUPLICATE;
    }

    const apiMessage =
      error?.error?.message ||
      error?.error?.error_description ||
      error?.message;

    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      const normalized = apiMessage.toLowerCase();

      if (normalized.includes('already') || normalized.includes('exists') || normalized.includes('duplicate')) {
        return FormMessage.REGISTER_DUPLICATE;
      }

      if (normalized.includes('password')) {
        return FormMessage.PASSWORD_INVALID_RULE;
      }

      if (normalized.includes('network') || normalized.includes('fetch')) {
        return FormMessage.REGISTER_CONNECTIVITY_RETRY;
      }

      if (normalized.includes('invalid')) {
        return FormMessage.REGISTER_INVALID_DATA;
      }

      return apiMessage;
    }

    if (error?.status === 0) {
      return FormMessage.REGISTER_CONNECTIVITY_FAILED;
    }

    return FormMessage.REGISTER_FAILED;
  }
}
