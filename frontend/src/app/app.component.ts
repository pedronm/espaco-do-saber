import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <nav class="navbar" *ngIf="isAuthenticated">
        <div class="nav-brand">
          <h1>Espaço do Saber</h1>
        </div>
        <div class="nav-links">
          <a [routerLink]="getDashboardRoute()" routerLinkActive="active">Dashboard</a>
          <a *ngIf="isTeacher || isAdmin" [routerLink]="['/teacher']" routerLinkActive="active">My Videos</a>
          <a [routerLink]="['/videos']" routerLinkActive="active">Browse Videos</a>
          <button (click)="logout()" class="btn-logout">Logout</button>
        </div>
      </nav>
      <main class="main-content">
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
  `]
})
export class AppComponent {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  get isTeacher(): boolean {
    return this.authService.hasRole('TEACHER');
  }

  getDashboardRoute(): string {
    const user = this.authService.currentUserValue;
    if (!user) return '/login';
    
    switch (user.role) {
      case 'ADMIN':
        return '/admin';
      case 'TEACHER':
        return '/teacher';
      case 'STUDENT':
        return '/student';
      default:
        return '/';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
