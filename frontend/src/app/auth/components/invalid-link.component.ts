import { Component, OnInit } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-invalid-link',
  template: `
    <div class="invalid-container">
      <div class="invalid-card">
        <div class="icon">⚠️</div>
        <h2>Link Inválido ou Expirado</h2>
        <p>O link que você utilizou não é mais válido ou já expirou.</p>
        
        <div *ngIf="errorDescription" class="error-details">
          <p class="error-code" *ngIf="errorCode">Código: {{ errorCode }}</p>
          <p class="error-message">{{ errorDescription }}</p>
        </div>
        
        <p class="secondary" *ngIf="!errorDescription">Isso pode acontecer se você já usou o link ou se passou muito tempo desde a solicitação.</p>
        
        <div class="actions">
          <button class="btn-primary" routerLink="/recuperar-senha">Solicitar Novo Link</button>
          <button class="btn-secondary" routerLink="/login">Voltar para Login</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .invalid-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    .invalid-card {
      background: white;
      padding: 2.5rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 450px;
      text-align: center;
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h2 {
      color: #333;
      margin-bottom: 1rem;
    }
    p {
      color: #666;
      margin-bottom: 0.5rem;
    }
    .secondary {
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .error-details {
      background: #fff3e0;
      border-left: 4px solid #f57c00;
      padding: 1rem;
      margin: 1.5rem 0;
      border-radius: 4px;
      text-align: left;
    }
    .error-code {
      font-size: 0.85rem;
      color: #e65100;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .error-message {
      font-size: 0.9rem;
      color: #e65100;
      margin: 0;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 2rem;
    }
    .btn-primary {
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
    .btn-secondary {
      padding: 0.75rem;
      background: transparent;
      color: #1976d2;
      border: 1px solid #1976d2;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
  `]
})
export class InvalidLinkComponent implements OnInit {
  errorCode: string | null = null;
  errorDescription: string | null = null;

  ngOnInit(): void {
    // Retrieve error details from sessionStorage if available
    this.errorCode = sessionStorage.getItem('authErrorCode');
    this.errorDescription = sessionStorage.getItem('authErrorDescription');
    
    if (this.errorCode || this.errorDescription) {
      console.log(`[InvalidLink] Displaying error: ${this.errorCode} - ${this.errorDescription}`);
    }
  }
}
