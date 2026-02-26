export interface Stream {
  id: number;
  videoId: number;
  liveId: string;
  teacherId: number;
  teacherName: string;
  title: string;
  description: string;
  status: StreamStatus;
  startTime: Date;
  endTime?: Date;
  timeSpent: number; // in seconds
  timeOngoing: number; // in seconds (current duration)
  viewerCount: number;
  isPublic: boolean;
  thumbnailPath?: string;
  streamUrl?: string;
  recordingPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  id: number;
  streamId: number;
  sequenceNumber: number;
  data: Blob;
  timestamp: Date;
  duration: number; // chunk duration in ms
}

export interface StreamRequest {
  title: string;
  description: string;
  isPublic: boolean;
  liveId?: string;
}

export interface StreamResponse {
  id: number;
  liveId: string;
  message: string;
  status: StreamStatus;
}

export enum StreamStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}
