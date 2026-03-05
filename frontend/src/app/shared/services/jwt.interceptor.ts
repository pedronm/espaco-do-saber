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
        const authorizedRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });

        return next.handle(authorizedRequest);
      }),
      catchError(() => next.handle(request))
    );
  }
}
