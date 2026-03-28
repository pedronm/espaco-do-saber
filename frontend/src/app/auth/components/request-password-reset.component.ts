import { Component } from '@angular/core';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  standalone: false,
  selector: 'app-request-password-reset',
  template: `
    <div class="reset-container">
      <div class="reset-card">
        <h2>Recuperar Senha</h2>
        
        <div *ngIf="!sent; else successMsg">
          <p class="instruction">Digite seu e-mail para receber um link de redefinição de senha.</p>
          
          <form (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">E-mail</label>
              <input 
                id="email" 
                type="email" 
                name="email" 
                [(ngModel)]="email" 
                required
                placeholder="seu@email.com"
              >
            </div>

            <button type="submit" class="btn-primary" [disabled]="loading">
              {{ loading ? 'Enviando...' : 'Enviar Link' }}
            </button>
          </form>

          <p class="error" *ngIf="error">{{ error }}</p>
          
          <div class="actions">
            <a routerLink="/login" class="link">Voltar para Login</a>
          </div>
        </div>

        <ng-template #successMsg>
          <div class="success-box">
            <p>Foi encaminhado um link para resetar sua senha para seu email!</p>
            <button class="btn-primary" routerLink="/login">Voltar para Login</button>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .reset-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .reset-card {
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
      margin-bottom: 1rem;
    }
    .instruction {
      color: #666;
      text-align: center;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
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
    .success-box {
      text-align: center;
    }
    .success-box p {
      color: #2e7d32;
      margin-bottom: 1.5rem;
      font-weight: 500;
    }
    .actions {
      margin-top: 1.5rem;
      text-align: center;
    }
    .link {
      color: #1976d2;
      text-decoration: none;
      font-size: 0.9rem;
    }
    .link:hover {
      text-decoration: underline;
    }
  `]
})
export class RequestPasswordResetComponent {
  email: string = '';
  loading: boolean = false;
  sent: boolean = false;
  error: string | null = null;

  constructor(private authService: AuthService) {}

  onSubmit(): void {
    if (!this.email) return;

    this.loading = true;
    this.error = null;

    this.authService.requestPasswordReset(this.email).subscribe({
      next: ({ error }) => {
        this.loading = false;
        if (error) {
          this.error = 'Ocorreu um erro ao enviar o e-mail. Verifique o endereço digitado.';
        } else {
          this.sent = true;
        }
      },
      error: () => {
        this.loading = false;
        this.error = 'Ocorreu um erro inesperado.';
      }
    });
  }
}
