import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';

@Component({
  standalone: false,
  selector: 'app-teacher-dashboard',
  template: `
    <div class="loading-overlay" *ngIf="isLoading">
      <div class="spinner"></div>
      <p>Carregando vídeo...</p>
    </div>
    <div class="teacher-dashboard">
      <h2>Painel do Professor</h2>
      <app-live-stream-list title="Transmissões em andamento"></app-live-stream-list>
      <div class="upload-section">
        <h3>Enviar Novo Vídeo</h3>
        <form (ngSubmit)="onUpload()">
          <div class="form-group">
            <label>Título</label>
            <input type="text" [(ngModel)]="title" name="title" required>
          </div>
          <div class="form-group">
            <label>Descrição</label>
            <textarea [(ngModel)]="description" name="description" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Arquivo de Vídeo</label>
            <input type="file" (change)="onFileSelected($event)" accept="video/*" required>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" [(ngModel)]="isPublic" name="isPublic">
              Tornar Público
            </label>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" [(ngModel)]="isLive" name="isLive">
              Transmissão Ao Vivo
            </label>
          </div>
          <button type="submit" class="btn-primary" [disabled]="uploading">
            {{ uploading ? 'Enviando...' : 'Enviar Vídeo' }}
          </button>
        </form>
      </div>
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
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #1976d2;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loading-overlay p {
      color: white;
      font-size: 1.1rem;
    }
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
  isLoading: boolean = false;

  constructor(private videoService: VideoService, private router: Router) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  onVideoSelected(video: Video): void {
    this.isLoading = true;
    this.router.navigate(['/video', video.id])
      .then((ctn) => {
        console.log(ctn);
        this.isLoading = false;
      })
      .finally(() => this.isLoading = false);
  }

  loadVideos(): void {
    this.videoService.getDashboardVideos().subscribe(videos => {
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
      error: (error) => {
        this.uploading = false;
        const errorMessage = error.error?.message || 'Falha ao enviar vídeo. Verifique o formato do arquivo e tente novamente.';
        // TODO: Replace alert() with a proper toast/notification service
        alert(errorMessage);
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
}
