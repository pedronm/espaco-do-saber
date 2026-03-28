import { Component } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-not-found',
  template: `
    <div class="not-found-container">
      <div class="not-found-card">
        <h1>404</h1>
        <h2>Página Não Encontrada</h2>
        <p>A página que você está procurando não existe ou foi movida.</p>
        <button class="btn-primary" routerLink="/login">Voltar para o Início</button>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }
    .not-found-card {
      background: white;
      padding: 3rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 500px;
      text-align: center;
    }
    h1 {
      font-size: 6rem;
      margin: 0;
      color: #1976d2;
      line-height: 1;
    }
    h2 {
      color: #333;
      margin: 1rem 0;
    }
    p {
      color: #666;
      margin-bottom: 2rem;
    }
    .btn-primary {
      padding: 0.75rem 2rem;
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
  `]
})
export class NotFoundComponent {}
