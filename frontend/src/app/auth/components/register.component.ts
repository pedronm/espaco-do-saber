import { Component } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';
import { RegisterRequest } from '../../shared/models/user.model';
import { Router } from '@angular/router';

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
            <label for="username">Usuário</label>
            <input
              id="username"
              type="text"
              name="username"
              [(ngModel)]="registerData.username"
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
            <input
              id="password"
              type="password"
              name="password"
              [(ngModel)]="registerData.password"
              required
            >
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar senha</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              [(ngModel)]="registerData.confirmPassword"
              required
            >
          </div>

          <div class="form-group">
            <label for="accessType">Tipo de acesso</label>
            <select
              id="accessType"
              name="accessType"
              [(ngModel)]="registerData.accessType"
            >
              <option value="ALUNO">Aluno</option>
              <option value="PUBLICO">Público</option>
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
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    accessType: 'ALUNO'
  };

  loading = false;
  error = '';
  success = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.error = '';
    this.success = '';

    if (!this.registerData.username || !this.registerData.email || !this.registerData.password || !this.registerData.confirmPassword || !this.registerData.fullName) {
      this.error = 'Preencha todos os campos obrigatórios.';
      return;
    }

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.error = 'As senhas não conferem.';
      return;
    }

    this.loading = true;
    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        this.success = response.message || 'Cadastro realizado com sucesso.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 1000);
      },
      error: (error) => {
        this.error = error?.error?.message || 'Não foi possível concluir o cadastro.';
        this.loading = false;
      }
    });
  }
}
