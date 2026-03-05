import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { timer } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StreamGatewayService {
  private readonly streamingApiUrl = this.normalizeBaseUrl(environment.streamingApiUrl);
  private readonly obsIngestBaseUrl = environment.obsIngestBaseUrl;

  constructor(private http: HttpClient) {}

  createLiveStream(): Observable<{ id: string; streamKey: string; playbackId?: string; rtmpUrl: string; ingestUrl: string }> {
    return this.http.post<{ id: string; streamKey: string; playbackId?: string; rtmpUrl: string; ingestUrl: string }>(
      `${this.streamingApiUrl}/live-streams`,
      {}
    );
  }

  getActiveStreams(): Observable<string[]> {
    return this.http.get<{ streams?: { id: string }[] }>(`${this.streamingApiUrl}/live-streams/active`).pipe(
      map(response => (response?.streams ?? []).map(stream => stream.id))
    );
  }

  watchActiveStreams(refreshMs: number = 5000): Observable<string[]> {
    return timer(0, refreshMs).pipe(
      switchMap(() => this.getActiveStreams())
    );
  }

  getLiveFlvUrl(liveId: string): string {
    return `https://stream.mux.com/${this.encodePathSegment(liveId)}.m3u8`;
  }

  getRecordingUrl(liveId: string): string {
    return `https://stream.mux.com/${this.encodePathSegment(liveId)}.m3u8`;
  }

  getObsServerUrl(): string {
    return this.getResolvedObsBaseUrl();
  }

  getObsIngestEndpoint(streamKey: string): string {
    return `${this.getResolvedObsBaseUrl()}/${streamKey}`;
  }

  private getResolvedObsBaseUrl(): string {
    const configured = this.obsIngestBaseUrl;

    try {
      const parsed = new URL(configured);
      const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';

      const internalHosts = new Set(['video-streaming', 'backend', 'frontend']);
      const localhostHosts = new Set(['localhost', '127.0.0.1']);
      const shouldUseBrowserHost = browserHost.length > 0 && (internalHosts.has(parsed.hostname) || localhostHosts.has(parsed.hostname));

      const host = shouldUseBrowserHost ? browserHost : parsed.hostname;
      const port = parsed.port || '1935';
      return `${parsed.protocol}//${host}:${port}`;
    } catch {
      return configured;
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, '');
  }

  private encodePathSegment(segment: string): string {
    return encodeURIComponent((segment || '').trim());
  }
}
