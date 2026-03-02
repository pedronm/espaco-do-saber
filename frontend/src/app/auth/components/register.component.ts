import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { RegisterRequest } from '../../shared/models/user.model';

@Component({
  standalone: false,
  selector: 'app-register',
  template: `
    <div class="register-container">
      <div class="register-card">
        <h2>Cadastro - Espaço do Saber</h2>
        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label>Nome completo</label>
            <input type="text" [(ngModel)]="registerData.fullName" name="fullName" required>
          </div>
          <div class="form-group">
            <label>Usuário</label>
            <input type="text" [(ngModel)]="registerData.username" name="username" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="registerData.email" name="email" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" [(ngModel)]="registerData.password" name="password" required>
          </div>
          <div class="form-group">
            <label>Tipo de cadastro</label>
            <select [(ngModel)]="registerData.accessType" name="accessType" required>
              <option value="PUBLICO">Público</option>
              <option value="ALUNO">Aluno</option>
            </select>
          </div>
          <button type="submit" class="btn-primary">Enviar cadastro</button>
          <div class="success" *ngIf="successMessage">{{ successMessage }}</div>
          <div class="error" *ngIf="error">{{ error }}</div>
        </form>
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
    fullName: '',
    accessType: 'PUBLICO'
  };
  error: string = '';
  successMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    this.error = '';
    this.successMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        this.successMessage = response.message || 'Cadastro enviado com sucesso. Aguarde aprovação do administrador.';
        this.registerData = {
          username: '',
          email: '',
          password: '',
          fullName: '',
          accessType: 'PUBLICO'
        };
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (error) => {
        this.error = error.error.message || 'Falha no cadastro';
      }
    });
  }
}
