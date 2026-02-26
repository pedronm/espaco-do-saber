import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { Video } from '../models/video.model';
import { AuthService } from '../services/auth.service';
import { VideoService } from '../services/video.service';
import { WebRtcSignalingService } from '../services/webrtc-signaling.service';
import { environment } from '../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-video-player',
  template: `
    <div class="video-player-container">
      <button class="btn-back" (click)="goBack()">← Back</button>

      <div class="live-waiting" *ngIf="isLiveRoute && liveStatus === 'ACTIVE'">
        <p>Transmissão em andamento. O player pode ter alguns segundos de atraso.</p>
        <p class="refresh-info">Verificando status novamente em {{ secondsToNextCheck }}s</p>
        <button class="btn-refresh" (click)="refreshLivePlayback()">Atualizar transmissão</button>
      </div>

      <div class="webrtc-debug" *ngIf="isLiveRoute && showWebRtcDebug">
        <p><strong>Live Mode:</strong> {{ livePlaybackStrategy }}</p>
        <p><strong>PC State:</strong> {{ webrtcConnectionState }}</p>
        <p><strong>ICE State:</strong> {{ webrtcIceConnectionState }}</p>
        <p><strong>Signal State:</strong> {{ webrtcSignalingState }}</p>
        <p><strong>Remote Tracks:</strong> {{ webrtcRemoteTrackCount }}</p>
        <p><strong>Candidate Cursor:</strong> {{ webrtcViewerCandidateSinceId }}</p>
      </div>

      <div class="player-wrapper" *ngIf="video">
        <video
          *ngIf="isLiveRoute"
          #videoPlayer
          class="video-player"
          controls
          width="100%"
          (play)="onVideoPlay()"
          (pause)="onVideoPause()"
          (stalled)="onVideoStalled()"
          (error)="onVideoPlaybackError()"
          (ended)="onVideoEnded()"
          autoplay>
          Your browser does not support the video tag.
        </video>
        <video
          *ngIf="!isLiveRoute"
          #videoPlayer
          class="video-player"
          [src]="video.streamingUrl"
          controls
          width="100%"
          (play)="onVideoPlay()"
          (pause)="onVideoPause()"
          (ended)="onVideoEnded()"
          autoplay>
          Your browser does not support the video tag.
        </video>
        <div class="live-indicator" *ngIf="shouldShowLiveIndicator()">
          <span class="live-badge">● LIVE</span>
        </div>
      </div>

      <div class="video-details" *ngIf="video">
        <h2>{{ video.title }}</h2>
        <div class="meta-info">
          <span class="teacher">by {{ video.teacherName }}</span>
          <span class="date">{{ video.uploadedAt | date }}</span>
          <span class="badge" [class.live]="shouldShowLiveIndicator()">{{ shouldShowLiveIndicator() ? 'LIVE' : 'RECORDED' }}</span>
          <span class="badge" [class.public]="video.isPublic">{{ video.isPublic ? 'PUBLIC' : 'PRIVATE' }}</span>
        </div>
        <div class="description">
          <h3>Description</h3>
          <p>{{ video.description || 'No description provided' }}</p>
        </div>
        <div class="video-stats">
          <div class="stat">
            <span class="stat-label">Duration:</span>
            <span class="stat-value">{{ formatDuration(video.duration) }}</span>
          </div>
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
  styles: [`
    .video-player-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .btn-back {
      display: inline-block;
      margin-bottom: 1.5rem;
      padding: 0.5rem 1rem;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.3s;
    }

    .btn-back:hover {
      background: #e0e0e0;
    }

    .live-waiting {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      color: #856404;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .webrtc-debug {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      color: #334155;
      font-size: 0.85rem;
    }

    .webrtc-debug p {
      margin: 0.2rem 0;
    }

    .refresh-info {
      margin-top: 0.5rem;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;
    }

    .btn-refresh {
      background: #856404;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0.4rem 0.8rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .btn-refresh:hover {
      opacity: 0.9;
    }

    .player-wrapper {
      background: #000;
      padding: 0;
      margin-bottom: 2rem;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }

    .video-player {
      width: 100%;
      height: auto;
      display: block;
    }

    .live-indicator {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
    }

    .live-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: rgba(244, 67, 54, 0.9);
      color: white;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.9rem;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    .video-details {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    h2 {
      margin: 0 0 1rem 0;
      color: #333;
      font-size: 1.8rem;
    }

    .meta-info {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .teacher {
      color: #666;
      font-size: 0.95rem;
    }

    .date {
      color: #999;
      font-size: 0.9rem;
    }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #e0e0e0;
      color: #555;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .badge.live {
      background: #f44336;
      color: white;
    }

    .badge.public {
      background: #4caf50;
      color: white;
    }

    .description {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #eee;
    }

    .description h3 {
      margin: 0 0 0.5rem 0;
      color: #555;
      font-size: 1rem;
    }

    .description p {
      margin: 0;
      color: #666;
      line-height: 1.6;
    }

    .video-stats {
      display: flex;
      gap: 2rem;
    }

    .stat {
      display: flex;
      gap: 0.5rem;
    }

    .stat-label {
      font-weight: 600;
      color: #555;
    }

    .stat-value {
      color: #666;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .error {
      background: #ffebee;
      color: #c62828;
      padding: 1.5rem;
      border-radius: 4px;
      margin: 1rem 0;
    }

    @media (max-width: 768px) {
      .video-player-container {
        padding: 1rem;
      }

      h2 {
        font-size: 1.4rem;
      }

      .meta-info {
        flex-direction: column;
        align-items: flex-start;
      }

      .video-stats {
        flex-direction: column;
        gap: 1rem;
      }
    }
  `]
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoPlayer') videoPlayer!: ElementRef<HTMLVideoElement>;

  video: Video | null = null;
  loading = false;
  error: string | null = null;
  videoId: number | null = null;
  liveId: string | null = null;
  isLiveRoute = false;
  liveStatus: 'ACTIVE' | 'COMPLETED' | 'NOT_FOUND' | null = null;
  secondsToNextCheck = 3;

  private liveStatusPolling: Subscription | null = null;
  private liveBlobPolling: Subscription | null = null;
  private liveRecordingObjectUrl: string | null = null;
  private usingRecordingFallback = false;
  private lastRecoveryAt = 0;
  private lastLiveBlobSize = 0;
  private isUpdatingLiveSource = false;
  readonly livePlaybackStrategy = environment.livePlaybackStrategy;
  readonly showWebRtcDebug = !environment.production;
  private readonly webrtcIceServers = environment.webrtcIceServers || [];
  private webrtcPeerConnection: RTCPeerConnection | null = null;
  private webrtcOfferPolling: Subscription | null = null;
  private webrtcCandidatePolling: Subscription | null = null;
  webrtcViewerCandidateSinceId = 0;
  private webrtcNegotiationTimeout: ReturnType<typeof setTimeout> | null = null;
  private webrtcRemoteStream: MediaStream | null = null;
  private savedRecordingObjectUrl: string | null = null;
  webrtcConnectionState = 'idle';
  webrtcIceConnectionState = 'new';
  webrtcSignalingState = 'stable';
  webrtcRemoteTrackCount = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService,
    private authService: AuthService,
    private webrtcSignalingService: WebRtcSignalingService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const idParam = params['id'];
      this.videoId = idParam ? Number(idParam) : null;
      this.liveId = params['liveId'];

      if (this.liveId) {
        this.isLiveRoute = true;
        this.loadLiveStream(this.liveId);
        return;
      }

      this.isLiveRoute = false;
      this.stopLiveStatusPolling();
      this.stopWebRtcViewerSession();
      this.cleanupSavedRecordingObjectUrl();

      if (this.videoId && Number.isFinite(this.videoId) && this.videoId > 0) {
        this.loadVideo(this.videoId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyLiveHlsInstance();
    this.stopLiveStatusPolling();
    this.stopLiveBlobPolling();
    this.stopWebRtcViewerSession();
    this.cleanupSavedRecordingObjectUrl();
  }

  loadLiveStream(liveId: string): void {
    this.loading = false;
    this.error = null;
    this.liveStatus = 'ACTIVE';

    this.video = {
      id: 0,
      title: 'Transmissão ao vivo',
      description: 'Transmissão ativa em andamento',
      teacherId: 0,
      teacherName: 'Ao vivo',
      duration: 0,
      isLive: true,
      isPublic: true,
      uploadedAt: new Date(),
      streamingUrl: this.buildLiveHlsManifestUrl(liveId)
    };

    this.lastLiveBlobSize = 0;
    this.startLiveStatusPolling(liveId);
    this.startLiveBlobPolling();
    setTimeout(() => this.initializeLivePlayback(), 0);
  }

  loadVideo(id: number): void {
    this.loading = true;
    this.error = null;

    this.videoService.getVideo(id).subscribe({
      next: (video) => {
        this.cleanupSavedRecordingObjectUrl();
        this.video = video;
        this.loading = false;

        if (this.isSavedLiveRecordingUrl(video.streamingUrl)) {
          this.loadSavedRecordingWithAuth(video.streamingUrl);
        }
      },
      error: (error) => {
        this.error = error.error?.message || 'Failed to load video. Please try again.';
        this.loading = false;
      }
    });
  }

  private startLiveStatusPolling(liveId: string): void {
    this.stopLiveStatusPolling();
    this.secondsToNextCheck = 3;
    this.checkLiveStatus(liveId);

    this.liveStatusPolling = interval(1000).subscribe(() => {
      this.secondsToNextCheck -= 1;
      if (this.secondsToNextCheck <= 0) {
        this.checkLiveStatus(liveId);
        this.secondsToNextCheck = 3;
      }
    });
  }

  private checkLiveStatus(liveId: string): void {
    this.videoService.getLiveStreamStatus(liveId).subscribe({
      next: (status) => {
        this.liveStatus = status.status;

        if (status.status === 'COMPLETED' && status.videoId) {
          this.stopLiveStatusPolling();
          this.stopLiveBlobPolling();
          this.stopWebRtcViewerSession();
          this.router.navigate(['/video', status.videoId]);
          return;
        }

        if (status.status === 'NOT_FOUND') {
          this.error = 'Transmissão não encontrada.';
        }
      },
      error: () => {
        this.error = 'Falha ao verificar status da transmissão.';
      }
    });
  }

  private stopLiveStatusPolling(): void {
    if (this.liveStatusPolling) {
      this.liveStatusPolling.unsubscribe();
      this.liveStatusPolling = null;
    }
  }

  private startLiveBlobPolling(): void {
    this.stopLiveBlobPolling();
    this.liveBlobPolling = interval(3000).subscribe(() => {
      if (!this.isLiveRoute || this.liveStatus !== 'ACTIVE' || !this.liveId || !this.videoPlayer?.nativeElement) {
        return;
      }

      this.loadLiveRecordingFallback(this.liveId, this.videoPlayer.nativeElement, false);
    });
  }

  private stopLiveBlobPolling(): void {
    if (this.liveBlobPolling) {
      this.liveBlobPolling.unsubscribe();
      this.liveBlobPolling = null;
    }
  }

  refreshLivePlayback(liveId?: string): void {
    if (!this.video) {
      return;
    }

    const activeLiveId = liveId ?? this.liveId;
    if (!activeLiveId) {
      return;
    }

    this.video.streamingUrl = this.buildLiveHlsManifestUrl(activeLiveId);
    this.initializeLivePlayback();
  }

  private initializeLivePlayback(): void {
    if (!this.isLiveRoute || !this.video || !this.videoPlayer?.nativeElement) {
      return;
    }

    const videoElement = this.videoPlayer.nativeElement;
    this.usingRecordingFallback = false;

    this.destroyLiveHlsInstance();
    this.stopWebRtcViewerSession();

    if (this.liveId) {
      if (this.livePlaybackStrategy === 'webrtc') {
        const webrtcStarted = this.tryInitializeWebRtcPlayback(this.liveId, videoElement);
        if (webrtcStarted) {
          return;
        }
        console.warn('[LIVE_PLAYER] WebRTC initialization failed, falling back to blob mode.');
      } else if (this.livePlaybackStrategy !== 'blob') {
        console.warn(`[LIVE_PLAYER] Unsupported strategy "${this.livePlaybackStrategy}", falling back to blob mode.`);
      }
      this.loadLiveRecordingFallback(this.liveId, videoElement, true);
    }
  }

  private tryInitializeWebRtcPlayback(liveId: string, videoElement: HTMLVideoElement): boolean {
    if (typeof RTCPeerConnection === 'undefined') {
      console.warn('[LIVE_PLAYER][WEBRTC] RTCPeerConnection unavailable in this browser.');
      return false;
    }

    console.info('[LIVE_PLAYER][WEBRTC] starting viewer session', {
      liveId,
      iceServers: this.webrtcIceServers
    });

    this.stopLiveBlobPolling();
    this.stopWebRtcViewerSession();
    this.webrtcViewerCandidateSinceId = 0;

    const connection = new RTCPeerConnection({
      iceServers: this.webrtcIceServers
    });
    this.webrtcPeerConnection = connection;
    this.webrtcConnectionState = connection.connectionState;
    this.webrtcIceConnectionState = connection.iceConnectionState;
    this.webrtcSignalingState = connection.signalingState;
    this.webrtcRemoteTrackCount = 0;

    this.webrtcRemoteStream = new MediaStream();
    videoElement.srcObject = this.webrtcRemoteStream;

    connection.addTransceiver('video', { direction: 'recvonly' });
    connection.addTransceiver('audio', { direction: 'recvonly' });

    connection.ontrack = (event) => {
      event.streams.forEach((stream) => {
        stream.getTracks().forEach((track) => {
          if (!this.webrtcRemoteStream?.getTracks().some(t => t.id === track.id)) {
            this.webrtcRemoteStream?.addTrack(track);
          }
        });
      });

      this.webrtcRemoteTrackCount = this.webrtcRemoteStream?.getTracks().length || 0;

      if (videoElement.paused) {
        void videoElement.play().catch(() => undefined);
      }

      console.info('[LIVE_PLAYER][WEBRTC] remote track received', {
        liveId,
        remoteTrackCount: this.webrtcRemoteTrackCount
      });
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      this.webrtcSignalingService.postCandidate(liveId, 'viewer', event.candidate).subscribe({
        next: (response) => {
          console.debug('[LIVE_PLAYER][WEBRTC] local candidate posted', response);
        },
        error: (error) => {
          console.error('[LIVE_PLAYER][WEBRTC] failed posting local candidate', error);
        }
      });
    };

    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      this.webrtcConnectionState = state;
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        this.fallbackToBlobFromWebRtc(liveId, videoElement);
      }
    };

    connection.oniceconnectionstatechange = () => {
      this.webrtcIceConnectionState = connection.iceConnectionState;
      console.info('[LIVE_PLAYER][WEBRTC] ice connection state', connection.iceConnectionState);
    };

    connection.onsignalingstatechange = () => {
      this.webrtcSignalingState = connection.signalingState;
      console.info('[LIVE_PLAYER][WEBRTC] signaling state', connection.signalingState);
    };

    this.startWebRtcOfferPolling(liveId, connection, videoElement);
    this.startWebRtcCandidatePolling(liveId, connection);

    if (this.webrtcNegotiationTimeout) {
      clearTimeout(this.webrtcNegotiationTimeout);
      this.webrtcNegotiationTimeout = null;
    }
    this.webrtcNegotiationTimeout = setTimeout(() => {
      if (this.webrtcPeerConnection === connection && connection.connectionState !== 'connected') {
        this.fallbackToBlobFromWebRtc(liveId, videoElement);
      }
    }, 12000);

    return true;
  }

  private startWebRtcOfferPolling(liveId: string, connection: RTCPeerConnection, videoElement: HTMLVideoElement): void {
    this.stopWebRtcOfferPolling();

    this.webrtcOfferPolling = interval(1000).subscribe(() => {
      if (this.webrtcPeerConnection !== connection || connection.currentRemoteDescription) {
        return;
      }

      this.webrtcSignalingService.getOffer(liveId).subscribe({
        next: (offer) => {
          if (!offer.available || !offer.sdp) {
            return;
          }

          console.info('[LIVE_PLAYER][WEBRTC] remote offer received');

          void connection.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
            .then(() => connection.createAnswer())
            .then((answer) => connection.setLocalDescription(answer).then(() => answer))
            .then((answer) => this.webrtcSignalingService.postAnswer(liveId, answer).subscribe({
              next: () => {
                console.info('[LIVE_PLAYER][WEBRTC] local answer posted');
                this.stopWebRtcOfferPolling();
              },
              error: () => this.fallbackToBlobFromWebRtc(liveId, videoElement)
            }))
            .catch(() => this.fallbackToBlobFromWebRtc(liveId, videoElement));
        },
        error: () => undefined
      });
    });
  }

  private startWebRtcCandidatePolling(liveId: string, connection: RTCPeerConnection): void {
    this.stopWebRtcCandidatePolling();

    this.webrtcCandidatePolling = interval(1000).subscribe(() => {
      if (this.webrtcPeerConnection !== connection) {
        return;
      }

      this.webrtcSignalingService.getCandidates(liveId, 'viewer', this.webrtcViewerCandidateSinceId).subscribe({
        next: (response) => {
          if (response.nextSinceId > this.webrtcViewerCandidateSinceId) {
            this.webrtcViewerCandidateSinceId = response.nextSinceId;
          }

          response.items.forEach((item) => {
            if (!item.candidate) {
              return;
            }

            console.debug('[LIVE_PLAYER][WEBRTC] applying remote ICE candidate', item.id);
            void connection.addIceCandidate({
              candidate: item.candidate,
              sdpMid: item.sdpMid,
              sdpMLineIndex: item.sdpMLineIndex
            }).catch(() => undefined);
          });
        },
        error: () => undefined
      });
    });
  }

  private stopWebRtcOfferPolling(): void {
    if (this.webrtcOfferPolling) {
      this.webrtcOfferPolling.unsubscribe();
      this.webrtcOfferPolling = null;
    }
  }

  private stopWebRtcCandidatePolling(): void {
    if (this.webrtcCandidatePolling) {
      this.webrtcCandidatePolling.unsubscribe();
      this.webrtcCandidatePolling = null;
    }
  }

  private stopWebRtcViewerSession(): void {
    this.stopWebRtcOfferPolling();
    this.stopWebRtcCandidatePolling();

    if (this.webrtcNegotiationTimeout) {
      clearTimeout(this.webrtcNegotiationTimeout);
      this.webrtcNegotiationTimeout = null;
    }

    if (this.webrtcPeerConnection) {
      this.webrtcPeerConnection.onicecandidate = null;
      this.webrtcPeerConnection.ontrack = null;
      this.webrtcPeerConnection.onconnectionstatechange = null;
      this.webrtcPeerConnection.oniceconnectionstatechange = null;
      this.webrtcPeerConnection.onsignalingstatechange = null;
      this.webrtcPeerConnection.close();
      this.webrtcPeerConnection = null;
    }

    this.webrtcRemoteStream?.getTracks().forEach((track) => track.stop());
    this.webrtcRemoteStream = null;

    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.srcObject = null;
    }

    this.webrtcConnectionState = 'closed';
    this.webrtcIceConnectionState = 'closed';
    this.webrtcSignalingState = 'closed';
    this.webrtcRemoteTrackCount = 0;
  }

  private fallbackToBlobFromWebRtc(liveId: string, videoElement: HTMLVideoElement): void {
    console.warn('[LIVE_PLAYER][WEBRTC] fallback to blob mode', { liveId });
    this.stopWebRtcViewerSession();
    this.startLiveBlobPolling();
    this.loadLiveRecordingFallback(liveId, videoElement, true);
  }

  private loadLiveRecordingFallback(liveId: string, videoElement: HTMLVideoElement, forceSwap: boolean): void {
    if (this.isUpdatingLiveSource) {
      return;
    }

    this.isUpdatingLiveSource = true;
    this.usingRecordingFallback = true;
    const previousTime = Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0;
    const wasPaused = videoElement.paused;

    this.videoService.getLiveRecordingBlob(liveId).subscribe({
      next: (blob) => {
        console.debug('[LIVE_FALLBACK] blob received', { liveId, size: blob.size, type: blob.type });

        const hasGrown = blob.size > this.lastLiveBlobSize;
        if (!forceSwap && !hasGrown) {
          this.isUpdatingLiveSource = false;
          return;
        }

        const duration = Number.isFinite(videoElement.duration) ? videoElement.duration : 0;
        const currentTime = Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0;
        const remaining = duration > 0 ? (duration - currentTime) : 0;
        const isNearLiveEdge = duration > 0 && remaining <= 0.8;
        const shouldSwapNow = forceSwap || videoElement.paused || isNearLiveEdge;

        if (!shouldSwapNow) {
          this.isUpdatingLiveSource = false;
          return;
        }

        this.lastLiveBlobSize = blob.size;

        if (this.liveRecordingObjectUrl) {
          URL.revokeObjectURL(this.liveRecordingObjectUrl);
          this.liveRecordingObjectUrl = null;
        }

        const objectUrl = URL.createObjectURL(blob);
        this.liveRecordingObjectUrl = objectUrl;
        this.video!.streamingUrl = objectUrl;
        videoElement.src = objectUrl;

        const restorePlayback = () => {
          const newDuration = Number.isFinite(videoElement.duration) ? videoElement.duration : 0;
          if (newDuration > 0 && previousTime > 0) {
            const safeTime = Math.min(previousTime, Math.max(0, newDuration - 0.25));
            if (safeTime > 0) {
              videoElement.currentTime = safeTime;
            }
          }

          if (!wasPaused) {
            void videoElement.play().catch(() => undefined);
          }

          videoElement.removeEventListener('loadedmetadata', restorePlayback);
          videoElement.removeEventListener('canplay', restorePlayback);
          this.isUpdatingLiveSource = false;
        };

        videoElement.addEventListener('loadedmetadata', restorePlayback);
        videoElement.addEventListener('canplay', restorePlayback);
        videoElement.load();
      },
      error: (err) => {
        console.error('[LIVE_FALLBACK] failed to load recording blob', { liveId, err });
        this.error = 'Falha ao carregar fallback da gravação ao vivo.';
        this.isUpdatingLiveSource = false;
      }
    });
  }

  private destroyLiveHlsInstance(): void {
    if (this.liveRecordingObjectUrl) {
      URL.revokeObjectURL(this.liveRecordingObjectUrl);
      this.liveRecordingObjectUrl = null;
    }

    if (this.videoPlayer?.nativeElement) {
      this.videoPlayer.nativeElement.removeAttribute('src');
      this.videoPlayer.nativeElement.load();
    }
  }

  private isSavedLiveRecordingUrl(url: string | undefined): boolean {
    if (!url) {
      return false;
    }

    return url.includes('/api/videos/stream/live/') && url.includes('/recording');
  }

  private loadSavedRecordingWithAuth(url: string): void {
    this.videoService.getProtectedMediaBlob(url).subscribe({
      next: (blob) => {
        this.cleanupSavedRecordingObjectUrl();
        const objectUrl = URL.createObjectURL(blob);
        this.savedRecordingObjectUrl = objectUrl;

        if (this.video) {
          this.video.streamingUrl = objectUrl;
        }
      },
      error: () => {
        this.error = 'Falha ao carregar gravação salva com autenticação.';
      }
    });
  }

  private cleanupSavedRecordingObjectUrl(): void {
    if (this.savedRecordingObjectUrl) {
      URL.revokeObjectURL(this.savedRecordingObjectUrl);
      this.savedRecordingObjectUrl = null;
    }
  }

  private buildLiveHlsManifestUrl(liveId: string): string {
    return `/api/videos/stream/live/${liveId}/recording?t=${Date.now()}`;
  }

  onVideoPlay(): void {}

  onVideoPause(): void {}

  onVideoStalled(): void {
    this.tryRecoverLivePlayback();
  }

  onVideoPlaybackError(): void {
    this.tryRecoverLivePlayback();
  }

  private tryRecoverLivePlayback(): void {
    if (!this.isLiveRoute || !this.liveId) {
      return;
    }

    const now = Date.now();
    if (now - this.lastRecoveryAt < 4000) {
      return;
    }
    this.lastRecoveryAt = now;

    if (this.usingRecordingFallback && this.videoPlayer?.nativeElement) {
      this.loadLiveRecordingFallback(this.liveId, this.videoPlayer.nativeElement, false);
      return;
    }

    this.refreshLivePlayback(this.liveId);
  }

  onVideoEnded(): void {
    if (this.isLiveRoute && this.liveStatus === 'ACTIVE') {
      this.tryRecoverLivePlayback();
    }
  }

  formatDuration(seconds: number | null | undefined): string {
    if (!seconds || seconds === 0) {
      return 'Unknown';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
  }

  goBack(): void {
    const targetRoute = this.resolveDashboardRoute();
    this.router.navigateByUrl(targetRoute, { replaceUrl: true }).catch(() => {
      window.location.assign(targetRoute);
    });
  }

  shouldShowLiveIndicator(): boolean {
    return this.isLiveRoute && this.liveStatus === 'ACTIVE';
  }

  private resolveDashboardRoute(): string {
    if (this.authService.hasRole('ADMIN')) {
      return '/admin';
    }

    if (this.authService.hasRole('TEACHER')) {
      return '/teacher';
    }

    return '/student';
  }

}
