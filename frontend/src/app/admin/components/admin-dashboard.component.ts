import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VideoService } from '../../shared/services/video.service';
import { Video } from '../../shared/models/video.model';
import { StreamGatewayService } from '../../shared/services/stream-gateway.service';
import { ManagedUser, UserManagementService } from '../../shared/services/user-management.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';

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
              <button class="btn-action approve" 
                      (click)="approveUser(toNumberId(user.id))"
                      [disabled]="approvingUserIds.has(String(user.id))"
                      [attr.aria-busy]="approvingUserIds.has(String(user.id))">
                {{ approvingUserIds.has(String(user.id)) ? 'Processando...' : 'Aprovar' }}
              </button>
              <button class="btn-action reject" 
                      (click)="rejectUser(toNumberId(user.id))"
                      [disabled]="approvingUserIds.has(String(user.id))"
                      [attr.aria-busy]="approvingUserIds.has(String(user.id))">
                {{ approvingUserIds.has(String(user.id)) ? 'Processando...' : 'Rejeitar' }}
              </button>
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
              <span class="status-chip" *ngIf="user.passwordExpiresAt">Troca de senha pendente</span>
            </div>
            <div class="user-actions" *ngIf="user.role !== 'ADMIN'">
              <button class="btn-action" (click)="setRole(user, 'TEACHER')">Professor</button>
              <button class="btn-action" (click)="setRole(user, 'STUDENT')">Aluno</button>
              <button class="btn-action" (click)="expirePassword(user)">Solicitar troca de senha</button>
            </div>
          </div>
        </div>
        <div class="pagination" *ngIf="totalUserPages > 1">
          <button class="btn-action" (click)="previousUsersPage()" [disabled]="usersPage === 0">Anterior</button>
          <span>Página {{ usersPage + 1 }} de {{ totalUserPages }} • {{ totalUsers }} usuários</span>
          <button class="btn-action" (click)="nextUsersPage()" [disabled]="usersPage + 1 >= totalUserPages">Próxima</button>
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
    .btn-action:hover:not(:disabled) {
      background: #f7f7f7;
    }
    .btn-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-action.approve {
      border-color: #2e7d32;
      color: #2e7d32;
    }
    .btn-action.reject {
      border-color: #c62828;
      color: #c62828;
    }
    .pagination {
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .status-chip {
      display: inline-block;
      margin-left: 0.5rem;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      border: 1px solid #ed6c02;
      color: #ed6c02;
      font-size: 0.75rem;
      font-weight: 600;
      vertical-align: middle;
    }
  `]
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  videos: Video[] = [];
  pendingUsers: ManagedUser[] = [];
  managedUsers: ManagedUser[] = [];
  usersPage: number = 0;
  usersPageSize: number = 10;
  totalUserPages: number = 0;
  totalUsers: number = 0;
  activeLiveStreams: string[] = [];
  obsServerUrl: string = '';
  obsStreamKey: string = '';
  private liveSubscription?: Subscription;
  private previousActiveLiveCount: number = 0;
  private approvalTimeouts: Map<string, NodeJS.Timeout> = new Map();
  approvingUserIds: Set<string> = new Set();

  constructor(
    private videoService: VideoService,
    private userManagementService: UserManagementService,
    private streamGatewayService: StreamGatewayService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.authService.hasRole('administrador')) {
      this.router.navigate(['/aluno']);
      return;
    }

    this.loadAllVideos();
    this.loadUsers();
    this.liveSubscription = this.streamGatewayService.watchActiveStreams().subscribe({
      next: (streams) => {
        const previousCount = this.previousActiveLiveCount;
        this.activeLiveStreams = streams;
        this.previousActiveLiveCount = streams.length;

        if (previousCount > streams.length) {
          this.loadAllVideos();
        }
      },
      error: (error) => {
        console.warn('[AdminDashboard] Live stream polling failed', error);
        this.activeLiveStreams = [];
      }
    });
    this.obsServerUrl = this.streamGatewayService.getObsServerUrl();
  }

  ngOnDestroy(): void {
    this.liveSubscription?.unsubscribe();
    // Clean up any pending timeouts
    this.approvalTimeouts.forEach(timeout => clearTimeout(timeout));
    this.approvalTimeouts.clear();
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

    this.loadManagedUsersPage(this.usersPage);
  }

  loadManagedUsersPage(page: number): void {
    this.userManagementService.getAllUsers(page, this.usersPageSize).subscribe(result => {
      this.managedUsers = result.content;
      this.usersPage = result.number;
      this.totalUserPages = result.totalPages;
      this.totalUsers = result.totalElements;
    });
  }

  watchLive(liveId: string): void {
    this.router.navigate(['/videos/ao-vivo', liveId]);
  }

  regenerateStreamKey(): void {
    this.streamGatewayService.createLiveStream().subscribe({
      next: (stream) => {
        this.obsStreamKey = stream.streamKey;
        this.obsServerUrl = stream.rtmpUrl;
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
      this.router.navigate(['/videos/ao-vivo', liveId]);
      return;
    }

    this.router.navigate(['/video', video.id]);
  }

  approveUser(userId: number): void {
    if (!Number.isFinite(userId)) {
      alert('ID de usuário inválido para aprovação.');
      return;
    }

    const userIdStr = String(userId);
    if (this.approvingUserIds.has(userIdStr)) {
      console.warn(`Approval already in progress for userId ${userId}`);
      return;
    }

    this.approvingUserIds.add(userIdStr);
    const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

    // Set a timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      this.approvingUserIds.delete(userIdStr);
      this.approvalTimeouts.delete(userIdStr);
      alert('A requisição excedeu o tempo permitido. Por favor, tente novamente.');
      console.error(`Approval request timeout for userId ${userId}`);
    }, REQUEST_TIMEOUT);

    this.approvalTimeouts.set(userIdStr, timeoutId);

    console.log(`Approving user ${userId}...`);

    this.userManagementService.approvePendingUser(userId).subscribe({
      next: (response) => {
        this.approvingUserIds.delete(userIdStr);
        const timeout = this.approvalTimeouts.get(userIdStr);
        if (timeout) {
          clearTimeout(timeout);
          this.approvalTimeouts.delete(userIdStr);
        }

        console.log(`User ${userId} approved successfully:`, response);
        alert(`Usuário aprovado com sucesso! Aprovação: ${response.approved}`);
        this.loadUsers();
      },
      error: (error) => {
        this.approvingUserIds.delete(userIdStr);
        const timeout = this.approvalTimeouts.get(userIdStr);
        if (timeout) {
          clearTimeout(timeout);
          this.approvalTimeouts.delete(userIdStr);
        }

        console.error(`Failed to approve user ${userId}:`, error);
        
        if (error.error?.code === 'TIMEOUT' || error.error?.code === 'TIMEOUT_EXCEPTION') {
          alert('A operação excedeu o tempo limite. O usuário pode ter sido aprovado. Por favor, recarregue a página.');
        } else if (error.error?.code === 'USER_NOT_FOUND') {
          alert('Usuário não encontrado no sistema.');
        } else if (error.status === 403) {
          alert('Você não tem permissão para aprovar usuários.');
        } else if (error.status === 504 || error.status === 502) {
          alert('Erro de conexão ao processar a aprovação. Por favor, tente novamente.');
        } else {
          const errorMsg = error.error?.detail || error.error?.message || 'Falha ao aprovar cadastro.';
          alert(errorMsg);
        }
      }
    });
  }

  rejectUser(userId: number): void {
    if (!Number.isFinite(userId)) {
      alert('ID de usuário inválido para rejeição.');
      return;
    }

    const userIdStr = String(userId);
    if (this.approvingUserIds.has(userIdStr)) {
      console.warn(`Rejection already in progress for userId ${userId}`);
      return;
    }

    this.approvingUserIds.add(userIdStr);
    const REQUEST_TIMEOUT = 15000; // 15 seconds timeout

    // Set a timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      this.approvingUserIds.delete(userIdStr);
      this.approvalTimeouts.delete(userIdStr);
      alert('A requisição excedeu o tempo permitido. Por favor, tente novamente.');
      console.error(`Rejection request timeout for userId ${userId}`);
    }, REQUEST_TIMEOUT);

    this.approvalTimeouts.set(userIdStr, timeoutId);

    console.log(`Rejecting user ${userId}...`);

    this.userManagementService.rejectPendingUser(userId).subscribe({
      next: (response) => {
        this.approvingUserIds.delete(userIdStr);
        const timeout = this.approvalTimeouts.get(userIdStr);
        if (timeout) {
          clearTimeout(timeout);
          this.approvalTimeouts.delete(userIdStr);
        }

        console.log(`User ${userId} rejected successfully:`, response);
        alert(`Cadastro rejeitado! O usuário será removido da lista.`);
        this.loadUsers();
      },
      error: (error) => {
        this.approvingUserIds.delete(userIdStr);
        const timeout = this.approvalTimeouts.get(userIdStr);
        if (timeout) {
          clearTimeout(timeout);
          this.approvalTimeouts.delete(userIdStr);
        }

        console.error(`Failed to reject user ${userId}:`, error);
        
        if (error.error?.code === 'TIMEOUT' || error.error?.code === 'TIMEOUT_EXCEPTION') {
          alert('A operação excedeu o tempo limite. O cadastro pode ter sido rejeitado. Por favor, recarregue a página.');
        } else if (error.error?.code === 'USER_NOT_FOUND') {
          alert('Usuário não encontrado no sistema.');
        } else if (error.status === 403) {
          alert('Você não tem permissão para rejeitar usuários.');
        } else if (error.status === 504 || error.status === 502) {
          alert('Erro de conexão ao processar a rejeição. Por favor, tente novamente.');
        } else {
          const errorMsg = error.error?.detail || error.error?.message || 'Falha ao rejeitar cadastro.';
          alert(errorMsg);
        }
      }
    });
  }

  setRole(user: ManagedUser, role: 'TEACHER' | 'STUDENT'): void {
    if (user.role === role) {
      return;
    }

    this.userManagementService.updateUserRole(user.id, role).subscribe({
      next: () => this.loadManagedUsersPage(this.usersPage),
      error: () => alert('Falha ao atualizar papel do usuário.')
    });
  }

  expirePassword(user: ManagedUser): void {
    this.userManagementService.expireUserPassword(user.id).subscribe({
      next: () => this.loadManagedUsersPage(this.usersPage),
      error: () => alert('Falha ao solicitar troca de senha.')
    });
  }

  previousUsersPage(): void {
    if (this.usersPage <= 0) {
      return;
    }

    this.loadManagedUsersPage(this.usersPage - 1);
  }

  nextUsersPage(): void {
    if (this.usersPage + 1 >= this.totalUserPages) {
      return;
    }

    this.loadManagedUsersPage(this.usersPage + 1);
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

  toNumberId(id: string | number): number {
    return Number(id);
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
