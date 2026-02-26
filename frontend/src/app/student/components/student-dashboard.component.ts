import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';

@Component({
  standalone: false,
  selector: 'app-student-dashboard',
  template: `
    <div class="student-dashboard">
      <h2>Quadro de aulas</h2>
      <app-live-stream-list title="Transmissões em andamento"></app-live-stream-list>
       <app-video-grid 
        [isLoading]="isLoading"
        [videos]="videos" 
        title="Meus Videos"
        [showThumbnail]="true"
        [showTeacherName]="false"
        (videoSelected)="onVideoSelected($event)">
      </app-video-grid>
    </div>
  `,
  styles: [`
    .student-dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }
    h2 {
      color: #333;
      margin-bottom: 2rem;
    }
    .videos-section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .no-videos {
      text-align: center;
      padding: 2rem;
      color: #999;
    }
    .video-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .video-card {
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.3s;
    }
    .video-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .video-thumbnail {
      background: #000;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .placeholder-thumbnail {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .video-info {
      padding: 1rem;
    }
    .video-info h4 {
      margin: 0 0 0.5rem 0;
      color: #333;
    }
    .video-info p {
      margin: 0 0 0.5rem 0;
      color: #666;
      font-size: 0.9rem;
    }
    .teacher-name {
      color: #1976d2;
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      background: #e0e0e0;
      color: #555;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    .badge.live {
      background: #f44336;
      color: white;
    }
  `]
})
export class StudentDashboardComponent implements OnInit {
  videos: Video[] = [];
  isLoading: boolean = false;

  constructor(private videoService: VideoService, private router: Router) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  onVideoSelected(video: Video): void {
    const liveId = this.extractLiveIdFromStreamingUrl(video.streamingUrl);
    if (video.isLive && liveId) {
      this.router.navigate(['/video/live', liveId]);
      return;
    }

    this.router.navigate(['/video', video.id]);
  }

  loadVideos(): void {
    this.videoService.getDashboardVideos().subscribe(videos => {
      this.videos = videos;
    });
  }

  getStreamUrl(id: number): string {
    return this.videoService.getStreamUrl(id);
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
