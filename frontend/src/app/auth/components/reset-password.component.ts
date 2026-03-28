import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-reset-password',
  template: `
    <div class="reset-container">
      <div class="reset-card">
        <h2>Definir Nova Senha</h2>
        
        <!-- DEBUG INFO - Always show -->
        <div class="debug-info">
          <small>Debug: {{ debugInfo }}</small>
        </div>
        
        <div *ngIf="isInitializing" class="initializing-info">
          <p>⏳ Verificando sua sessão de recuperação...</p>
        </div>

        <div *ngIf="isRecoveryMode && !isInitializing" class="recovery-info">
          <p>✓ Recuperação de Senha Detectada</p>
        </div>

        <form (ngSubmit)="onSubmit()" *ngIf="!success && isRecoveryMode && !isInitializing">
          <div class="form-group">
            <label for="password">Nova Senha</label>
            <input 
              id="password" 
              type="password" 
              name="password" 
              [(ngModel)]="password" 
              required
              minlength="6"
              placeholder="Mínimo 6 caracteres"
            >
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirmar Nova Senha</label>
            <input 
              id="confirmPassword" 
              type="password" 
              name="confirmPassword" 
              [(ngModel)]="confirmPassword" 
              required
              placeholder="Repita a senha"
            >
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading || !isValid()">
            {{ loading ? 'Salvando...' : 'Alterar Senha' }}
          </button>
        </form>

        <div *ngIf="!isRecoveryMode && !success && !isInitializing" class="no-recovery">
          <p>⚠️ Nenhuma sessão de recuperação ativa.</p>
          <p>Clique no link de recuperação enviado por email para continuar.</p>
          <button class="btn-secondary" routerLink="/recuperar-senha">Solicitar novo link</button>
        </div>

        <div *ngIf="success" class="success-box">
          <p>✓ Senha alterada com sucesso!</p>
          <button class="btn-primary" routerLink="/login">Ir para Login</button>
        </div>

        <p class="error" *ngIf="error">✗ {{ error }}</p>
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
      margin-bottom: 1.5rem;
    }
    .recovery-info {
      background: #c8e6c9;
      border: 1px solid #4caf50;
      color: #2e7d32;
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    .initializing-info {
      background: #e3f2fd;
      border: 1px solid #2196f3;
      color: #1565c0;
      padding: 0.75rem;
      border-radius: 4px;
      margin-bottom: 1.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    .no-recovery {
      background: #fff3e0;
      border: 1px solid #ff9800;
      color: #e65100;
      padding: 1rem;
      border-radius: 4px;
      text-align: center;
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
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #1976d2;
      box-shadow: 0 0 4px rgba(25, 118, 210, 0.3);
    }
    .btn-primary {
      width: 100%;
      padding: 0.75rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 1rem;
      font-size: 1rem;
      font-weight: 500;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
    }
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .btn-secondary {
      width: 100%;
      padding: 0.75rem;
      background: #f0f0f0;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }
    .btn-secondary:hover {
      background: #e0e0e0;
    }
    .error {
      color: #f44336;
      margin-top: 1rem;
      text-align: center;
      font-weight: 500;
    }
    .success-box {
      text-align: center;
      color: #2e7d32;
      padding: 1rem;
      background: #c8e6c9;
      border-radius: 4px;
    }
    .debug-info {
      background: #f0f0f0;
      border: 1px solid #999;
      color: #666;
      padding: 0.5rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 0.75rem;
      font-family: monospace;
      overflow-x: auto;
    }
  `]
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  password = '';
  confirmPassword = '';
  loading = false;
  success = false;
  error: string | null = null;
  isRecoveryMode = false;
  isInitializing = false; // Don't wait - recovery tokens don't need initialization
  debugInfo: string = ''; // For debugging

  private authEventSubscription: Subscription | null = null;

  constructor(private authService: AuthService, private router: Router) {
    this.persistLog('[ResetPassword::constructor] Component being constructed');
  }

  private persistLog(message: string): void {
    console.log(message);
    const logs = localStorage.getItem('resetPasswordDebugLogs') || '';
    const timestamp = new Date().toLocaleTimeString();
    const newLog = `${timestamp}: ${message}\n`;
    localStorage.setItem('resetPasswordDebugLogs', logs + newLog);
  }

  ngOnInit(): void {
    this.persistLog('[ResetPassword::ngOnInit] Component initialized');
    
    // Check for recovery token in URL hash SYNCHRONOUSLY
    // Supabase recovery flow: the token in the URL is automatically handled by Supabase internally
    // We just need to detect it and show the form
    const hash = window.location.hash;
    const hasRecoveryToken = hash.includes('access_token=') && hash.includes('type=recovery');
    
    this.persistLog(`[ResetPassword::ngOnInit] Recovery token detected: ${hasRecoveryToken}`);
    this.persistLog(`[ResetPassword::ngOnInit] URL hash: ${hash.substring(0, 100)}`);
    this.debugInfo = `Token: ${hasRecoveryToken ? 'YES' : 'NO'} | Hash length: ${hash.length}`;
    
    if (hasRecoveryToken) {
      this.persistLog('[ResetPassword::ngOnInit] ✓ Recovery mode ENABLED - showing password reset form');
      this.isRecoveryMode = true;
      this.error = null;
    } else {
      this.persistLog('[ResetPassword::ngOnInit] ✗ No recovery token in URL');
      this.error = 'Nenhum token de recuperação encontrado. Clique no link do email para continuar.';
    }
    
    // Listen for any auth state changes as backup
    this.authEventSubscription = this.authService.authEvent.subscribe((event) => {
      this.persistLog(`[ResetPassword::authEvent] Auth event: ${event}`);
      if (event === 'PASSWORD_RECOVERY') {
        this.isRecoveryMode = true;
      }
    });
    
    this.persistLog('[ResetPassword::ngOnInit] Component fully initialized, rendering should happen now');
  }

  ngOnDestroy(): void {
    if (this.authEventSubscription) {
      this.authEventSubscription.unsubscribe();
    }
  }

  isValid(): boolean {
    return this.password.length >= 6 && this.password === this.confirmPassword;
  }

  onSubmit(): void {
    if (!this.isValid()) {
      this.error = 'As senhas não coincidem ou são muito curtas.';
      return;
    }

    if (!this.isRecoveryMode) {
      this.error = 'Nenhuma sessão de recuperação ativa.';
      return;
    }

    this.loading = true;
    this.error = null;

    console.log('[ResetPassword] Submitting password reset...');
    this.authService.updatePassword(this.password).subscribe({
      next: ({ error }) => {
        this.loading = false;
        if (error) {
          console.error('[ResetPassword] Password update failed:', error);
          this.error = error.message || 'Erro ao atualizar senha. Tente novamente.';
          return;
        }

        console.log('[ResetPassword] Password updated successfully!');
        this.success = true;
        this.password = '';
        this.confirmPassword = '';

        // Clear stored tokens after successful reset
        sessionStorage.removeItem('supabase_access_token');
        sessionStorage.removeItem('supabase_refresh_token');
        sessionStorage.removeItem('authType');

        // Redirect to login after 2 seconds
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.loading = false;
        console.error('[ResetPassword] Password reset error:', err);
        this.error = err.message || 'Erro ao resetar senha. Tente novamente.';
      }
    });
  }
}
