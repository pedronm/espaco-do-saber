import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WebcamModule, WebcamInitError, WebcamImage } from 'ngx-webcam';
import { Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { VideoService } from '../services/video.service';
import { WebRtcSignalingService } from '../services/webrtc-signaling.service';
import { Stream, StreamStatus } from '../models/stream.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-live-stream',
  standalone: true,
  imports: [CommonModule, WebcamModule],
  template: `
    <div class="live-stream-container">
      <div class="stream-header">
        <h2>Live Stream</h2>
        <button class="btn btn-secondary btn-home" (click)="goHome()">Voltar para Home</button>
      </div>

      <!-- Error Message -->
      <div *ngIf="errorMessage" class="alert alert-error">
        <span class="alert-close" (click)="dismissErrorMessage()">×</span>
        {{ errorMessage }}
      </div>

      <!-- Success Message -->
      <div *ngIf="successMessage" class="alert alert-success">
        <span class="alert-close" (click)="dismissSuccessMessage()">×</span>
        {{ successMessage }}
      </div>

      <!-- Not Initialized -->
      <div *ngIf="!isInitialized" class="alert alert-info">
        <p>Requesting camera access... Please allow access when prompted.</p>
      </div>

      <!-- Webcam Display -->
      <div *ngIf="isInitialized" class="webcam-section">
        <webcam 
          [trigger]="snapshotTrigger$"
          [videoOptions]="{width: 1280, height: 720}"
          (imageCapture)="handleImage($event)"
          (initError)="handleInitError($event)"
        ></webcam>

        <!-- Streamed Frame Preview -->
        <div *ngIf="webcamImage" class="preview-section">
          <h4>Current Frame</h4>
          <img [src]="webcamImage.imageAsDataUrl" alt="streamed frame" />
        </div>
      </div>

      <!-- Controls -->
      <div *ngIf="isInitialized" class="controls-section">
        <button
          class="btn"
          [ngClass]="isStreaming ? 'btn-danger' : 'btn-primary'"
          (click)="toggleStreaming()"
        >
          {{ isStreaming ? 'Stop Stream' : 'Start Stream' }}
        </button>

        <button
          class="btn btn-secondary"
          (click)="captureFrame()"
          [disabled]="!isStreaming"
        >
          Capture Frame
        </button>
      </div>

      <!-- Status Indicator -->
      <div *ngIf="isInitialized" class="status-section">
        <p>
          Status:
          <span [ngClass]="getStatusClass()">
            {{ getStatusLabel() }}
          </span>
        </p>
        <p *ngIf="streamStatus === streamStatusEnum.ACTIVE" class="time-info">
          ⏱️ Time: {{ formatTime(timeOngoing) }}
        </p>
        <p *ngIf="recordedChunks.length > 0" class="chunk-info">
          📦 Chunks sent: {{ recordedChunks.length }}
        </p>
        <p *ngIf="currentStream" class="stream-info">
          🔗 Stream ID: {{ currentStream.liveId }} | Duration: {{ currentStream.timeSpent }}s
        </p>
        <p *ngIf="currentStream && currentStream.viewerCount > 0" class="viewer-info">
          👥 Viewers: {{ currentStream.viewerCount }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    .live-stream-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: Arial, sans-serif;
    }

    .stream-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .btn-home {
      margin-top: 12px;
    }

    .stream-header h2 {
      font-size: 28px;
      color: #333;
      margin: 0;
    }

    /* Alerts */
    .alert {
      position: relative;
      padding: 15px 20px;
      margin-bottom: 20px;
      border-radius: 4px;
      font-size: 14px;
      animation: slideIn 0.3s ease-in-out;
    }

    .alert-close {
      position: absolute;
      right: 10px;
      top: 8px;
      font-size: 20px;
      line-height: 20px;
      cursor: pointer;
      opacity: 0.75;
      user-select: none;
      font-weight: 600;
    }

    .alert-close:hover {
      opacity: 1;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .alert-error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .alert-success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-info {
      background-color: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }

    /* Webcam Section */
    .webcam-section {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }

    .webcam-section ::ng-deep webcam {
      display: block;
      max-width: 100%;
      margin: 0 auto;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      background: #000;
    }

    /* Preview Section */
    .preview-section {
      margin-top: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      border: 1px solid #ddd;
    }

    .preview-section h4 {
      margin-top: 0;
      color: #555;
      font-size: 14px;
    }

    .preview-section img {
      max-width: 100%;
      max-height: 300px;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Controls Section */
    .controls-section {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    /* Buttons */
    .btn {
      padding: 12px 24px;
      font-size: 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary {
      background-color: #007bff;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: #0056b3;
    }

    .btn-danger {
      background-color: #dc3545;
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      background-color: #c82333;
    }

    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: #545b62;
    }

    /* Status Section */
    .status-section {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #ddd;
      text-align: center;
    }

    .status-section p {
      margin: 8px 0;
      font-size: 14px;
      color: #555;
    }

    .status-live {
      font-weight: bold;
      color: #dc3545;
      font-size: 16px;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    .status-idle {
      font-weight: bold;
      color: #6c757d;
      font-size: 16px;
    }

    .status-completed {
      font-weight: bold;
      color: #dc3545;
      font-size: 16px;
    }

    .status-failed {
      font-weight: bold;
      color: #c82333;
      font-size: 16px;
    }

    .chunk-info {
      color: #28a745;
      font-weight: 600;
    }

    .time-info {
      color: #ff6b6b;
      font-weight: 600;
      font-size: 16px;
    }

    .stream-info {
      color: #4ecdc4;
      font-weight: 600;
    }

    .viewer-info {
      color: #ffa07a;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .live-stream-container {
        padding: 10px;
      }

      .stream-header h2 {
        font-size: 20px;
      }

      .controls-section {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }

      .webcam-section {
        padding: 10px;
      }
    }
  `]
})
export class LiveStreamComponent implements OnInit, OnDestroy {
  public isStreaming = false;
  public isInitialized = false;
  public recordedChunks: Blob[] = [];
  public archiveChunks: Blob[] = [];
  public webcamImage: WebcamImage | null = null;
  public mediaRecorder: MediaRecorder | null = null;
  public archiveRecorder: MediaRecorder | null = null;
  public stream: MediaStream | null = null;
  public errorMessage: string | null = null;
  public successMessage: string | null = null;

