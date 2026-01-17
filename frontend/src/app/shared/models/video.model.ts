export interface Video {
  id: number;
  title: string;
  description: string;
  thumbnailPath?: string;
  teacherId: number;
  teacherName: string;
  duration: number;
  isLive: boolean;
  isPublic: boolean;
  uploadedAt: Date;
}

export interface VideoRequest {
  title: string;
  description: string;
  isPublic: boolean;
  isLive: boolean;
}
