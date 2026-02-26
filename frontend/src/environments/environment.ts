export const environment = {
  production: false,
  apiUrl: '/api',
  wsUrl: '/ws',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'webrtc',
  webrtcSignalingPath: '/api/videos/stream/live/webrtc',
  webrtcIceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};
