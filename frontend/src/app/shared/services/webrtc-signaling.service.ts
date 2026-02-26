import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface SdpPayload {
  liveId: string;
  sdp: string;
  type: 'offer' | 'answer';
}

interface SdpResponse {
  available: boolean;
  sdp?: string;
  type?: 'offer' | 'answer';
  username?: string;
}

interface CandidatePayload {
  liveId: string;
  sourceRole: 'publisher' | 'viewer';
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

interface CandidateItem {
  id: number;
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
  username?: string;
  createdAt?: string;
}

interface CandidateResponse {
  items: CandidateItem[];
  nextSinceId: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebRtcSignalingService {
  private readonly basePath = environment.webrtcSignalingPath || '/api/videos/stream/live/webrtc';

  constructor(private http: HttpClient) {}

  postOffer(liveId: string, description: RTCSessionDescriptionInit): Observable<SdpResponse> {
    const payload: SdpPayload = {
      liveId,
      sdp: description.sdp || '',
      type: 'offer'
    };

    return this.http.post<SdpResponse>(`${this.basePath}/offer`, payload);
  }

  getOffer(liveId: string): Observable<SdpResponse> {
    return this.http.get<SdpResponse>(`${this.basePath}/${liveId}/offer`);
  }

  postAnswer(liveId: string, description: RTCSessionDescriptionInit): Observable<SdpResponse> {
    const payload: SdpPayload = {
      liveId,
      sdp: description.sdp || '',
      type: 'answer'
    };

    return this.http.post<SdpResponse>(`${this.basePath}/answer`, payload);
  }

  getAnswer(liveId: string): Observable<SdpResponse> {
    return this.http.get<SdpResponse>(`${this.basePath}/${liveId}/answer`);
  }

  postCandidate(
    liveId: string,
    sourceRole: 'publisher' | 'viewer',
    candidate: RTCIceCandidate
  ): Observable<{ accepted: boolean; candidateId: number; toRole: 'publisher' | 'viewer' }> {
    const payload: CandidatePayload = {
      liveId,
      sourceRole,
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex
    };

    return this.http.post<{ accepted: boolean; candidateId: number; toRole: 'publisher' | 'viewer' }>(
      `${this.basePath}/candidate`,
      payload
    );
  }

  getCandidates(
    liveId: string,
    targetRole: 'publisher' | 'viewer',
    sinceId: number
  ): Observable<CandidateResponse> {
    let params = new HttpParams().set('targetRole', targetRole);
    if (sinceId > 0) {
      params = params.set('sinceId', String(sinceId));
    }

    return this.http.get<CandidateResponse>(`${this.basePath}/${liveId}/candidates`, { params });
  }

  reset(liveId: string): Observable<{ cleared: boolean }> {
    return this.http.delete<{ cleared: boolean }>(`${this.basePath}/${liveId}`);
  }
}
