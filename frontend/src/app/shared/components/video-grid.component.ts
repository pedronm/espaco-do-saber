import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Video } from '../models/video.model';

@Component({
  standalone: false,
  selector: 'app-video-grid',
  template: `
    <div *ngIf="isLoading" class="loading"><span class="loading-spinner"></span></div>
    <div class="videos-section">
      <h3>{{ title }}</h3>
      <div class="video-grid">
        <div *ngIf="videos.length === 0 && !isLoading" class="no-videos">
          <p>Nenhum vídeo encontrado.</p>
        </div>
        <div class="video-card" (click)="onVideoClick(video)" *ngFor="let video of videos">
          <div class="video-thumbnail" *ngIf="showThumbnail">
            <img *ngIf="video.thumbnailPath" [src]="video.thumbnailPath" alt="{{ video.title }}" width="100%" height="200">
            <div *ngIf="!video.thumbnailPath" class="placeholder-thumbnail"></div>
          </div>
          <div class="video-info" >
            <h4>{{ video.title }}</h4>
            <p>{{ video.description }}</p>
            <p *ngIf="showTeacherName" class="teacher-name">Professor: {{ video.teacherName }}</p>
            <span class="badge" [class.live]="video.isLive">{{ video.isLive ? 'AO VIVO' : 'GRAVADO' }}</span>
            <span class="badge ended-live" *ngIf="!video.isLive && video.wasLive">TRANSMISSÃO ENCERRADA</span>
            <span class="badge" [class.public]="video.isPublic">{{ video.isPublic ? 'PÚBLICO' : 'PRIVADO' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .loading{
      z-index: 1000;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate( -50%, -50%)
    }

    .loading-spinner{
      width: 5vh;
      width: 3vw;      
      animation: spin 1s linear infinite;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
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
      cursor: pointer;
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
      font-size: 0.85rem;
      color: #999;
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
    .badge.ended-live {
      background: #ff9800;
      color: white;
    }
  `]
})
export class VideoGridComponent {
  @Input() videos: Video[] = [];
  @Input() title: string = 'Videos';
  @Input() showThumbnail: boolean = true;
  @Input() showTeacherName: boolean = false;
  @Input() isLoading: boolean = false;
  @Output() videoSelected = new EventEmitter<Video>();

  onVideoClick(video: Video): void {
    this.videoSelected.emit(video);
  }
}
