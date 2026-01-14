import { Component, OnInit } from '@angular/core';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';

@Component({
  selector: 'app-admin-dashboard',
  template: `
    <div class="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <div class="stats">
        <div class="stat-card">
          <h3>Total Videos</h3>
          <p class="stat-number">{{ videos.length }}</p>
        </div>
        <div class="stat-card">
          <h3>Live Streams</h3>
          <p class="stat-number">{{ liveVideos }}</p>
        </div>
        <div class="stat-card">
          <h3>Public Videos</h3>
          <p class="stat-number">{{ publicVideos }}</p>
        </div>
      </div>
      <div class="videos-section">
        <h3>All Videos</h3>
        <div class="video-grid">
          <div class="video-card" *ngFor="let video of videos">
            <div class="video-info">
              <h4>{{ video.title }}</h4>
              <p>{{ video.description }}</p>
              <p class="teacher-name">Teacher: {{ video.teacherName }}</p>
              <span class="badge" [class.live]="video.isLive">{{ video.isLive ? 'LIVE' : 'RECORDED' }}</span>
              <span class="badge" [class.public]="video.isPublic">{{ video.isPublic ? 'PUBLIC' : 'PRIVATE' }}</span>
            </div>
          </div>
        </div>
      </div>
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
    .videos-section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
      padding: 1rem;
      transition: transform 0.3s;
    }
    .video-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
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
      margin-right: 0.5rem;
    }
    .badge.live {
      background: #f44336;
      color: white;
    }
    .badge.public {
      background: #4caf50;
      color: white;
    }
  `]
})
export class AdminDashboardComponent implements OnInit {
  videos: Video[] = [];

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.videoService.getPublicVideos().subscribe(videos => {
      this.videos = videos;
    });
  }

  get liveVideos(): number {
    return this.videos.filter(v => v.isLive).length;
  }

  get publicVideos(): number {
    return this.videos.filter(v => v.isPublic).length;
  }
}
