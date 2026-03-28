import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of, Subject } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, RegisterResponse } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { FormMessage } from '../constants/form-messages';

export type AuthEvent = 'PASSWORD_RECOVERY' | 'SIGNED_IN' | 'SIGNED_OUT' | 'USER_UPDATED' | 'TOKEN_REFRESHED' | 'MFA_CHALLENGE_VERIFIED' | null;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<AuthResponse | null>;
  public currentUser: Observable<AuthResponse | null>;
  
  private authEventSubject: BehaviorSubject<AuthEvent>;
  public authEvent: Observable<AuthEvent>;
  
  private supabase: SupabaseClient;

  constructor(private http: HttpClient, private router: Router) {
    this.supabase = createClient(environment.supabase.url, environment.supabase.publishableKey, {
      global: {
        headers: {
          apikey: environment.supabase.publishableKey
        }
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    this.currentUserSubject = new BehaviorSubject<AuthResponse | null>(null);
    this.currentUser = this.currentUserSubject.asObservable();
    
    this.authEventSubject = new BehaviorSubject<AuthEvent>(null);
    this.authEvent = this.authEventSubject.asObservable();

    // Listen for Supabase auth events
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthService] Auth event: ${event}`);
      
      // Emit auth event for components to listen
      if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') {
        this.authEventSubject.next(event as AuthEvent);
      }
      
      // Hydrate user session
      void this.hydrateSession(session?.user ?? null, session?.access_token);
    });

    this.supabase.auth.getSession().then(({ data }) => {
      void this.hydrateSession(data.session?.user ?? null, data.session?.access_token);
    });
  }

  public get currentUserValue(): AuthResponse | null {
    return this.currentUserSubject.value;
  }

  /**
   * Initialize auth from URL (processes recovery tokens, magic links, etc.)
   * Call this when your app loads or when navigating to auth-related routes
   */
  public async initializeFromUrl(): Promise<void> {
    console.log('[AuthService] Initializing auth from URL...');
    try {
      await this.supabase.auth.initialize();
      console.log('[AuthService] Auth initialization complete');
    } catch (error) {
      console.error('[AuthService] Auth initialization error:', error);
    }
  }

  /**
   * Get the current session
   */
  public async getSession(): Promise<any> {
    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      console.error('[AuthService] Error getting session:', error);
      return null;
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return from(this.supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password
    })).pipe(
      switchMap(async ({ data, error }) => {
        if (error || !data.session) {
          const message = this.toFriendlyAuthMessage(
            error,
            FormMessage.LOGIN_FAILED_FALLBACK
          );
          throw new Error(message);
        }

        const session = this.buildUserSession(data.session.user, data.session.access_token);
        if (!session) {
          await this.supabase.auth.signOut();
          this.setCurrentUser(null);
          throw new Error(FormMessage.LOGIN_FAILED_CHECK_DATA);
        }

        const isPendingApproval = await this.hasPendingApproval(session.access_token || '');
        if (isPendingApproval) {
          await this.supabase.auth.signOut();
          this.setCurrentUser(null);
          throw new Error(FormMessage.LOGIN_PENDING_APPROVAL);
        }

        this.setCurrentUser(session);
        return session;
      })
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return from(this.createAccountWithProfile(request)).pipe(
      map((result) => ({
        message: this.toFriendlyRegisterMessage(result?.message),
        pendingApproval: result?.pendingApproval ?? true
      } as RegisterResponse))
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

  requestPasswordReset(email: string): Observable<{ error: any }> {
    return from(this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha`,
    })).pipe(
      map(({ error }) => ({ error }))
    );
  }

  updatePassword(password: string): Observable<{ error: any }> {
    return from(this.supabase.auth.updateUser({ password })).pipe(
      map(({ error }) => ({ error }))
    );
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
    const user = this.currentUserValue;
    return !!user?.access_token && Array.isArray(user.roles) && user.roles.length > 0;
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
      this.router.navigate(['/cadastro']);
      return;
    }

    this.router.navigate(['/login']);
  }

  async getAccessTokenSilently(): Promise<string> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  private buildUserSession(user: any, accessToken?: string): AuthResponse | null {
    if (!user || !accessToken) {
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
    if (roles.length === 0) {
      return null;
    }

    return {
      access_token: accessToken,
      username: user?.nickname || user?.name || user?.email,
      email: user?.email,
      roles,
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
      visitante: 'medium',
      medium: 'medium',
      mediuns: 'medium'
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

  private async hydrateSession(user: any, accessToken?: string): Promise<void> {
    const session = this.buildUserSession(user, accessToken);
    if (!session) {
      this.setCurrentUser(null);
      return;
    }

    const isPendingApproval = await this.hasPendingApproval(session.access_token || '');
    if (isPendingApproval) {
      await this.supabase.auth.signOut();
      this.setCurrentUser(null);
      return;
    }

    this.setCurrentUser(session);
  }

  private async hasPendingApproval(accessToken: string): Promise<boolean> {
    if (!accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${environment.apiUrl}/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (response.status !== 403) {
        return false;
      }

      const payload = await response.json().catch(() => ({}));
      const code = String(payload?.code || '').toUpperCase();
      const message = String(payload?.message || '').toLowerCase();
      return code === 'PENDING_APPROVAL' || message.includes('pendente');
    } catch {
      return false;
    }
  }

  private async createAccountWithProfile(request: RegisterRequest): Promise<{ message?: string; pendingApproval: boolean }> {
    try {
      const { data, error } = await this.supabase.functions.invoke('private-data-register', {
        body: {
          email: request.email,
          senha: request.password,
          nome_completo: request.fullName,
          role: this.normalizeRegisterAccessType(request.accessType)
        }
      });

      if (error) {
        throw new Error(this.toFriendlyAuthMessage(error, FormMessage.REGISTER_FAILED));
      }

      return {
        message: this.toFriendlyRegisterMessage(data?.message),
        pendingApproval: data?.pendingApproval ?? true
      };
    } catch (error) {
      await this.supabase.auth.signOut();
      this.currentUserSubject.next(null);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(this.toFriendlyAuthMessage(error, FormMessage.REGISTER_FAILED));
    }
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

  private normalizeRegisterAccessType(accessType: RegisterRequest['accessType'] | string | undefined): 'aluno' | 'medium' {
    const normalized = String(accessType || '').trim().toLowerCase();
    if (normalized === 'medium') {
      return 'medium';
    }

    return 'aluno';
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

    if (raw.includes('pending_approval') || raw.includes('pendente de aprovacao') || raw.includes('pending approval')) {
      return FormMessage.LOGIN_PENDING_APPROVAL;
    }

    if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('fetch')) {
      return FormMessage.NETWORK_FAILED;
    }

    if (raw.includes('no api key found in request') || raw.includes('apikey')) {
      return FormMessage.REGISTER_CONNECTIVITY_RETRY;
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
