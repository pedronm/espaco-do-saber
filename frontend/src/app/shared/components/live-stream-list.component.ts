import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LiveStreamFeedItem } from '../models/live-stream-feed.model';
import { AuthService } from '../services/auth.service';
import { LiveStreamFeedService } from '../services/live-stream-feed.service';

@Component({
  standalone: false,
  selector: 'app-live-stream-list',
  template: `
    <div class="live-streams-section">
      <h3>{{ title }}</h3>

      <div *ngIf="liveStreams.length === 0" class="empty-state">
        Nenhuma transmissão ativa no momento.
      </div>

      <div class="live-grid" *ngIf="liveStreams.length > 0">
        <div class="live-card" *ngFor="let stream of liveStreams">
          <div class="live-meta">
            <div class="live-title">{{ stream.title }}</div>
            <span class="badge-live">{{ stream.status }}</span>
          </div>
          <button class="btn-watch" (click)="openLivePlayer(stream)">Assistir</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .live-streams-section {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 1.5rem;
    }
    .live-streams-section h3 {
      margin: 0 0 1rem 0;
      color: #333;
      font-size: 1.05rem;
    }
    .empty-state {
      color: #777;
      font-size: 0.95rem;
    }
    .live-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .live-card {
      border: 1px solid #e3e3e3;
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .live-title {
      font-weight: 600;
      color: #333;
      margin-bottom: 0.25rem;
    }
    .badge-live {
      display: inline-block;
      background: #f44336;
      color: white;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
    }
    .btn-watch {
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0.5rem 0.85rem;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-watch:hover {
      background: #145ea8;
    }
  `]
})
export class LiveStreamListComponent implements OnInit, OnDestroy {
  @Input() title = 'Transmissões ao vivo';
  liveStreams: LiveStreamFeedItem[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private liveStreamFeedService: LiveStreamFeedService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.liveStreamFeedService.watchActiveStreams()
      .pipe(takeUntil(this.destroy$))
      .subscribe((streams) => {
        this.liveStreams = streams;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openLivePlayer(stream: LiveStreamFeedItem): void {
    if (this.authService.hasRole('TEACHER') || this.authService.hasRole('ADMIN')) {
      this.router.navigate(['/live']);
      return;
    }

    this.router.navigate(['/video/live', stream.liveId]);
  }
}
