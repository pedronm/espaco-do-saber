import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private adminApiUrl = `${environment.apiUrl}/admin/users`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(this.adminApiUrl);
  }

  getPendingUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${this.adminApiUrl}/pending`);
  }

  approveUser(userId: number): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${this.adminApiUrl}/${userId}/approve`, {});
  }

  rejectUser(userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.adminApiUrl}/${userId}/reject`);
  }

  updateUserRole(userId: number, role: 'TEACHER' | 'STUDENT'): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${this.adminApiUrl}/${userId}/role`, { role });
  }
}
