import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Video } from '../models/video.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = `${environment.apiUrl}/videos`;

  constructor(private http: HttpClient) {}

  uploadVideo(file: File, title: string, description: string, isPublic: boolean, isLive: boolean = false): Observable<Video> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('isPublic', isPublic.toString());
    formData.append('isLive', isLive.toString());

    return this.http.post<Video>(`${this.apiUrl}/upload`, formData);
  }

  getPublicVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/public`);
  }

  getMyVideos(): Observable<Video[]> {
    return this.http.get<Video[]>(`${this.apiUrl}/my-videos`);
  }

  getDashboardVideos(): Observable<Video[]> {
    return forkJoin({
      publicVideos: this.getPublicVideos().pipe(catchError(() => of([]))),
      myVideos: this.getMyVideos().pipe(catchError(() => of([])))
    }).pipe(
      map(({ publicVideos, myVideos }) => {
        const byId = new Map<number, Video>();
        [...publicVideos, ...myVideos].forEach(video => byId.set(video.id, video));
        return Array.from(byId.values());
      })
    );
  }

  getLiveStreamStatus(liveId: string): Observable<{ status: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND', videoId?: number, title?: string }> {
    return this.http.get<{ status: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND', videoId?: number, title?: string }>(`${this.apiUrl}/stream/live/${liveId}/status`);
  }

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`);
  }

  trackVideoAccess(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/access`, {});
  }

  getStreamUrl(id: number): string {
    return `${this.apiUrl}/stream/${id}`;
  }
}
