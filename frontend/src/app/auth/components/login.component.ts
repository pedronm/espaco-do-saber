import { Component } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  standalone: false,
  selector: 'app-login',
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Entrar - Espaço do Saber</h2>
        <p class="register-link">Autenticação centralizada via Auth0.</p>
        <button type="button" class="btn-primary" (click)="onSubmit()">Entrar</button>
        <button type="button" class="btn-secondary" (click)="loginWithSignupHint()">Criar conta</button>
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
    .btn-secondary {
      margin-top: 0.75rem;
      width: 100%;
      padding: 0.75rem;
      background: white;
      color: #1976d2;
      border: 1px solid #1976d2;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
  `]
})
export class LoginComponent {
  constructor(private authService: AuthService) {}

  onSubmit(): void {
    this.authService.loginWithRedirect(false);
  }

  loginWithSignupHint(): void {
    this.authService.loginWithRedirect(true);
  }
}
