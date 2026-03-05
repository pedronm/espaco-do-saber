import { Injectable } from '@angular/core';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, RegisterResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<AuthResponse | null>;
  public currentUser: Observable<AuthResponse | null>;

  constructor(private auth0: Auth0Service, private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
    this.currentUser = this.currentUserSubject.asObservable();

    this.auth0.isAuthenticated$
      .pipe(
        switchMap((authenticated) => {
          if (!authenticated) {
            return of(null);
          }

          return this.auth0.user$.pipe(
            switchMap((user) => this.auth0.idTokenClaims$.pipe(map((claims) => this.buildUserSession(user, claims || undefined))))
          );
        })
      )
      .subscribe((session) => {
        this.currentUserSubject.next(session);
      });
  }

  public get currentUserValue(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return from(this.auth0.loginWithRedirect()).pipe(
      switchMap(() => this.currentUser)
    ) as Observable<AuthResponse>;
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, request);
  }

  refreshToken(): Observable<AuthResponse> {
    return from(this.auth0.getAccessTokenSilently()).pipe(
      map((token) => ({
        ...(this.currentUserValue || {}),
        access_token: token
      }))
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return of({ message: 'Fluxo de troca de senha é gerenciado pelo Auth0.' });
  }

  logout(): void {
    this.auth0.logout({ logoutParams: { returnTo: window.location.origin } });
  }

  getToken(): string | null {
    return this.currentUserValue?.access_token || null;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    return user ? user?.roles?.find(r => r === role) !== undefined : false;
  }

  getOrCreateObsStreamKey(): string | null {
    const user = this.currentUserValue;
    if (!user) {
      return null;
    }

    const canPublish = this.hasRole('ADMIN') || this.hasRole('TEACHER');
    if (!canPublish) {
      return null;
    }

    if (user.obs_stream_key && user.obs_stream_key.trim().length > 0) {
      return user.obs_stream_key;
    }

    const username = (user.username || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
    const suffix = Math.random().toString(36).substring(2, 10);
    const generated = `${username || 'user'}-${suffix}`;
    this.setCurrentUser({
      ...user,
      obs_stream_key: generated
    });
    return generated;
  }

  regenerateObsStreamKey(): Observable<string> {
    return of(this.getOrCreateObsStreamKey() || 'stream-key').pipe(
      tap((obsStreamKey) => {
        const current = this.currentUserValue;
        if (!current) {
          return;
        }

        this.setCurrentUser({
          ...current,
          obs_stream_key: obsStreamKey
        });
      })
    );
  }

  loginWithRedirect(signUp = false): void {
    this.auth0.loginWithRedirect({
      authorizationParams: signUp ? { screen_hint: 'signup' } : undefined
    });
  }

  async getAccessTokenSilently(): Promise<string> {
    return firstValueFrom(this.auth0.getAccessTokenSilently());
  }

  private buildUserSession(user: User | null | undefined, claims?: Record<string, unknown>): AuthResponse {
    const rolesClaimKey = environment.auth0.rolesClaim;
    const roles = Array.isArray(claims?.[rolesClaimKey])
      ? (claims?.[rolesClaimKey] as string[])
      : [];

    return {
      access_token: undefined,
      username: user?.nickname || user?.name || user?.email,
      email: user?.email,
      roles
    };
  }

  private setCurrentUser(user: AuthResponse): void {
    this.currentUserSubject.next(user);
  }
}
