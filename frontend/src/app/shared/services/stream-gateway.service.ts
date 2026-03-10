import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, tap } from 'rxjs';
import { distinctUntilChanged, shareReplay, switchMap } from 'rxjs/operators';
import { timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isFeatureMuxOn, isFeatureStreamOn } from '../constants/feature-flags';

@Injectable({
  providedIn: 'root'
})
export class StreamGatewayService {
  private readonly streamingApiUrl = this.normalizeBaseUrl(environment.streamingApiUrl);
  private readonly obsIngestBaseUrl = environment.obsIngestBaseUrl;
  private readonly defaultPollIntervalMs = 15000;
  private readonly minPollIntervalMs = 8000;
  private activeStreamsPoll$?: Observable<string[]>;
  private activeStreamsPollIntervalMs?: number;

  constructor(private http: HttpClient) {}

  createLiveStream(): Observable<{ id: string; streamKey: string; playbackId?: string; rtmpUrl: string; ingestUrl: string }> {
    if (!isFeatureStreamOn() || !isFeatureMuxOn()) {
      return this.getDisabledLiveStream();
    }

    const url = `${this.streamingApiUrl}/live-streams`;
    console.debug('[StreamGatewayService] POST', url);
    return this.http.post<{ id: string; streamKey: string; playbackId?: string; rtmpUrl: string; ingestUrl: string }>(url, {}).pipe(
      tap((response) => {
        console.debug('[StreamGatewayService] POST success', url, {
          id: response?.id,
          hasStreamKey: Boolean(response?.streamKey)
        });
      })
    );
  }

  getActiveStreams(): Observable<string[]> {
    if (!isFeatureStreamOn()) {
      return of([]);
    }

    const url = `${this.streamingApiUrl}/live-streams/active`;
    console.debug('[StreamGatewayService] GET', url);
    return this.http.get<{ streams?: { id: string }[] }>(url).pipe(
      map(response => (response?.streams ?? []).map(stream => stream.id))
      ,
      tap((streams) => {
        console.debug('[StreamGatewayService] GET success', url, { count: streams.length });
      })
    );
  }

  watchActiveStreams(refreshMs: number = this.defaultPollIntervalMs): Observable<string[]> {
    if (!isFeatureStreamOn()) {
      return of([]);
    }

    const normalizedRefreshMs = this.normalizeRefreshMs(refreshMs);

    if (!this.activeStreamsPoll$ || this.activeStreamsPollIntervalMs !== normalizedRefreshMs) {
      this.activeStreamsPollIntervalMs = normalizedRefreshMs;
      console.debug('[StreamGatewayService] Polling active streams configured', {
        refreshMs: normalizedRefreshMs
      });

      // Share one polling flow across all subscribers to avoid duplicated requests.
      this.activeStreamsPoll$ = timer(0, normalizedRefreshMs).pipe(
        switchMap(() => this.getActiveStreams()),
        distinctUntilChanged((previous, current) => this.areSameStreams(previous, current)),
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }

    return this.activeStreamsPoll$;
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

  private normalizeRefreshMs(refreshMs: number): number {
    if (!Number.isFinite(refreshMs) || refreshMs <= 0) {
      return this.defaultPollIntervalMs;
    }

    return Math.max(Math.trunc(refreshMs), this.minPollIntervalMs);
  }

  private areSameStreams(previous: string[], current: string[]): boolean {
    if (previous.length !== current.length) {
      return false;
    }

    return previous.every((value, index) => value === current[index]);
  }

  private getDisabledLiveStream(): Observable<{ id: string; streamKey: string; playbackId?: string; rtmpUrl: string; ingestUrl: string }> {
    return of({
      id: 'feature-disabled',
      streamKey: 'feature-disabled',
      playbackId: undefined,
      rtmpUrl: this.getResolvedObsBaseUrl(),
      ingestUrl: this.getResolvedObsBaseUrl()
    });
  }
}
