import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Video } from '../models/video.model';
import { AuthService } from '../services/auth.service';
import { VideoService } from '../services/video.service';
import { StreamGatewayService } from '../services/stream-gateway.service';

interface FlvJsPlayer {
  attachMediaElement(videoElement: HTMLVideoElement): void;
  load(): void;
  play(): Promise<void>;
  destroy(): void;
}

interface FlvJsModule {
  isSupported(): boolean;
  createPlayer(config: {
    type: 'flv';
    url: string;
    isLive: boolean;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    cors?: boolean;
  }): FlvJsPlayer;
}

@Component({
  standalone: false,
  selector: 'app-video-player',
  template: `
    <div class="video-player-container">
      <button class="btn-back" (click)="goBack()">← Voltar</button>

      <div class="live-waiting" *ngIf="isLiveRoute && liveStatus === 'ACTIVE'">
        <p>Transmissão em andamento.</p>
      </div>

      <div class="player-wrapper" *ngIf="video">
        <video
          #videoPlayer
          class="video-player"
          [attr.src]="useNativeSource ? videoSource : null"
          controls
          width="100%"
          autoplay>
          Your browser does not support the video tag.
        </video>
        <div class="live-indicator" *ngIf="isLiveRoute && liveStatus === 'ACTIVE'">
          <span class="live-badge">● LIVE</span>
        </div>
      </div>

      <div class="video-details" *ngIf="video">
        <h2>{{ video.title }}</h2>
        <div class="meta-info">
          <span class="teacher">by {{ video.teacherName || 'Sistema' }}</span>
          <span class="date" *ngIf="video.uploadedAt">{{ video.uploadedAt | date }}</span>
          <span class="badge" [class.live]="isLiveRoute">{{ isLiveRoute ? 'LIVE' : 'RECORDED' }}</span>
          <span class="badge" [class.public]="video.isPublic">{{ video.isPublic ? 'PUBLIC' : 'PRIVATE' }}</span>
        </div>
        <div class="description">
          <h3>Description</h3>
          <p>{{ video.description || 'No description provided' }}</p>
        </div>
      </div>

      <div class="loading" *ngIf="loading">
        <p>Loading video...</p>
      </div>

      <div class="error" *ngIf="error">
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [``]
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayerRef?: ElementRef<HTMLVideoElement>;

  video: Video | null = null;
  videoSource: string = '';
  useNativeSource = true;
  loading = true;
  error = '';
  isLiveRoute = false;
  liveStatus: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND' = 'NOT_FOUND';
  liveId: string = '';

  private statusSubscription?: Subscription;
  private flvPlayer?: FlvJsPlayer;
  private playbackTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly playbackTimeoutMs = 30000;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private videoService: VideoService,
    private streamGatewayService: StreamGatewayService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const liveId = this.route.snapshot.paramMap.get('liveId');

    if (liveId) {
      this.isLiveRoute = true;
      this.loadLiveVideo(liveId);
      return;
    }

    if (!id) {
      this.loading = false;
      this.error = 'Video not found';
      return;
    }

    this.loadRecordedVideo(Number(id));
  }

  ngOnDestroy(): void {
    this.statusSubscription?.unsubscribe();
    this.clearPlaybackTimeout();
    this.destroyFlvPlayer();
  }

  goBack(): void {
    if (this.authService.hasRole('ADMIN')) {
      this.router.navigate(['/admin']);
      return;
    }

    if (this.authService.hasRole('TEACHER')) {
      this.router.navigate(['/teacher']);
      return;
    }

    if (this.authService.hasRole('STUDENT')) {
      this.router.navigate(['/student']);
      return;
    }

    this.router.navigate(['/home']);
  }

  private loadRecordedVideo(id: number): void {
    this.videoService.getVideo(id).pipe(timeout(10000)).subscribe({
      next: (video) => {
        this.video = video;
        this.videoSource = this.resolveVideoUrl(video.streamingUrl);
        this.loading = false;
        this.debug('Recorded video loaded', {
          id: video.id,
          wasLive: video.wasLive,
          rawUrl: video.streamingUrl,
          resolvedUrl: this.videoSource
        });

        setTimeout(() => this.setupRecordedPlayback(), 0);
        this.videoService.trackVideoAccess(video.id).subscribe();
      },
      error: (err) => {
        this.loading = false;
        this.debug('Failed to load video metadata', { id, error: err });
        this.error = 'Falha ao carregar metadados do vídeo (timeout/erro de rede).';
      }
    });
  }

  private loadLiveVideo(liveId: string): void {
    this.liveId = liveId;
    this.video = {
      id: 0,
      title: `Live ${liveId}`,
      description: 'Transmissão ao vivo via OBS',
      teacherId: 0,
      teacherName: 'OBS',
      duration: 0,
      isLive: true,
      isPublic: true,
      uploadedAt: new Date(),
      streamingUrl: this.streamGatewayService.getLiveFlvUrl(liveId)
    };

    this.videoSource = this.resolveVideoUrl(this.streamGatewayService.getLiveFlvUrl(liveId));
    this.debug('Live route detected', { liveId, liveFlvUrl: this.videoSource });
    this.loading = false;

    this.videoService.getLiveStreamStatus(liveId).pipe(timeout(10000)).subscribe({
      next: (status) => {
        this.liveStatus = status.status;
        this.debug('Initial live status', { liveId, status: this.liveStatus });
        this.setupLivePlayback();
      },
      error: (err) => {
        this.debug('Failed to check live status', { liveId, error: err });
        this.error = 'Falha ao consultar status da transmissão.';
      }
    });

    this.statusSubscription = interval(10000).subscribe(() => {
      this.videoService.getLiveStreamStatus(liveId).subscribe({
        next: (status) => {
          const previous = this.liveStatus;
          this.liveStatus = status.status;
          this.debug('Polled live status', { liveId, previous, current: this.liveStatus });
          if (previous !== this.liveStatus) {
            this.setupLivePlayback();
          }
        },
        error: (err) => {
          this.debug('Live status polling failed', { liveId, error: err });
        }
      });
    });
  }

  private setupLivePlayback(): void {
    this.destroyFlvPlayer();

    if (this.liveStatus === 'ACTIVE') {
      this.useNativeSource = false;
      this.debug('Configuring LIVE FLV playback', { liveId: this.liveId, url: this.videoSource });
      this.setupFlvPlayback();
      return;
    }

    this.useNativeSource = true;
    this.videoSource = this.resolveVideoUrl(this.streamGatewayService.getRecordingUrl(this.liveId));
    this.debug('Live ended, switching to recording URL', { liveId: this.liveId, recordingUrl: this.videoSource });
    setTimeout(() => this.setupRecordedPlayback(), 0);
  }

  private setupRecordedPlayback(): void {
    this.destroyFlvPlayer();

    if (!this.videoSource) {
      this.useNativeSource = true;
      return;
    }

    const lowerSource = this.videoSource.toLowerCase();
    const isFlvRecording =
      lowerSource.includes('/recording') ||
      lowerSource.endsWith('.flv') ||
      !!this.video?.wasLive;

    if (!isFlvRecording) {
      this.useNativeSource = true;
      const element = this.videoPlayerRef?.nativeElement;
      if (element) {
        this.attachPlaybackDiagnostics(element, this.videoSource, 'native');
        this.startPlaybackTimeout('native', this.videoSource);
      }
      this.debug('Using native playback', { url: this.videoSource, isFlvRecording });
      return;
    }

    this.useNativeSource = false;
    this.debug('Using FLV playback for recorded stream', { url: this.videoSource, isFlvRecording });
    this.setupFlvPlayback(false, this.videoSource);
  }

  private async setupFlvPlayback(isLive = true, sourceUrl?: string, attempt = 0): Promise<void> {
    const videoElement = this.videoPlayerRef?.nativeElement;
    if (!videoElement) {
      if (attempt < 8) {
        setTimeout(() => this.setupFlvPlayback(isLive, sourceUrl, attempt + 1), 120);
      } else {
        this.error = 'Player de vídeo não inicializou corretamente.';
        this.debug('Video element not available after retries', { isLive, sourceUrl });
      }
      return;
    }

    try {
      const module = await import('flv.js');
      const flvjs = (module.default || module) as unknown as FlvJsModule;
      if (!flvjs?.isSupported?.()) {
        this.error = 'Seu navegador não suporta reprodução ao vivo FLV.';
        this.debug('flv.js not supported in current browser');
        return;
      }

      const resolvedUrl = this.resolveVideoUrl(sourceUrl || this.streamGatewayService.getLiveFlvUrl(this.liveId));
      const token = this.authService.getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      this.attachPlaybackDiagnostics(videoElement, resolvedUrl, isLive ? 'flv-live' : 'flv-recording');
      this.startPlaybackTimeout(isLive ? 'flv-live' : 'flv-recording', resolvedUrl);

      this.flvPlayer = flvjs.createPlayer({
        type: 'flv',
        url: resolvedUrl,
        isLive,
        headers,
        withCredentials: false,
        cors: true
      });
      this.flvPlayer.attachMediaElement(videoElement);
      this.flvPlayer.load();
      await this.flvPlayer.play();
      this.debug('FLV playback started', { mode: isLive ? 'live' : 'recorded', url: resolvedUrl });
    } catch (err) {
      this.error = 'Falha ao carregar a transmissão (FLV).';
      this.debug('FLV playback failed', { mode: isLive ? 'live' : 'recorded', sourceUrl, error: err });
    }
  }

  private destroyFlvPlayer(): void {
    if (!this.flvPlayer) {
      return;
    }

    this.flvPlayer.destroy();
    this.flvPlayer = undefined;
  }

  private resolveVideoUrl(url: string | undefined): string {
    if (!url) {
      return '';
    }

    try {
      const resolved = new URL(url, window.location.origin).toString();
      return resolved;
    } catch {
      this.debug('Invalid URL received from API/player source', { url });
      return url;
    }
  }

  private attachPlaybackDiagnostics(videoElement: HTMLVideoElement, url: string, mode: 'native' | 'flv-live' | 'flv-recording'): void {
    videoElement.onloadedmetadata = () => this.debug('Video metadata loaded', { mode, url, duration: videoElement.duration });
    videoElement.onloadeddata = () => this.debug('Video data loaded', { mode, url });
    videoElement.onplaying = () => {
      this.debug('Video playing', { mode, url });
      this.clearPlaybackTimeout();
    };
    videoElement.onwaiting = () => this.debug('Video waiting/buffering', { mode, url });
    videoElement.onstalled = () => this.debug('Video stalled', { mode, url });
    videoElement.onerror = () => {
      const mediaError = videoElement.error;
      this.debug('Video element error', {
        mode,
        url,
        code: mediaError?.code,
        message: mediaError?.message
      });
    };
  }

  private startPlaybackTimeout(mode: string, url: string): void {
    this.clearPlaybackTimeout();
    this.playbackTimeoutId = setTimeout(() => {
      this.error = 'Tempo limite ao iniciar reprodução. Verifique a URL/stream no console.';
      this.debug('Playback timeout reached', { mode, url, timeoutMs: this.playbackTimeoutMs });
    }, this.playbackTimeoutMs);
  }

  private clearPlaybackTimeout(): void {
    if (!this.playbackTimeoutId) {
      return;
    }

    clearTimeout(this.playbackTimeoutId);
    this.playbackTimeoutId = undefined;
  }

  private debug(message: string, details?: unknown): void {
    if (details !== undefined) {
      console.log('[VideoPlayer Debug]', message, details);
      return;
    }

    console.log('[VideoPlayer Debug]', message);
  }
}
