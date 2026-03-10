import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Client } from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { ChatMessage } from '../models/chat.model';
import { environment } from '../../../environments/environment';
import { isFeatureOn } from '../constants/feature-flags';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = `${environment.apiUrl}/chat`;
  private stompClient: Client | null = null;

  constructor(private http: HttpClient) {}

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!isFeatureOn('streamOn')) {
        reject(new Error('Chat feature is disabled by flag.'));
        return;
      }

      if (!environment.wsUrl) {
        reject(new Error('Chat websocket is not configured for this deployment.'));
        return;
      }

      const socket = new (SockJS as any)(environment.wsUrl);
      this.stompClient = new Client({
        webSocketFactory: () => socket as any,
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        onConnect: () => {
          resolve();
        },
        onStompError: (frame) => {
          console.error('Broker reported error: ' + frame.headers['message']);
          console.error('Additional details: ' + frame.body);
          reject(frame);
        }
      });

      this.stompClient.activate();
    });
  }

  disconnect(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
    }
  }

  sendMessage(receiverId: number | null, message: string, videoId?: number): void {
    if (this.stompClient && this.stompClient.connected) {
      this.stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify({
          receiverId,
          message,
          videoId
        })
      });
    }
  }

  subscribe(callback: (message: ChatMessage) => void): void {
    if (this.stompClient) {
      this.stompClient.subscribe('/topic/messages', (message) => {
        callback(JSON.parse(message.body));
      });
    }
  }

  getConversation(userId: number): Observable<ChatMessage[]> {
    if (!isFeatureOn('streamOn')) {
      return of([]);
    }

    return this.http.get<ChatMessage[]>(`${this.apiUrl}/conversation/${userId}`);
  }

  getUnreadMessages(): Observable<ChatMessage[]> {
    if (!isFeatureOn('streamOn')) {
      return of([]);
    }

    return this.http.get<ChatMessage[]>(`${this.apiUrl}/unread`);
  }

  markAsRead(messageId: number): Observable<void> {
    if (!isFeatureOn('streamOn')) {
      return of(void 0);
    }

    return this.http.put<void>(`${this.apiUrl}/${messageId}/read`, {});
  }
}
