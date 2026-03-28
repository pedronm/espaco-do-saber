console.log('%c[BOOTSTRAP] Angular bootstrapping starting...', 'color: #1976d2; font-weight: bold; font-size: 14px;');
console.log('[BOOTSTRAP] Environment:', window.location.href);
console.log('[BOOTSTRAP] Hash:', window.location.hash);

import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

console.log('[BOOTSTRAP] Modules imported');

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    preserveWhitespaces: false,
    ngZone: 'zone.js'
  })
  .then(() => {
    console.log('%c[BOOTSTRAP] Angular app bootstrapped successfully!', 'color: #4caf50; font-weight: bold;');
  })
  .catch(err => {
    console.error('%c[BOOTSTRAP] BOOTSTRAP ERROR:', 'color: red; font-weight: bold;', err);
    console.error('[BOOTSTRAP] Error message:', err.message);
    console.error('[BOOTSTRAP] Stack:', err.stack);
    
    // Display error to user
    const rootElement = document.querySelector('app-root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 2rem; font-family: Arial, sans-serif; background: #ffebee; color: #c62828; border: 1px solid #ef5350; border-radius: 4px;">
          <h2>Erro ao inicializar aplicação</h2>
          <p><strong>Mensagem:</strong> ${err.message}</p>
          <p><strong>URL:</strong> ${window.location.href}</p>
          <p>Abra o console (F12) para mais detalhes.</p>
        </div>
      `;
    }
  });
