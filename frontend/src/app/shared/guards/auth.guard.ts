import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.authService.currentUser.pipe(
      map((currentUser) => {
        const isAuthenticated = this.authService.isAuthenticated();
        const normalizedRoles = (currentUser?.roles || []).map((role) => role.toLowerCase());
        const guestOnly = route.data['guestOnly'] === true;

        if (guestOnly) {
          if (!isAuthenticated) {
            return true;
          }

          this.router.navigate([this.getDashboardRoute(normalizedRoles)]);
          return false;
        }

        if (!isAuthenticated) {
          this.authService.loginWithRedirect();
          return false;
        }

        const requiredRole = route.data['role'];
        const requiredRoles = route.data['roles'] as string[] | undefined;

        if (requiredRole && !normalizedRoles.includes(String(requiredRole).toLowerCase())) {
          this.router.navigate(['/']);
          return false;
        }

        if (requiredRoles && requiredRoles.length > 0) {
          const hasAnyRole = requiredRoles.some((role) => normalizedRoles.includes(String(role).toLowerCase()));
          if (!hasAnyRole) {
            this.router.navigate(['/']);
            return false;
          }
        }

        return true;
      })
    );
  }

  private getDashboardRoute(roles: string[]): string {
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

    return '/login';
  }
}
