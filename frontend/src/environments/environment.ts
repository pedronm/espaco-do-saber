export const environment = {
  production: false,
  apiUrl: '/api',
  streamingApiUrl: '/streaming',
  obsIngestBaseUrl: 'rtmp://localhost:1935',
  wsUrl: '/ws',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'webrtc',
  webrtcSignalingPath: '/api/videos/stream/live/webrtc',
  webrtcIceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
