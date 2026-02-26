import { Injectable } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { LiveStreamFeedItem } from '../models/live-stream-feed.model';
import { VideoService } from './video.service';

@Injectable({
  providedIn: 'root'
})
export class LiveStreamFeedService {
  constructor(private videoService: VideoService) {}

  getActiveStreams(): Observable<LiveStreamFeedItem[]> {
    return this.videoService.getActiveStreams().pipe(
      map((liveIds) => liveIds.map((liveId) => ({
        liveId,
        title: `Transmissão iniciada em ${this.getReadableDateFromLiveId(liveId)}`,
        status: 'LIVE' as const,
        streamUrl: `/api/videos/stream/live/${liveId}/recording`
      })))
    );
  }

  watchActiveStreams(refreshMs: number = 5000): Observable<LiveStreamFeedItem[]> {
    return timer(0, refreshMs).pipe(
      switchMap(() => this.getActiveStreams())
    );
  }

  private getReadableDateFromLiveId(liveId: string): string {
    const timestampText = liveId.startsWith('live_') ? liveId.replace('live_', '') : '';
    const timestamp = Number(timestampText);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return 'agora';
    }

    return new Date(timestamp).toLocaleString('pt-BR');
  }
}
