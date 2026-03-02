import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthResponse, LoginRequest, RegisterRequest, RegisterResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject: BehaviorSubject<AuthResponse | null>;
  public currentUser: Observable<AuthResponse | null>;

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<AuthResponse | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(user => this.setCurrentUser(user))
      );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, request);
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.currentUserValue?.refresh_token;
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {
      refresh_token: refreshToken
    }).pipe(
      tap(tokenResponse => {
        const merged: AuthResponse = {
          ...(this.currentUserValue || {}),
          ...tokenResponse
        };
        this.setCurrentUser(merged);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    const user = this.currentUserValue;
    return user ? (user as any).access_token || user.token : null;
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
    return this.http.post<{ obs_stream_key: string }>(`${environment.apiUrl}/teacher/stream-key/regenerate`, {}).pipe(
      tap(response => {
        const current = this.currentUserValue;
        if (!current || !response?.obs_stream_key) {
          return;
        }

        this.setCurrentUser({
          ...current,
          obs_stream_key: response.obs_stream_key
        });
      }),
      map(response => response.obs_stream_key)
    );
  }

  private setCurrentUser(user: AuthResponse): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }
}
