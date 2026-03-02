import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isRefreshRequest = request.url.includes('/api/auth/refresh');
    const isLoginRequest = request.url.includes('/api/auth/login');

    const token = this.authService.getToken();
    if (token) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (isLoginRequest || isRefreshRequest || error.status !== 401 || !this.authService.currentUserValue?.refresh_token) {
          return throwError(() => error);
        }

        return this.authService.refreshToken().pipe(
          switchMap(() => {
            const refreshedToken = this.authService.getToken();
            const retried = refreshedToken
              ? request.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } })
              : request;
            return next.handle(retried);
          }),
          catchError((refreshError) => {
            this.authService.logout();
            return throwError(() => refreshError);
          })
        );
      })
    );
  }
}
