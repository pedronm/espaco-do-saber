import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Video } from '../models/video.model';
import { environment } from '../../../environments/environment';
import { isFeatureR2On, isFeatureStreamOn, isFeatureVideoOn } from '../constants/feature-flags';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = `${environment.apiUrl}/videos`;

  constructor(private http: HttpClient) {}

  uploadVideo(file: File, title: string, description: string, isPublic: boolean, isLive: boolean = false): Observable<Video> {
    if (!isFeatureVideoOn() || !isFeatureR2On()) {
      return of(this.createDisabledVideo(title, description, isPublic, isLive));
    }

    return this.http.post<Video>(`${this.apiUrl}`, {
      title,
      description,
      isPublic,
      isLive,
      streamingUrl: ''
    });
  }

  getPublicVideos(): Observable<Video[]> {
    if (!isFeatureVideoOn()) {
      return of([]);
    }

    const url = `${this.apiUrl}/public`;
    console.debug('[VideoService] GET', url);
    return this.http.get<Video[]>(url).pipe(
      tap((videos) => {
        console.debug('[VideoService] GET success', url, { count: videos?.length || 0 });
      })
    );
  }

  getMyVideos(): Observable<Video[]> {
    if (!isFeatureVideoOn()) {
      return of([]);
    }

    const url = `${this.apiUrl}/my-videos`;
    console.debug('[VideoService] GET', url);
    return this.http.get<Video[]>(url).pipe(
      tap((videos) => {
        console.debug('[VideoService] GET success', url, { count: videos?.length || 0 });
      })
    );
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
    if (!isFeatureStreamOn()) {
      return of({ status: 'NOT_FOUND' as const });
    }

    return this.http.get<{ streams: { id: string }[] }>(`${environment.streamingApiUrl}/live-streams/active`).pipe(
      map((response) => {
        const stream = (response.streams || []).find((item) => item.id === liveId);
        if (stream) {
          return { status: 'ACTIVE' as const };
        }

        return { status: 'COMPLETED' as const };
      }),
      catchError(() => of({ status: 'NOT_FOUND' as const }))
    );
  }

  getVideo(id: number): Observable<Video> {
    if (!isFeatureVideoOn()) {
      return of(this.createDisabledVideo('Conteudo indisponivel', 'Feature de video desabilitada.', true, false));
    }

    return this.http.get<Video>(`${this.apiUrl}/${id}`);
  }

  trackVideoAccess(id: number): Observable<void> {
    if (!isFeatureVideoOn()) {
      return of(void 0);
    }

    return this.http.post<void>(`${this.apiUrl}/${id}/access`, {});
  }

  getStreamUrl(id: number): string {
    return `${this.apiUrl}/stream/${id}`;
  }

  private createDisabledVideo(title: string, description: string, isPublic: boolean, isLive: boolean): Video {
    return {
      id: -1,
      title,
      description,
      teacherId: 0,
      teacherName: 'Sistema',
      duration: 0,
      isLive,
      wasLive: isLive,
      isPublic,
      uploadedAt: new Date(),
      streamingUrl: ''
    };
  }
}
