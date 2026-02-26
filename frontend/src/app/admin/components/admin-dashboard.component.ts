import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';

@Component({
  standalone: false,
  selector: 'app-admin-dashboard',
  template: `
    <div class="admin-dashboard">
      <h2>Painel do Administrador</h2>
      <app-live-stream-list title="Transmissões em andamento"></app-live-stream-list>
      <div class="stats">
        <div class="stat-card">
          <h3>Total de Vídeos</h3>
          <p class="stat-number">{{ videos.length }}</p>
        </div>
        <div class="stat-card">
          <h3>Transmissões ao Vivo</h3>
          <p class="stat-number">{{ liveVideos }}</p>
        </div>
        <div class="stat-card">
          <h3>Vídeos Públicos</h3>
          <p class="stat-number">{{ publicVideos }}</p>
        </div>
      </div>
      <app-video-grid 
        [videos]="videos" 
        title="Todos os Vídeos"
        [showThumbnail]="false"
        [showTeacherName]="true"
        (videoSelected)="onVideoSelected($event)">
      </app-video-grid>
    </div>
  `,
  styles: [`
    .admin-dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }
    h2 {
      color: #333;
      margin-bottom: 2rem;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card h3 {
      margin: 0 0 1rem 0;
      color: #555;
      font-size: 1rem;
    }
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #1976d2;
      margin: 0;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  videos: Video[] = [];

  constructor(private videoService: VideoService, private router: Router) {}

  ngOnInit(): void {
    this.loadAllVideos();
  }

  loadAllVideos(): void {
    this.videoService.getDashboardVideos().subscribe(videos => {
      this.videos = videos;
    });
  }

  get liveVideos(): number {
    return this.videos.filter(v => v.isLive).length;
  }

  get publicVideos(): number {
    return this.videos.filter(v => v.isPublic).length;
  }

  onVideoSelected(video: Video): void {
    const liveId = this.extractLiveIdFromStreamingUrl(video.streamingUrl);
    if (video.isLive && liveId) {
      this.router.navigate(['/video/live', liveId]);
      return;
    }

    this.router.navigate(['/video', video.id]);
  }

  private extractLiveIdFromStreamingUrl(streamingUrl: string | undefined): string | null {
    if (!streamingUrl) {
      return null;
    }

    const recordingMatch = streamingUrl.match(/\/stream\/live\/([^/]+)\/recording/);
    if (recordingMatch?.[1]) {
      return recordingMatch[1];
    }

    const hlsMatch = streamingUrl.match(/\/stream\/live\/([^/]+)\/hls\//);
    if (hlsMatch?.[1]) {
      return hlsMatch[1];
    }

    return null;
  }
}
