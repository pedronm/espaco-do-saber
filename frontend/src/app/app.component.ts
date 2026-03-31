import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from './shared/services/auth.service';
import { environment } from '../environments/environment';
import { LiveStreamPresenceService } from './shared/services/live-stream-presence.service';
import { Subscription, filter } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-root',
  template: `
    <div class="app-container">
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>Carregando...</p>
      </div>
      <nav class="navbar" *ngIf="isAuthenticated && !isInRecoveryMode">
        <div class="nav-brand">
          <img [src]="logoPath" [alt]="logoAlt" class="logo">
          <h1>Espaço do Saber</h1>
        </div>
        <div class="nav-links">
          <a [routerLink]="getDashboardRoute()" routerLinkActive="active">Quadro de aulas</a>
          <a *ngIf="isTeacher || isAdmin" [routerLink]="['/professor']" routerLinkActive="active">Minhas gravações</a>
          <a [routerLink]="['/videos']" routerLinkActive="active">Videos</a>
          <div class="user-card" *ngIf="loggedUserName">
            <span class="user-name">{{ loggedUserName }}</span>
            <span class="user-role">{{ loggedUserRole }}</span>
          </div>
          <button (click)="logout()" class="btn-logout">Sair</button>
        </div>
      </nav>
      <main class="main-content" [class.no-padding]="!isAuthenticated">
        <div class="live-toast" *ngIf="liveToastMessage">{{ liveToastMessage }}</div>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: #f5f5f5;
    }
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #1976d2;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading-overlay p {
      color: white;
      font-size: 1.1rem;
    }
    .navbar {
      background: #1976d2;
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .nav-brand .logo {
      height: 50px;
      width: auto;
    }
    .nav-brand h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    .nav-links {
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .user-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      padding: 0.4rem 0.75rem;
      border-radius: 8px;
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.28);
      min-width: 130px;
    }
    .user-name {
      font-size: 0.85rem;
      font-weight: 600;
      line-height: 1.1;
    }
    .user-role {
      font-size: 0.75rem;
      text-transform: capitalize;
      opacity: 0.9;
      line-height: 1.1;
      margin-top: 0.15rem;
    }
    .nav-links a {
      color: white;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: background 0.3s;
    }
    .nav-links a:hover, .nav-links a.active {
      background: rgba(255,255,255,0.2);
    }
    .btn-logout {
      background: #f44336;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn-logout:hover {
      background: #d32f2f;
    }
    .main-content {
      padding: 2rem;
    }
    .main-content.no-padding {
      padding: 0;
    }
    .live-toast {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
      border-radius: 6px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-weight: 600;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  logoPath = environment.appLogo;
  logoAlt = 'Espaço do Saber Logo';
  liveToastMessage: string = '';
  isLoading = false;
  isInRecoveryMode = false;  // Track if user is in password recovery flow

  private liveNotificationSubscription?: Subscription;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private liveStreamPresenceService: LiveStreamPresenceService
  ) {
    console.log('%c[AppComponent] Constructor invoked', 'color: #1976d2; font-weight: bold;');
    console.log('[AppComponent] Router initialized:', !!this.router);
    console.log('[AppComponent] AuthService initialized:', !!this.authService);
  }

  ngOnInit(): void {
    const initialPath = this.router.url.split('?')[0].split('#')[0];
    if (window.location.hash) {
      const hashPreview = window.location.hash.substring(0, 80);
      console.log('[AppComponent] Hash preview:', hashPreview + '...');
    }

    /**
     * CRITICAL: Check for error recovery links FIRST (before auth subscription fires)
     * If the recovery link is expired/invalid, show error page immediately
     */
    const hash = window.location.hash;
    
    // Detect Supabase error responses in recovery flow
    const hasAuthError = hash.includes('error=') && (
      hash.includes('error_code=') ||
      hash.includes('error_description=')
    );
    
    if (hasAuthError) {
      console.log('%c[AppComponent] ⚠️ EARLY ERROR DETECTION: Auth error in recovery link', 'color: #f44336; font-weight: bold;');
      
      // Parse error details for logging
      if (hash.includes('error_code=otp_expired') || hash.includes('otp_expired')) {
        console.log('  Error Type: Expired recovery link (OTP expired)');
      } else if (hash.includes('error_code=')) {
        const errorMatch = hash.match(/error_code=([^&]+)/);
        if (errorMatch) {
          console.log('  Error Type:', decodeURIComponent(errorMatch[1]));
        }
      }
      
      console.log('  Action: Redirecting to /link-invalido');
      this.isLoading = false;
      this.router.navigate(['/link-invalido']);
      return;  // Exit early - don't set up auth subscription
    }

    this.authSubscription = this.authService.currentUser.subscribe((user) => {
      
      if (user) {
        console.log('[AppComponent] User authenticated:', user.email);
        this.liveStreamPresenceService.startWatching();
        this.isLoading = false;
        return;
      }

      console.log('\n%c[AppComponent] NO USER AUTHENTICATED - REDIRECT CHECK STARTING:', 'color: #f44336; font-weight: bold;');
      this.liveStreamPresenceService.stopWatching();
      this.liveToastMessage = '';

      // Use window.location.pathname as more reliable source than router.url
      const currentPath = window.location.pathname;
      
      /**
       * PUBLIC ROUTES - Accessible without authentication
       * Must align with route-manager PUBLIC_ROUTES
       */
      const publicPaths = [
        '/login',            // Login page
        '/cadastro',         // Registration page
        '/recuperar-senha',  // Request password reset
        '/reset-senha',      // Password reset form (only needs hash token)
        '/link-invalido',    // Invalid/expired recovery link page
      ];
 
      // Only auto-redirect to login if not on a public path
      if (!publicPaths.includes(currentPath)) {
        console.log('%c[AppComponent] ➡️ REDIRECTING TO /login from path:', 'color: #f44336; font-weight: bold;', currentPath);
        console.log('  REASON: Path not in public routes array');
        this.isLoading = true;
        this.router.navigate(['/login']).then(success => {
          console.log('  Navigation result:', success ? 'SUCCESS' : 'FAILED');
        });
      } else {
        console.log('%c[AppComponent] ✓ STAYING on public path:', 'color: #4caf50; font-weight: bold;', currentPath);
        
        // Log which recovery route and what we're waiting for
        if (currentPath === '/reset-senha') {
          const hasHash = window.location.hash.includes('access_token') || 
                         window.location.hash.includes('error');
          console.log('  Status: Recovery route - waiting for Supabase to process hash token');
          console.log('  Has recovery token in hash:', hasHash);
        } else if (currentPath === '/link-invalido') {
          console.log('  Status: Error page - user will see invalid link message');
        }
        
        this.isLoading = false;
      }
    });

    console.log('[AppComponent] Setting up router navigation events...');
    this.routerSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      console.log('[AppComponent] Navigation event:', event.url);
      const currentPath = window.location.pathname;
      
      // Track if we're in recovery mode (password reset flow)
      this.isInRecoveryMode = currentPath === '/reset-senha' || currentPath === '/link-invalido';
      
      /**
       * Guest-only routes - if user is authenticated, redirect to dashboard
       * These are login/registration/password recovery pages
       */
      const guestOnlyPaths = ['/login', '/cadastro', '/recuperar-senha'];
      
      if (guestOnlyPaths.includes(currentPath) && this.authService.isAuthenticated()) {
        console.log('[AppComponent] Redirecting authenticated user from guest-only page:', currentPath);
        console.log('  Destination:', this.getDashboardRoute());
        this.router.navigate([this.getDashboardRoute()]);
        return;
      }

      // Check for any stored auth errors from route processing
      const storedError = sessionStorage.getItem('authError');
      if (storedError && currentPath !== '/link-invalido') {
        console.log('[AppComponent] Stored auth error detected:', storedError);
        this.router.navigate(['/link-invalido']);
      }
    });

    console.log('[AppComponent] Setting up live stream notifications...');
    this.liveNotificationSubscription = this.liveStreamPresenceService.onNewStream().subscribe((streamId) => {
      this.liveToastMessage = `Nova transmissão ao vivo iniciada: ${streamId}`;
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      this.toastTimeout = setTimeout(() => {
        this.liveToastMessage = '';
      }, 6000);
    });
    
    console.log('%c[AppComponent] ngOnInit completed successfully!', 'color: #4caf50; font-weight: bold;');
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.liveNotificationSubscription?.unsubscribe();
    this.liveStreamPresenceService.stopWatching();
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get isAdmin(): boolean {
    return this.authService.hasRole('administrador');
  }

  get isTeacher(): boolean {
    return this.authService.hasRole('professor');
  }

  getDashboardRoute(): string {
    const user = this.authService.currentUserValue;
    if (!user) return '/login';
    let route = '/login';
    user.roles?.forEach( role => {
      switch (role) {
        case 'administrador':
          route ='/administrador';
          break;
        case 'professor':
          route ='/professor';
          break;
        case 'aluno':
        case 'medium':
          route ='/aluno';
          break;
      }
    });
    return route;
  }

  get loggedUserName(): string {
    return this.authService.currentUserValue?.username || this.authService.currentUserValue?.email || '';
  }

  get loggedUserRole(): string {
    const primaryRole = this.authService.currentUserValue?.roles?.[0] || '';
    return primaryRole || 'sem perfil';
  }

  /**
   * Handle auth handlers from Supabase via query parameters (passed through route-manager)
   * These come from /auth-callback which converts them to query params
   * Benefits: Server-side loggable, route-manager can intercept, no hash fragment issues
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
