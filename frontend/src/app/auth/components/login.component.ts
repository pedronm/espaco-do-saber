import { Component } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';
import { Router } from '@angular/router';
import { LoginRequest } from '../../shared/models/user.model';
import { HealthcheckService, ServiceHealth } from '../../shared/services/healthcheck.service';
import { FormMessage } from '../../shared/constants/form-messages';

@Component({
  standalone: false,
  selector: 'app-login',
  template: `
    <div class="login-container">
      <div class="login-card">
        <h2>Entrar - Espaço do Saber</h2>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">E-mail</label>
            <input id="email" type="email" name="email" [(ngModel)]="credentials.email" required>
          </div>

          <div class="form-group">
            <label for="password">Senha</label>
            <input id="password" type="password" name="password" [(ngModel)]="credentials.password" required>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        <div class="forgot-password">
          <a routerLink="/recuperar-senha">Esqueceu sua senha?</a>
        </div>

        <p class="error" *ngIf="error">{{ error }}</p>

        <!-- <div class="health-box" *ngIf="healthStatus.length > 0">
          <p class="health-title">Status dos workers</p>
          <p class="health-item" *ngFor="let item of healthStatus" [class.offline]="!item.ok">
            {{ item.service }}: {{ item.ok ? 'disponivel' : 'indisponivel' }} ({{ item.status }})
          </p>
        </div> -->

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
    .forgot-password {
      text-align: center;
      margin-top: 1rem;
    }
    .forgot-password a {
      color: #1976d2;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .forgot-password a:hover {
      text-decoration: underline;
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
    .health-box {
      margin-top: 1rem;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 0.75rem;
      background: #fafafa;
      text-align: left;
    }
    .health-title {
      margin: 0 0 0.5rem;
      font-weight: 600;
      color: #333;
      font-size: 0.9rem;
    }
    .health-item {
      margin: 0.25rem 0;
      color: #2e7d32;
      font-size: 0.85rem;
    }
    .health-item.offline {
      color: #c62828;
    }
  `]
})
export class LoginComponent {
  credentials: LoginRequest = {
    email: '',
    password: ''
  };
  loading = false;
  error = '';
  healthStatus: ServiceHealth[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private healthcheckService: HealthcheckService
  ) {
    this.healthcheckService.checkWorkers().subscribe((status) => {
      this.healthStatus = status;
    });
  }

  onSubmit(): void {
    this.error = '';

    if (!this.credentials.email?.trim() || !this.credentials.password?.trim()) {
      this.error = FormMessage.LOGIN_FILL_REQUIRED;
      return;
    }

    this.loading = true;

    this.authService.login(this.credentials).subscribe({
      next: (session) => {
        this.loading = false;
        const targetRoute = this.resolveRouteFromRoles(session.roles || []);
        if (!targetRoute) {
          this.error = FormMessage.LOGIN_FAILED_CHECK_DATA;
          this.authService.logout();
          return;
        }

        this.router.navigate([targetRoute]);
      },
      error: (err) => {
        this.loading = false;
        this.error = this.extractLoginErrorMessage(err);
      }
    });
  }

  loginWithSignupHint(): void {
    this.router.navigate(['/cadastro']);
  }

  private resolveRouteFromRoles(roles: string[]): string | null {
    const normalizedRoles = roles.map((role) => role.toLowerCase());

    if (normalizedRoles.includes('administrador')) {
      return '/administrador';
    }

    if (normalizedRoles.includes('professor')) {
      return '/professor';
    }

    if (normalizedRoles.includes('aluno') || normalizedRoles.includes('medium')) {
      return '/aluno';
    }

    return null;
  }

  private extractLoginErrorMessage(error: any): string {
    const apiMessage = (error?.message || '').toString().toLowerCase();

    if (!apiMessage) {
      return FormMessage.LOGIN_FAILED;
    }

    if (apiMessage.includes('e-mail') || apiMessage.includes('senha') || apiMessage.includes('conexao') || apiMessage.includes('confirmado')) {
      return error.message;
    }

    return FormMessage.LOGIN_FAILED_CHECK_DATA;
  }
}
