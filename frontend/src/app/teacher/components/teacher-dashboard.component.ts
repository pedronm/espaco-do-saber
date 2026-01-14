import { Component, OnInit } from '@angular/core';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';

@Component({
  selector: 'app-teacher-dashboard',
  template: `
    <div class="teacher-dashboard">
      <h2>Teacher Dashboard</h2>
      <div class="upload-section">
        <h3>Upload New Video</h3>
        <form (ngSubmit)="onUpload()">
          <div class="form-group">
            <label>Title</label>
            <input type="text" [(ngModel)]="title" name="title" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="description" name="description" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Video File</label>
            <input type="file" (change)="onFileSelected($event)" accept="video/*" required>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" [(ngModel)]="isPublic" name="isPublic">
              Make Public
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" [(ngModel)]="isLive" name="isLive">
              Live Stream
            </label>
          </div>
          <button type="submit" class="btn-primary" [disabled]="uploading">
            {{ uploading ? 'Uploading...' : 'Upload Video' }}
          </button>
        </form>
      </div>
      <div class="videos-section">
        <h3>My Videos</h3>
        <div class="video-grid">
          <div class="video-card" *ngFor="let video of videos">
            <div class="video-thumbnail">
              <video [src]="getStreamUrl(video.id)" width="100%" height="200"></video>
            </div>
            <div class="video-info">
              <h4>{{ video.title }}</h4>
              <p>{{ video.description }}</p>
              <span class="badge" [class.live]="video.isLive">{{ video.isLive ? 'LIVE' : 'RECORDED' }}</span>
              <span class="badge" [class.public]="video.isPublic">{{ video.isPublic ? 'PUBLIC' : 'PRIVATE' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .teacher-dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }
    h2 {
      color: #333;
      margin-bottom: 2rem;
    }
    .upload-section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    .form-group {
      margin-bottom: 1rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #555;
      font-weight: 500;
    }
    input, textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .btn-primary {
      padding: 0.75rem 2rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
    }
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
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
      overflow: hidden;
      transition: transform 0.3s;
    }
    .video-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .video-thumbnail {
      background: #000;
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
export class TeacherDashboardComponent implements OnInit {
  videos: Video[] = [];
  title: string = '';
  description: string = '';
  isPublic: boolean = false;
  isLive: boolean = false;
  selectedFile: File | null = null;
  uploading: boolean = false;

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.videoService.getMyVideos().subscribe(videos => {
      this.videos = videos;
    });
  }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0];
  }

  onUpload(): void {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.videoService.uploadVideo(
      this.selectedFile,
      this.title,
      this.description,
      this.isPublic,
      this.isLive
    ).subscribe({
      next: () => {
        this.uploading = false;
        this.resetForm();
        this.loadVideos();
      },
      error: () => {
        this.uploading = false;
        alert('Upload failed');
      }
    });
  }

  resetForm(): void {
    this.title = '';
    this.description = '';
    this.isPublic = false;
    this.isLive = false;
    this.selectedFile = null;
  }

  getStreamUrl(id: number): string {
    return this.videoService.getStreamUrl(id);
  }
}
