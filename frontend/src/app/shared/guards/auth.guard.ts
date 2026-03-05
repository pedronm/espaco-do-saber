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
        if (!currentUser) {
          this.authService.loginWithRedirect();
          return false;
        }

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
      })
    );
  }
}
