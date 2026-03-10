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
      <nav class="navbar" *ngIf="isAuthenticated">
        <div class="nav-brand">
          <img [src]="logoPath" [alt]="logoAlt" class="logo">
          <h1>Espaço do Saber</h1>
        </div>
        <div class="nav-links">
          <a [routerLink]="getDashboardRoute()" routerLinkActive="active">Quadro de aulas</a>
          <a *ngIf="isTeacher || isAdmin" [routerLink]="['/professor']" routerLinkActive="active">Minhas gravações</a>
          <a [routerLink]="['/videos']" routerLinkActive="active">Videos</a>
          <button (click)="logout()" class="btn-logout">Sair</button>
        </div>
      </nav>
      <main class="main-content">
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

  private liveNotificationSubscription?: Subscription;
  private authSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private toastTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private authService: AuthService,
    private router: Router,
    private liveStreamPresenceService: LiveStreamPresenceService
  ) {}

  ngOnInit(): void {
    this.authSubscription = this.authService.currentUser.subscribe((user) => {
      if (user) {
        this.liveStreamPresenceService.startWatching();
        return;
      }

      this.liveStreamPresenceService.stopWatching();
      this.liveToastMessage = '';

      const currentPath = this.router.url.split('?')[0];
      if (currentPath !== '/login' && currentPath !== '/register') {
        this.router.navigate(['/login']);
      }
    });

    this.routerSubscription = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      const currentPath = this.router.url.split('?')[0];
      if ((currentPath === '/login' || currentPath === '/register') && this.authService.isAuthenticated()) {
        this.router.navigate([this.getDashboardRoute()]);
      }
    });

    this.liveNotificationSubscription = this.liveStreamPresenceService.onNewStream().subscribe((streamId) => {
      this.liveToastMessage = `Nova transmissão ao vivo iniciada: ${streamId}`;
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      this.toastTimeout = setTimeout(() => {
        this.liveToastMessage = '';
      }, 6000);
    });
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
    console.log(`User Logged In: ${user.roles}`);
    let route = '/aluno';
    user.roles?.forEach( role => {
      switch (role) {
        case 'administrador':
          route ='/administrador';
          break;
        case 'professor':
          route ='/professor';
          break;
        case 'aluno':
        case 'visitante':
          route ='/aluno';
          break;
      }
    });
    return route;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
