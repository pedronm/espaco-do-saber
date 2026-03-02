import { Injectable } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { StreamGatewayService } from './stream-gateway.service';

@Injectable({
  providedIn: 'root'
})
export class LiveStreamPresenceService {
  private readonly newLiveStreamSubject = new Subject<string>();
  private readonly seenStreams = new Set<string>();
  private streamWatcher?: Subscription;
  private initialized = false;

  constructor(private streamGatewayService: StreamGatewayService) {}

  startWatching(): void {
    if (this.streamWatcher) {
      return;
    }

    this.streamWatcher = this.streamGatewayService.watchActiveStreams().subscribe((streams) => {
      const current = new Set(streams);

      if (!this.initialized) {
        this.initialized = true;
        this.seenStreams.clear();
        current.forEach(stream => this.seenStreams.add(stream));
        return;
      }

      streams.forEach((streamId) => {
        if (!this.seenStreams.has(streamId)) {
          this.newLiveStreamSubject.next(streamId);
        }
      });

      this.seenStreams.clear();
      current.forEach(stream => this.seenStreams.add(stream));
    });
  }

  stopWatching(): void {
    this.streamWatcher?.unsubscribe();
    this.streamWatcher = undefined;
    this.initialized = false;
  }

  onNewStream(): Observable<string> {
    return this.newLiveStreamSubject.asObservable();
  }
}