  // Stream properties
  public currentStream: Stream | null = null;
  public streamStatus: StreamStatus = StreamStatus.INITIALIZING;
  public streamStatusEnum = StreamStatus;
  public timeOngoing = 0;
  public viewerCount = 0;
  public liveId: string = `live_${Date.now()}`;

  public snapshotTrigger$ = new Subject<void>();

  private destroy$ = new Subject<void>();
  private streamSubscription: Subscription | null = null;
  private timeTrackingSubscription: Subscription | null = null;
  private liveStatusSubscription: Subscription | null = null;
  private chunkInterval = 1000; // Send chunk every 1 second
  private streamStartTime: number = 0;
  private chunkSequence = 0;
  private successMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private errorMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private webrtcPeerConnection: RTCPeerConnection | null = null;
  private webrtcAnswerPolling: Subscription | null = null;
  private webrtcCandidatePolling: Subscription | null = null;
  private webrtcPublisherCandidateSinceId = 0;
  private readonly livePlaybackStrategy = environment.livePlaybackStrategy;
  private readonly webrtcIceServers = environment.webrtcIceServers || [];

  constructor(
    private videoService: VideoService,
    private router: Router,
    private webrtcSignalingService: WebRtcSignalingService
  ) {}

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isStreaming) {
      event.preventDefault();
      // event.returnValue = '';
    }
  }

  ngOnInit(): void {
    this.requestCameraAccess();
  }

  ngOnDestroy(): void {
    this.clearNotificationTimers();
    this.stopStreaming();
    this.stopWebRtcPublisher();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
  }

  /**
   * Request access to user's camera
   */
  public requestCameraAccess(): void {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
      .then((mediaStream: MediaStream) => {
        this.stream = mediaStream;
        this.isInitialized = true;
        this.errorMessage = null;
      })
      .catch((error: any) => {
        this.errorMessage = `Camera access denied: ${error.message}`;
        console.error('Camera access error:', error);
      });
  }

  /**
   * Initialize MediaRecorder and start streaming
   */
  public startStreaming(): void {
    if (!this.stream) {
      this.setErrorMessage('Camera access not initialized');
      return;
    }

    try {
      this.isStreaming = true;
      this.recordedChunks = [];
      this.archiveChunks = [];
      this.setSuccessMessage('Stream started...', 3000);
      this.errorMessage = null;

      // Initialize stream tracking
      this.streamStartTime = Date.now();
      this.streamStatus = StreamStatus.ACTIVE;
      this.timeOngoing = 0;
      this.chunkSequence = 0;
      this.liveId = `live_${Date.now()}`;

      if (this.liveStatusSubscription) {
        this.liveStatusSubscription.unsubscribe();
      }
      this.liveStatusSubscription = this.videoService.streamStatus$(this.liveId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((status) => {
          this.streamStatus = status;
          if (status === StreamStatus.COMPLETED || status === StreamStatus.FAILED || status === StreamStatus.CANCELLED) {
            this.isStreaming = false;
          }
        });

      // Setup MediaRecorder to capture video/audio
      const options = {
        mimeType: 'video/webm;codecs=vp8,opus'
      };

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options as any);
      this.archiveRecorder = new MediaRecorder(this.stream, options as any);

      // Collect chunks and send them to backend
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          const currentSequence = this.chunkSequence;
          this.chunkSequence += 1;
          // Send chunk to backend
          this.videoService.streamChunk(event.data, this.liveId, currentSequence).subscribe({
            next: (response) => {
              console.log('Chunk sent successfully', response);
            },
            error: (err) => {
              console.error('Error sending chunk:', err);
              this.setErrorMessage('Error sending stream data to server');
              this.streamStatus = StreamStatus.FAILED;
              this.successMessage = null;
            }
          });
        }
      };

      this.archiveRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.archiveChunks.push(event.data);
        }
      };

      this.archiveRecorder.onerror = (event: Event) => {
        console.error('Archive recorder error:', event);
      };

      this.mediaRecorder.start();
      this.archiveRecorder.start();

      if (this.livePlaybackStrategy === 'webrtc') {
        this.startWebRtcPublisher();
      }

      // Collect data chunks at regular intervals
      this.streamSubscription = interval(this.chunkInterval)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.mediaRecorder && this.isStreaming) {
            this.mediaRecorder.requestData();
          }
        });

      // Track time ongoing
      this.timeTrackingSubscription = interval(1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.timeOngoing = Math.floor((Date.now() - this.streamStartTime) / 1000);
        });

    } catch (error: any) {
      this.setErrorMessage(`Failed to start streaming: ${error.message}`);
      this.isStreaming = false;
      console.error('Streaming error:', error);
    }
  }

  /**
   * Stop the live stream and send final data to backend
   */
  public stopStreaming(): void {
    if (!this.mediaRecorder || !this.archiveRecorder) {
      return;
    }

    this.stopWebRtcPublisher();

    this.isStreaming = false;
    this.streamStatus = StreamStatus.COMPLETED;

    // Stop collecting intervals
    if (this.streamSubscription) {
      this.streamSubscription.unsubscribe();
    }

    // Stop time tracking
    if (this.timeTrackingSubscription) {
      this.timeTrackingSubscription.unsubscribe();
    }

    if (this.liveStatusSubscription) {
      this.liveStatusSubscription.unsubscribe();
      this.liveStatusSubscription = null;
    }

    this.setSuccessMessage('Ending stream...');

    this.mediaRecorder.onstop = () => {
      this.mediaRecorder = null;
    };

    this.archiveRecorder.onstop = () => {
      const finalChunks = this.archiveChunks.length > 0 ? this.archiveChunks : this.recordedChunks;
      const finalRecording = new Blob(finalChunks, { type: 'video/webm' });

      this.videoService.uploadFinalStreamRecording(finalRecording, this.liveId).subscribe({
        next: () => {
          this.videoService.endStream(this.liveId, this.chunkSequence).subscribe({
            next: (response) => {
              this.streamStatus = response.status;
              this.isStreaming = false;
              this.setSuccessMessage(`Stream ended! Live ID: ${response.liveId}`, 5000);
              this.recordedChunks = [];
              this.archiveChunks = [];
              this.archiveRecorder = null;
              console.log('Stream ended successfully', response);
              if (this.livePlaybackStrategy === 'webrtc') {
                this.webrtcSignalingService.reset(this.liveId).subscribe({
                  error: () => undefined
                });
              }
            },
            error: (err) => {
              console.error('Error ending stream:', err);
              this.setErrorMessage(`Error finalizing stream: ${err.message}`);
              this.streamStatus = StreamStatus.FAILED;
              this.isStreaming = false;
              this.archiveRecorder = null;
              this.successMessage = null;
            }
          });
        },
        error: (err) => {
          console.error('Error uploading final recording:', err);
          this.setErrorMessage(`Error uploading final stream recording: ${err.message}`);
          this.streamStatus = StreamStatus.FAILED;
          this.isStreaming = false;
          this.archiveRecorder = null;
          this.successMessage = null;
        }
      });
    };

    // Stop the recorder
    this.mediaRecorder.requestData();
    this.mediaRecorder.stop();
    this.archiveRecorder.stop();
  }

  /**
   * Toggle streaming on/off
   */
  public toggleStreaming(): void {
    if (this.isStreaming) {
      this.stopStreaming();
    } else {
      this.startStreaming();
    }
  }

  /**
   * Capture current frame as image
   */
  public captureFrame(): void {
    this.snapshotTrigger$.next();
  }

  public handleImage(webcamImage: WebcamImage): void {
    this.webcamImage = webcamImage;
  }

  /**
   * Handle webcam errors
   */
  public handleInitError(error: WebcamInitError): void {
    this.setErrorMessage(`Webcam init error: ${error.message}`);
    console.error('Webcam initialization error:', error);
  }

  /**
   * Format seconds to HH:MM:SS
   */
  public formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  public getStatusLabel(): string {
    switch (this.streamStatus) {
      case StreamStatus.ACTIVE:
        return '🔴 LIVE';
      case StreamStatus.COMPLETED:
        return '🔴 STREAM ENDED';
      case StreamStatus.FAILED:
        return '⚠️ STREAM FAILED';
      case StreamStatus.CANCELLED:
        return '⚫ STREAM CANCELLED';
      default:
        return '⚫ READY';
    }
  }

  public getStatusClass(): string {
    switch (this.streamStatus) {
      case StreamStatus.ACTIVE:
        return 'status-live';
      case StreamStatus.COMPLETED:
        return 'status-completed';
      case StreamStatus.FAILED:
      case StreamStatus.CANCELLED:
        return 'status-failed';
      default:
        return 'status-idle';
    }
  }

  public confirmStopOnLeave(): boolean {
    if (!this.isStreaming) {
      return true;
    }

    const confirmed = window.confirm('Uma live está em andamento. Deseja encerrar a transmissão e sair desta página?');
    if (confirmed) {
      this.stopStreaming();
    }
    return confirmed;
  }

  public goHome(): void {
    if (this.isStreaming) {
      const confirmed = window.confirm('Uma live está em andamento. Deseja encerrar a transmissão e voltar para a Home?');
      if (!confirmed) {
        return;
      }
      this.stopStreaming();
    }

    this.router.navigate(['/home']);
  }

  private startWebRtcPublisher(): void {
    if (!this.stream || typeof RTCPeerConnection === 'undefined') {
      console.warn('[WEBRTC_PUBLISHER] unavailable (stream or RTCPeerConnection missing)');
      return;
    }

    this.stopWebRtcPublisher();
    this.webrtcPublisherCandidateSinceId = 0;

    const connection = new RTCPeerConnection({
      iceServers: this.webrtcIceServers
    });

    console.info('[WEBRTC_PUBLISHER] starting', {
      liveId: this.liveId,
      iceServers: this.webrtcIceServers
    });

    this.webrtcPeerConnection = connection;

    this.stream.getTracks().forEach((track) => {
      connection.addTrack(track, this.stream as MediaStream);
    });

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        console.info('[WEBRTC_PUBLISHER] local ICE gathering completed');
        return;
      }

      this.webrtcSignalingService.postCandidate(this.liveId, 'publisher', event.candidate).subscribe({
        next: (response) => {
          console.debug('[WEBRTC_PUBLISHER] local candidate posted', response);
        },
        error: (error) => {
          console.error('[WEBRTC_PUBLISHER] failed posting local candidate', error);
        }
      });
    };

    connection.onconnectionstatechange = () => {
      console.info('[WEBRTC_PUBLISHER] connection state', connection.connectionState);
    };

    connection.oniceconnectionstatechange = () => {
      console.info('[WEBRTC_PUBLISHER] ice connection state', connection.iceConnectionState);
    };

    connection.onsignalingstatechange = () => {
      console.info('[WEBRTC_PUBLISHER] signaling state', connection.signalingState);
    };

    connection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false
    }).then((offer) => {
      return connection.setLocalDescription(offer).then(() => offer);
    }).then((offer) => {
      console.info('[WEBRTC_PUBLISHER] local offer created');
      this.webrtcSignalingService.postOffer(this.liveId, offer).subscribe({
        next: () => {
          console.info('[WEBRTC_PUBLISHER] offer posted');
        },
        error: (error) => {
          console.error('[WEBRTC_PUBLISHER] failed posting offer', error);
        }
      });
      this.startWebRtcAnswerPolling(connection);
      this.startWebRtcPublisherCandidatePolling(connection);
    }).catch((error) => {
      console.error('[WEBRTC_PUBLISHER] failed to initialize offer', error);
      this.stopWebRtcPublisher();
    });
  }

  private startWebRtcAnswerPolling(connection: RTCPeerConnection): void {
    this.stopWebRtcAnswerPolling();
    this.webrtcAnswerPolling = interval(1000).subscribe(() => {
      if (!this.isStreaming || this.webrtcPeerConnection !== connection || connection.currentRemoteDescription) {
        return;
      }

      this.webrtcSignalingService.getAnswer(this.liveId).subscribe({
        next: (answer) => {
          if (!answer.available || !answer.sdp) {
            return;
          }

          console.info('[WEBRTC_PUBLISHER] remote answer received');

          void connection.setRemoteDescription({
            type: 'answer',
            sdp: answer.sdp
          }).then(() => {
            console.info('[WEBRTC_PUBLISHER] remote answer applied');
            this.stopWebRtcAnswerPolling();
          }).catch((err) => {
            console.error('[WEBRTC_PUBLISHER] setRemoteDescription(answer) failed', err);
          });
        },
        error: () => undefined
      });
    });
  }

  private startWebRtcPublisherCandidatePolling(connection: RTCPeerConnection): void {
    this.stopWebRtcCandidatePolling();
    this.webrtcCandidatePolling = interval(1000).subscribe(() => {
      if (!this.isStreaming || this.webrtcPeerConnection !== connection) {
        return;
      }

      this.webrtcSignalingService.getCandidates(this.liveId, 'publisher', this.webrtcPublisherCandidateSinceId).subscribe({
        next: (response) => {
          if (response.nextSinceId > this.webrtcPublisherCandidateSinceId) {
            this.webrtcPublisherCandidateSinceId = response.nextSinceId;
          }

          response.items.forEach((item) => {
            if (!item.candidate) {
              return;
            }

            console.debug('[WEBRTC_PUBLISHER] applying remote ICE candidate', item.id);
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

  private stopWebRtcAnswerPolling(): void {
    if (this.webrtcAnswerPolling) {
      this.webrtcAnswerPolling.unsubscribe();
      this.webrtcAnswerPolling = null;
    }
  }

  private stopWebRtcCandidatePolling(): void {
    if (this.webrtcCandidatePolling) {
      this.webrtcCandidatePolling.unsubscribe();
      this.webrtcCandidatePolling = null;
    }
  }

  private stopWebRtcPublisher(): void {
    this.stopWebRtcAnswerPolling();
    this.stopWebRtcCandidatePolling();

    if (this.webrtcPeerConnection) {
      this.webrtcPeerConnection.onicecandidate = null;
      this.webrtcPeerConnection.onconnectionstatechange = null;
      this.webrtcPeerConnection.oniceconnectionstatechange = null;
      this.webrtcPeerConnection.onsignalingstatechange = null;
      this.webrtcPeerConnection.close();
      this.webrtcPeerConnection = null;
    }
  }

  private setSuccessMessage(message: string, durationMs: number = 0): void {
    if (this.successMessageTimer) {
      clearTimeout(this.successMessageTimer);
      this.successMessageTimer = null;
    }

    this.successMessage = message;

    if (durationMs > 0) {
      this.successMessageTimer = setTimeout(() => {
        this.successMessage = null;
        this.successMessageTimer = null;
      }, durationMs);
    }
  }

  private setErrorMessage(message: string, durationMs: number = 6000): void {
    if (this.errorMessageTimer) {
      clearTimeout(this.errorMessageTimer);
      this.errorMessageTimer = null;
    }

    this.errorMessage = message;

    if (durationMs > 0) {
      this.errorMessageTimer = setTimeout(() => {
        this.errorMessage = null;
        this.errorMessageTimer = null;
      }, durationMs);
    }
  }

  private clearNotificationTimers(): void {
    if (this.successMessageTimer) {
      clearTimeout(this.successMessageTimer);
      this.successMessageTimer = null;
    }

    if (this.errorMessageTimer) {
      clearTimeout(this.errorMessageTimer);
      this.errorMessageTimer = null;
    }
  }

  public dismissSuccessMessage(): void {
    if (this.successMessageTimer) {
      clearTimeout(this.successMessageTimer);
      this.successMessageTimer = null;
    }
    this.successMessage = null;
  }

  public dismissErrorMessage(): void {
    if (this.errorMessageTimer) {
      clearTimeout(this.errorMessageTimer);
      this.errorMessageTimer = null;
    }
    this.errorMessage = null;
  }
}
