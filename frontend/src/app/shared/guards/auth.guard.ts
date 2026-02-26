import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      const requiredRole = route.data['role'];
      const requiredRoles = route.data['roles'] as string[] | undefined;

      if (requiredRole && currentUser.roles?.indexOf(requiredRole) === -1) {
        this.router.navigate(['/']);
        return false;
      }

      if (requiredRoles && requiredRoles.length > 0) {
        const hasAnyRole = requiredRoles.some(role => currentUser.roles?.includes(role));
        if (!hasAnyRole) {
          this.router.navigate(['/']);
          return false;
        }
      }
      return true;
    }

    this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
