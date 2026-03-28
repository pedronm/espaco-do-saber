import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isFeatureAdminAdmissionOn } from '../constants/feature-flags';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ManagedUser {
  id: string | number;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  active: boolean;
  passwordExpiresAt?: string | null;
}

export interface PagedUsersResponse {
  content: ManagedUser[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private adminApiUrl = `${environment.apiUrl}/admin/users`;
  private supabase: SupabaseClient;

  constructor(private http: HttpClient) {
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
  }

  getAllUsers(page: number, size: number): Observable<PagedUsersResponse> {
    if (!isFeatureAdminAdmissionOn()) {
      return of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        size,
        number: page
      });
    }

    return this.http.get<PagedUsersResponse>(`${this.adminApiUrl}?page=${page}&size=${size}`);
  }

  getPendingUsers(): Observable<ManagedUser[]> {
    if (!isFeatureAdminAdmissionOn()) {
      return of([]);
    }

    return from(this.supabase.functions.invoke('retrieve-pending-user', {
      body: {}
    })).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }

        const list = Array.isArray(data) ? data : [];
        return list.map((item: any) => ({
          id: item?.id ?? item?.user_id ?? item?.userId,
          username: item?.username ?? item?.user_name ?? item?.email ?? '',
          email: item?.email ?? '',
          fullName: item?.fullName ?? item?.nome_completo ?? item?.name ?? item?.username ?? '',
          role: this.normalizeRole(item?.role ?? item?.user_role),
          active: item?.active ?? false,
          passwordExpiresAt: item?.passwordExpiresAt ?? item?.password_expires_at ?? null
        }));
      })
    );
  }

  private normalizeRole(role: unknown): ManagedUser['role'] {
    const normalized = String(role || 'STUDENT').toUpperCase();
    if (normalized === 'ADMIN' || normalized === 'ADMINISTRADOR') {
      return 'ADMIN';
    }

    if (normalized === 'TEACHER' || normalized === 'PROFESSOR') {
      return 'TEACHER';
    }

    return 'STUDENT';
  }

  approveUser(userId: string | number): Observable<ManagedUser> {
    if (!isFeatureAdminAdmissionOn()) {
      return of({
        id: userId,
        username: 'feature-disabled',
        email: 'feature-disabled@example.com',
        fullName: 'Feature disabled',
        role: 'STUDENT',
        active: false,
        passwordExpiresAt: null
      });
    }

    return this.http.post<ManagedUser>(`${this.adminApiUrl}/${userId}/approve`, {});
  }

  rejectUser(userId: string | number): Observable<{ message: string }> {
    if (!isFeatureAdminAdmissionOn()) {
      return of({ message: 'Feature disabled' });
    }

    return this.http.delete<{ message: string }>(`${this.adminApiUrl}/${userId}/reject`);
  }

  updateUserRole(userId: string | number, role: 'TEACHER' | 'STUDENT'): Observable<ManagedUser> {
    if (!isFeatureAdminAdmissionOn()) {
      return of({
        id: userId,
        username: 'feature-disabled',
        email: 'feature-disabled@example.com',
        fullName: 'Feature disabled',
        role,
        active: false,
        passwordExpiresAt: null
      });
    }

    return this.http.put<ManagedUser>(`${this.adminApiUrl}/${userId}/role`, { role });
  }

  expireUserPassword(userId: string | number): Observable<ManagedUser> {
    if (!isFeatureAdminAdmissionOn()) {
      return of({
        id: userId,
        username: 'feature-disabled',
        email: 'feature-disabled@example.com',
        fullName: 'Feature disabled',
        role: 'STUDENT',
        active: false,
        passwordExpiresAt: new Date().toISOString()
      });
    }

    return this.http.post<ManagedUser>(`${this.adminApiUrl}/${userId}/password/expire`, {});
  }
}
