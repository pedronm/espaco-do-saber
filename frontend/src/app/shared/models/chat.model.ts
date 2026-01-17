export interface ChatMessage {
  id: number;
  sender: {
    id: number;
    username: string;
  };
  receiver?: {
    id: number;
    username: string;
  };
  message: string;
  sentAt: Date;
  isRead: boolean;
  videoId?: number;
}
