export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8787/api',
  streamingApiUrl: 'http://127.0.0.1:8787/api/mux',
  obsIngestBaseUrl: 'rtmp://global-live.mux.com:5222/app',
  wsUrl: '',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'hls',
  webrtcSignalingPath: '',
  webrtcIceServers: [],
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
    audience: 'https://api.espacodosaber.cpmacursos.com',
    rolesClaim: 'https://espacodosaber.com/roles'
  }
};
