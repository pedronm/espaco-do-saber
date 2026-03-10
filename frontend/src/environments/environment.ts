export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8787/api',
  streamingApiUrl: 'http://127.0.0.1:8787/api/mux',
  apiHealthUrl: 'http://127.0.0.1:8787/health',
  videoProcessingHealthUrl: '',
  obsIngestBaseUrl: 'rtmp://global-live.mux.com:5222/app',
  wsUrl: '',
  appLogo: 'assets/logo-espaco-saber.png',
  livePlaybackStrategy: 'hls',
  webrtcSignalingPath: '',
  webrtcIceServers: [],
  features: {
    globalOn: false,
    videoOn: false,
    streamOn: false,
    muxOn: false,
    r2On: false,
    healthchecksOn: true
  },
  supabase: {
    url: 'https://rdpjwbyvkopgmhabdmwj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcGp3Ynl2a29wZ21oYWJkbXdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTg0NjAsImV4cCI6MjA4ODQ3NDQ2MH0.wrNbWSqgJruz7TgMVUUcP9MPbIwnciFAVGVKsxsFUdE',
    rolesClaim: 'user_role'
  }
};
