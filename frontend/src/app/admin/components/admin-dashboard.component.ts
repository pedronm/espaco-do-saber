import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';
import { StreamGatewayService } from '../../shared/services/stream-gateway.service';
import { AuthService } from '../../shared/services/auth.service';
import { ManagedUser, UserManagementService } from '../../shared/services/user-management.service';
import { Subscription } from 'rxjs';

@Component({
  standalone: false,
  selector: 'app-admin-dashboard',
  template: `
    <div class="admin-dashboard">
      <h2>Painel do Administrador</h2>
      <div class="obs-section">
        <h3>Servidor OBS (campo Server)</h3>
        <p class="obs-endpoint">{{ obsServerUrl }}</p>
        <h3>Stream Key</h3>
        <p class="obs-endpoint">{{ obsStreamKey }}</p>
        <p class="obs-help">No OBS use o serviço "Custom", com Server e Stream Key em campos separados.</p>
        <button class="live-item" type="button" (click)="regenerateStreamKey()">Gerar nova chave</button>
      </div>
      <div class="obs-section">
        <h3>Transmissões ativas</h3>
        <p *ngIf="activeLiveStreams.length === 0">Nenhuma transmissão ativa no momento.</p>
        <div class="live-grid" *ngIf="activeLiveStreams.length > 0">
          <button class="live-item" *ngFor="let liveId of activeLiveStreams" (click)="watchLive(liveId)">
            Assistir transmissão {{ liveId }}
          </button>
        </div>
      </div>
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

      <div class="obs-section">
        <h3>Cadastros pendentes</h3>
        <p *ngIf="pendingUsers.length === 0">Nenhum cadastro pendente.</p>
        <div class="user-list" *ngIf="pendingUsers.length > 0">
          <div class="user-item" *ngFor="let user of pendingUsers">
            <div>
              <strong>{{ user.fullName }}</strong>
              <div>{{ user.username }} • {{ user.email }}</div>
            </div>
            <div class="user-actions">
              <button class="btn-action approve" (click)="approveUser(user.id)">Aprovar</button>
              <button class="btn-action reject" (click)="rejectUser(user.id)">Rejeitar</button>
            </div>
          </div>
        </div>
      </div>

      <div class="obs-section">
        <h3>Gerenciar usuários</h3>
        <p *ngIf="managedUsers.length === 0">Nenhum usuário encontrado.</p>
        <div class="user-list" *ngIf="managedUsers.length > 0">
          <div class="user-item" *ngFor="let user of managedUsers">
            <div>
              <strong>{{ user.fullName }}</strong>
              <div>{{ user.username }} • {{ user.email }}</div>
              <small>Papel atual: {{ roleLabel(user.role) }}</small>
            </div>
            <div class="user-actions" *ngIf="user.role !== 'ADMIN'">
              <button class="btn-action" (click)="setRole(user, 'TEACHER')">Professor</button>
              <button class="btn-action" (click)="setRole(user, 'STUDENT')">Aluno</button>
            </div>
          </div>
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
    .obs-section {
      background: white;
      padding: 1.25rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 1.5rem;
    }
    .obs-endpoint {
      font-family: monospace;
      background: #f5f5f5;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      display: inline-block;
      margin: 0;
    }
    .obs-help {
      color: #555;
      margin: 0.75rem 0 1rem;
      font-size: 0.9rem;
    }
    .live-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 0.75rem;
    }
    .live-item {
      border: 1px solid #d6d6d6;
      background: #fff;
      border-radius: 6px;
      padding: 0.65rem 0.8rem;
      text-align: left;
      cursor: pointer;
    }
    .live-item:hover {
      background: #f7f7f7;
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
    .user-list {
      display: grid;
      gap: 0.75rem;
    }
    .user-item {
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .user-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-action {
      border: 1px solid #d6d6d6;
      background: #fff;
      border-radius: 6px;
      padding: 0.45rem 0.75rem;
      cursor: pointer;
    }
    .btn-action:hover {
      background: #f7f7f7;
    }
    .btn-action.approve {
      border-color: #2e7d32;
      color: #2e7d32;
    }
    .btn-action.reject {
      border-color: #c62828;
      color: #c62828;
    }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  videos: Video[] = [];
  pendingUsers: ManagedUser[] = [];
  managedUsers: ManagedUser[] = [];
  activeLiveStreams: string[] = [];
  obsServerUrl: string = '';
  obsStreamKey: string = '';
  private liveSubscription?: Subscription;
  private previousActiveLiveCount: number = 0;

  constructor(
    private videoService: VideoService,
    private userManagementService: UserManagementService,
    private streamGatewayService: StreamGatewayService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAllVideos();
    this.loadUsers();
    this.liveSubscription = this.streamGatewayService.watchActiveStreams().subscribe(streams => {
      const previousCount = this.previousActiveLiveCount;
      this.activeLiveStreams = streams;
      this.previousActiveLiveCount = streams.length;

      if (previousCount > streams.length) {
        this.loadAllVideos();
      }
    });
    this.obsStreamKey = this.authService.getOrCreateObsStreamKey() || 'admin-sala';
    this.obsServerUrl = this.streamGatewayService.getObsServerUrl();
  }

  ngOnDestroy(): void {
    this.liveSubscription?.unsubscribe();
  }

  loadAllVideos(): void {
    this.videoService.getDashboardVideos().subscribe(videos => {
      this.videos = videos;
    });
  }

  loadUsers(): void {
    this.userManagementService.getPendingUsers().subscribe(users => {
      this.pendingUsers = users;
    });

    this.userManagementService.getAllUsers().subscribe(users => {
      this.managedUsers = users;
    });
  }

  watchLive(liveId: string): void {
    this.router.navigate(['/video/live', liveId]);
  }

  regenerateStreamKey(): void {
    this.authService.regenerateObsStreamKey().subscribe({
      next: (key) => {
        this.obsStreamKey = key;
      },
      error: () => {
        alert('Não foi possível gerar nova chave no momento.');
      }
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

  approveUser(userId: number): void {
    this.userManagementService.approveUser(userId).subscribe({
      next: () => this.loadUsers(),
      error: () => alert('Falha ao aprovar cadastro.')
    });
  }

  rejectUser(userId: number): void {
    this.userManagementService.rejectUser(userId).subscribe({
      next: () => this.loadUsers(),
      error: () => alert('Falha ao rejeitar cadastro.')
    });
  }

  setRole(user: ManagedUser, role: 'TEACHER' | 'STUDENT'): void {
    if (user.role === role) {
      return;
    }

    this.userManagementService.updateUserRole(user.id, role).subscribe({
      next: () => this.loadUsers(),
      error: () => alert('Falha ao atualizar papel do usuário.')
    });
  }

  roleLabel(role: ManagedUser['role']): string {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'TEACHER':
        return 'Professor';
      default:
        return 'Aluno';
    }
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
