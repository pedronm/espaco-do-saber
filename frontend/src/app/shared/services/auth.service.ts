import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, RegisterResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { FormMessage } from '../constants/form-messages';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<AuthResponse | null>;
  public currentUser: Observable<AuthResponse | null>;
  private supabase: SupabaseClient;

  constructor(private http: HttpClient, private router: Router) {
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    this.currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
    this.currentUser = this.currentUserSubject.asObservable();

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUserSubject.next(this.buildUserSession(session?.user ?? null, session?.access_token));
    });

    this.supabase.auth.getSession().then(({ data }) => {
      this.currentUserSubject.next(this.buildUserSession(data.session?.user ?? null, data.session?.access_token));
    });
  }

  public get currentUserValue(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return from(this.supabase.functions.invoke('username-login', {
      body: {
        email: credentials.username,
        password: credentials.password
      }
    })).pipe(
      switchMap(({ data, error }) => {
        if (error || !data.session) {
          const message = this.toFriendlyAuthMessage(
            error,
            FormMessage.LOGIN_FAILED_FALLBACK
          );
          return throwError(() => new Error(message));
        }

        const session = this.buildUserSession(data.session.user, data.session.access_token);
        this.setCurrentUser(session);
        return this.currentUser.pipe(take(1), map((user) => user as AuthResponse));
      })
    );

    // const {error} = await this.supabase.auth.setSession({
    //   access_token: data.access_token, 
    //   refresh_token: data.refresh_token
    // })
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return from(this.supabase.functions.invoke('private-data-register', {
      body: {
        senha: request.password,
        nome_completo: request.fullName,
        email: request.email,
        username: request.username,
        role: request.accessType ?? 'visitante'
      }
    })).pipe(
      map(({ data, error }) => {
        if (error) {
          throw new Error(this.toFriendlyAuthMessage(error, FormMessage.REGISTER_FAILED));
        }

        return {
          message: this.toFriendlyRegisterMessage(data?.message),
          pendingApproval: data?.pendingApproval ?? true
        } as RegisterResponse;
      })
    );
  }

  refreshToken(): Observable<AuthResponse> {
    return from(this.supabase.auth.refreshSession()).pipe(
      map(({ data, error }) => {
        if (error || !data.session) {
          throw new Error(this.toFriendlyAuthMessage(error, FormMessage.SESSION_EXPIRED));
        }

        const merged: AuthResponse = {
          ...(this.currentUserValue || {}),
          ...this.buildUserSession(data.session.user, data.session.access_token)
        };

        this.setCurrentUser(merged);
        return merged;
      })
    );
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return of({ message: FormMessage.PASSWORD_CHANGE_MANAGED_BY_SUPABASE });
  }

  logout(): void {
    this.supabase.auth.signOut().finally(() => {
      this.currentUserSubject.next(null);
    });
  }

  getToken(): string | null {
    return this.currentUserValue?.access_token || null;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    const expected = role.toLowerCase();
    return user ? user?.roles?.some((r) => r.toLowerCase() === expected) === true : false;
  }

  getOrCreateObsStreamKey(): string | null {
    const user = this.currentUserValue;
    if (!user) {
      return null;
    }

    const canPublish = this.hasRole('administrador') || this.hasRole('professor');
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
    if (signUp) {
      this.router.navigate(['/register']);
      return;
    }

    this.router.navigate(['/login']);
  }

  async getAccessTokenSilently(): Promise<string> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  private buildUserSession(user: any, accessToken?: string): AuthResponse | null {
    if (!user) {
      return null;
    }

    const jwtPayload = this.decodeJwtPayload(accessToken);
    const claimPath = environment.supabase.rolesClaim || 'user_role';
    const roleSource = this.firstNonEmptyArray(
      this.extractRolesFromPath(jwtPayload, claimPath),
      this.extractRolesFromPath(user, 'app_metadata.user_role'),
      this.extractRolesFromPath(user, 'app_metadata.roles')
    );
    const roles = this.mapRoles(roleSource);
    const permissionsSource = this.firstNonEmptyArray(
      this.extractRolesFromPath(jwtPayload, 'user_permissions'),
      this.extractRolesFromPath(user, 'app_metadata.user_permissions')
    );
    const permissions = this.normalizeStringArray(permissionsSource);
    const normalizedRoles = roles.length > 0 ? roles : ['aluno'];

    return {
      access_token: accessToken,
      username: user?.nickname || user?.name || user?.email,
      email: user?.email,
      roles: normalizedRoles,
      permissions
    };
  }

  private extractRolesFromPath(user: any, claimPath: string): string[] {
    const value = claimPath.split('.').reduce<any>((acc, key) => {
      if (!acc || typeof acc !== 'object') {
        return undefined;
      }
      return acc[key];
    }, user);

    return this.normalizeStringArray(value);
  }

  private decodeJwtPayload(accessToken?: string): Record<string, unknown> {
    if (!accessToken || accessToken.split('.').length < 2) {
      return {};
    }

    try {
      const base64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const decoded = atob(padded);
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private mapRoles(raw: string[]): string[] {
    const roleMap: Record<string, string> = {
      administrador: 'administrador',
      professor: 'professor',
      aluno: 'aluno',
      visitante: 'visitante'
    };

    return raw
      .map((role) => roleMap[role.toLowerCase()] || role.toLowerCase())
      .filter((role, index, list) => list.indexOf(role) === index);
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
    }

    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }

    return [];
  }

  private firstNonEmptyArray(...sources: string[][]): string[] {
    return sources.find((source) => Array.isArray(source) && source.length > 0) || [];
  }

  private setCurrentUser(user: AuthResponse | null): void {
    this.currentUserSubject.next(user);
  }

  private toFriendlyRegisterMessage(rawMessage: unknown): string {
    if (typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
      return FormMessage.REGISTER_SUCCESS_PENDING;
    }

    const normalized = rawMessage.toLowerCase();
    if (normalized.includes('success') || normalized.includes('created')) {
      return FormMessage.REGISTER_SUCCESS_PENDING;
    }

    return rawMessage;
  }

  private toFriendlyAuthMessage(error: unknown, fallback: string): string {
    const status = this.extractErrorStatus(error);
    if (status === 409) {
      return FormMessage.REGISTER_DUPLICATE;
    }

    const raw = this.extractErrorMessage(error).toLowerCase();

    if (!raw) {
      return fallback;
    }

    if (raw.includes('invalid login credentials') || raw.includes('invalid credentials')) {
      return FormMessage.LOGIN_FAILED_CREDENTIALS;
    }

    if (raw.includes('email not confirmed')) {
      return FormMessage.EMAIL_NOT_CONFIRMED;
    }

    if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('fetch')) {
      return FormMessage.NETWORK_FAILED;
    }

    if (raw.includes('already registered') || raw.includes('already exists') || raw.includes('duplicate')) {
      return FormMessage.REGISTER_DUPLICATE;
    }

    if (raw.includes('password')) {
      return FormMessage.PASSWORD_INVALID_RULE;
    }

    return fallback;
  }

  private extractErrorStatus(error: unknown): number {
    if (!error) {
      return 0;
    }

    const candidate = error as {
      status?: number;
      context?: { status?: number };
      error?: { status?: number };
    };

    const status = candidate?.status || candidate?.context?.status || candidate?.error?.status || 0;
    return Number.isFinite(status) ? status : 0;
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return '';
    }

    const candidate = error as {
      message?: string;
      error_description?: string;
      error?: { message?: string; error_description?: string };
    };

    return (
      candidate?.error?.message ||
      candidate?.error?.error_description ||
      candidate?.message ||
      candidate?.error_description ||
      ''
    );
  }
}
