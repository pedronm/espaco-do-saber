export const environment = {
  production: true,
  apiUrl: '/api',
  streamingApiUrl: '/api/mux',
  obsIngestBaseUrl: 'rtmp://global-live.mux.com:5222/app',
  wsUrl: '',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'hls',
  webrtcSignalingPath: '',
  webrtcIceServers: [],
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    audience: 'https://api.espacodosaber.com',
    rolesClaim: 'https://espacodosaber.com/roles'
  }
};
