import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Video } from '../models/video.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = `${environment.apiUrl}/videos`;

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

  getVideo(id: number): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`);
  }

  getStreamUrl(id: number): string {
    return `${this.apiUrl}/stream/${id}`;
  }
}
