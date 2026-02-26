import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, distinctUntilChanged, map, tap } from 'rxjs/operators';
import { Video } from '../models/video.model';
import { Stream, StreamResponse, StreamChunk } from '../models/stream.model';
import { StreamStatus } from '../models/stream.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = `${environment.apiUrl}/videos`;
  private streamStatusState$ = new BehaviorSubject<Record<string, StreamStatus>>({});

  constructor(private http: HttpClient) {}

  uploadVideo(file: File, title: string, description: string, isPublic: boolean, isLive: boolean): Observable<Video> {
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

  getActiveStreams(): Observable<string[]> {
    return this.http.get<{ streams?: string[] }>(`${this.apiUrl}/stream/active`).pipe(
      map(response => response?.streams ?? [])
    );
  }

  getLiveStreamStatus(liveId: string): Observable<{ status: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND', videoId?: number, title?: string }> {
    return this.http.get<{ status: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND', videoId?: number, title?: string }>(`${this.apiUrl}/stream/live/${liveId}/status`);
  }

  getLiveRecordingBlob(liveId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/stream/live/${liveId}/recording?t=${Date.now()}`, {
      responseType: 'blob'
    });
  }

  getProtectedMediaBlob(mediaUrl: string): Observable<Blob> {
    const separator = mediaUrl.includes('?') ? '&' : '?';
    const urlWithCacheBust = `${mediaUrl}${separator}t=${Date.now()}`;
    return this.http.get(urlWithCacheBust, {
      responseType: 'blob'
    });
  }

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`);
  }

  trackVideoAccess(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/access`, {});
  }

  streamChunk(chunk: Blob, liveId: string, sequence: number): Observable<StreamResponse> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('liveId', liveId);
    formData.append('sequence', sequence.toString());
    return this.http.post<StreamResponse>(`${this.apiUrl}/stream/chunk`, formData).pipe(
      tap((response) => {
        this.setStreamStatus(liveId, response?.status ?? StreamStatus.ACTIVE);
      }),
      catchError((error) => {
        this.setStreamStatus(liveId, StreamStatus.FAILED);
        return throwError(() => error);
      })
    );
  }

  endStream(liveId: string, sequence: number): Observable<StreamResponse> {
    return this.http.post<StreamResponse>(`${this.apiUrl}/stream/end`, { liveId, sequence }).pipe(
      tap((response) => {
        this.setStreamStatus(liveId, response?.status ?? StreamStatus.COMPLETED);
      }),
      catchError((error) => {
        this.setStreamStatus(liveId, StreamStatus.FAILED);
        return throwError(() => error);
      })
    );
  }

  uploadFinalStreamRecording(file: Blob, liveId: string): Observable<StreamResponse> {
    const formData = new FormData();
    formData.append('file', file, 'final.webm');
    formData.append('liveId', liveId);

    return this.http.post<StreamResponse>(`${this.apiUrl}/stream/final`, formData).pipe(
      catchError((error) => {
        this.setStreamStatus(liveId, StreamStatus.FAILED);
        return throwError(() => error);
      })
    );
  }

  streamStatus$(liveId: string): Observable<StreamStatus> {
    return this.streamStatusState$.pipe(
      map(state => state[liveId] ?? StreamStatus.INITIALIZING),
      distinctUntilChanged()
    );
  }

  getStreamUrl(id: number): string {
    return `${this.apiUrl}/stream/${id}`;
  }

  private setStreamStatus(liveId: string, status: StreamStatus): void {
    const current = this.streamStatusState$.value;
    this.streamStatusState$.next({
      ...current,
      [liveId]: status
    });
  }
}
