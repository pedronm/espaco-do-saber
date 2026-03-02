export const environment = {
  production: true,
  apiUrl: '/api',
  streamingApiUrl: '/streaming',
  obsIngestBaseUrl: 'rtmp://video-streaming:1935',
  wsUrl: '/ws',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'webrtc',
  webrtcSignalingPath: '/api/videos/stream/live/webrtc',
  webrtcIceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
