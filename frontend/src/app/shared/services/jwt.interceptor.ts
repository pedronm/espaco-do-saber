import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const urlCandidates = [request.url, request.urlWithParams].filter(
      (u, i, arr) => u && arr.indexOf(u) === i
    );
    const publicEndpoints = ['/api/auth/register'];
    const isPublicEndpoint = urlCandidates.some((u) =>
      publicEndpoints.some((endpoint) => u.includes(endpoint))
    );
    if (isPublicEndpoint) {
      return next.handle(request);
    }

    if (!this.isOurApiRequest(urlCandidates)) {
      return next.handle(request);
    }

    return from(this.authService.getAccessTokenSilently()).pipe(
      catchError((error) => {
        console.error('[JwtInterceptor] Failed to resolve token', {
          method: request.method,
          url: request.url,
          message: error?.message || String(error)
        });
        const fallback = this.authService.getToken();
        return of(typeof fallback === 'string' ? fallback : '');
      }),
      switchMap((token) => {
        const resolvedToken = (token && token.length > 0 ? token : null) || this.authService.getToken() || '';
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
      })
    );
  }

  /**
   * Match API calls whether the URL is absolute (production) or same-origin `/api/...`,
   * and tolerate trailing slashes / missing port vs URL parsing.
   */
  private isOurApiRequest(urls: string[]): boolean {
    const apiBase = environment.apiUrl.replace(/\/$/, '');
    for (const raw of urls) {
      if (!raw) {
        continue;
      }
      if (raw.startsWith('/api')) {
        return true;
      }
      if (raw.startsWith(apiBase)) {
        return true;
      }
      try {
        const reqUrl = new URL(raw);
        const baseUrl = new URL(apiBase);
        if (reqUrl.origin !== baseUrl.origin) {
          continue;
        }
        const basePath = baseUrl.pathname.replace(/\/$/, '') || '/';
        const path = reqUrl.pathname;
        if (path === basePath || path.startsWith(`${basePath}/`)) {
          return true;
        }
      } catch {
        /* ignore malformed URLs */
      }
    }
    return false;
  }
}
