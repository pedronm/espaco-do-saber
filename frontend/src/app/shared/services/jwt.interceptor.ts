import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const publicEndpoints = ['/api/auth/register'];
    const isPublicEndpoint = publicEndpoints.some((endpoint) => request.url.includes(endpoint));
    if (isPublicEndpoint) {
      return next.handle(request);
    }

    const shouldAttachToken = request.url.startsWith(environment.apiUrl) || request.url.startsWith('/api');
    if (!shouldAttachToken) {
      return next.handle(request);
    }

    return from(this.authService.getAccessTokenSilently()).pipe(
      switchMap((token) => {
        const resolvedToken = token || this.authService.getToken() || '';
        if (!resolvedToken) {
          console.warn('[JwtInterceptor] Missing token for request', {
            method: request.method,
            url: request.url
          });
          return next.handle(request);
        }

        const authorizedRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${resolvedToken}`
          }
        });

        console.debug('[JwtInterceptor] Token attached', {
          method: request.method,
          url: request.url,
          tokenLength: resolvedToken.length
        });

        return next.handle(authorizedRequest);
      }),
      catchError((error) => {
        console.error('[JwtInterceptor] Failed to resolve token', {
          method: request.method,
          url: request.url,
          message: error?.message || String(error)
        });
        return next.handle(request);
      })
    );
  }
}
