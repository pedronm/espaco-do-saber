import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

type Role = 'administrador' | 'professor' | 'aluno' | 'visitante';

type AppBindings = {
  VIDEOS_BUCKET: R2Bucket;
  VIDEO_PROCESSING: Fetcher;
  APP_ENV: string;
  FRONTEND_ORIGIN?: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_AUDIENCE?: string;
  SUPABASE_JWT_ISSUER?: string;
  AUTH_ROLES_CLAIM?: string;
  SUPABASE_SERVICE_KEY?: string;
  MUX_TOKEN_ID: string;
  MUX_TOKEN_SECRET: string;
  MUX_WEBHOOK_SECRET?: string;
  MUX_SIGNING_KEY_ID?: string;
  MUX_SIGNING_KEY_PRIVATE?: string;
  NEON_DATABASE_URL: string;
};

type AppVariables = {
  user: { sub: string; email?: string; roles: Role[]; raw: JWTPayload };
};

type RegisterPayload = {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  accessType?: 'PUBLICO' | 'ALUNO';
};

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use('/*', async (c, next) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  console.log(JSON.stringify({
    level: 'info',
    event: 'request.start',
    requestId,
    method: c.req.method,
    path: c.req.path,
    origin: c.req.header('Origin') || null,
    userAgent: c.req.header('User-Agent') || null
  }));

  await next();

  c.res.headers.set('x-request-id', requestId);

  console.log(JSON.stringify({
    level: 'info',
    event: 'request.end',
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - startedAt
  }));
});

app.use('/*', async (c, next) => {
  const allowedOrigins = resolveAllowedOrigins(c.env.FRONTEND_ORIGIN);
  return cors({
    origin: (requestOrigin) => {
      if (!requestOrigin) {
        return allowedOrigins[0] || '*';
      }

      if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
        return requestOrigin;
      }

      return '';
    },
    allowHeaders: ['Authorization', 'Content-Type', 'apikey', 'x-client-info', 'x-supabase-auth', 'sb-access-token'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })(c, next);
});

app.onError((error, c) => {
  const allowedOrigins = resolveAllowedOrigins(c.env.FRONTEND_ORIGIN);
  const requestOrigin = c.req.header('Origin');
  const responseOrigin = resolveResponseOrigin(requestOrigin, allowedOrigins);

  console.error(JSON.stringify({
    level: 'error',
    event: 'request.error',
    method: c.req.method,
    path: c.req.path,
    message: error?.message || 'Unhandled worker error',
    stack: error?.stack || null
  }));

  const response = c.json({ message: 'Internal server error' }, 500);
  if (responseOrigin) {
    response.headers.set('Access-Control-Allow-Origin', responseOrigin);
    response.headers.set('Vary', 'Origin');
  }

  return response;
});

app.get('/health', (c) => c.json({ ok: true, service: 'workers-api', env: c.env.APP_ENV || 'unknown' }));

app.all('/videos/*', async (c) => {
  const incomingUrl = new URL(c.req.url);
  const forwardedPath = incomingUrl.pathname.replace(/^\/videos/, '') || '/';
  const targetUrl = new URL(`https://video-processing.internal${forwardedPath}${incomingUrl.search}`);

  const forwardedRequest = new Request(targetUrl.toString(), c.req.raw);
  return c.env.VIDEO_PROCESSING.fetch(forwardedRequest);
});

app.get('/api/videos/public', async (c) => {
  try {
    const sql = neon(c.env.NEON_DATABASE_URL);
    const rows = await sql`
      select id, title, description, teacher_id as "teacherId", teacher_name as "teacherName",
             duration, is_live as "isLive", was_live as "wasLive", is_public as "isPublic",
             uploaded_at as "uploadedAt", streaming_url as "streamingUrl", playback_id as "playbackId"
      from videos
      where is_public = true
      order by uploaded_at desc
      limit 200
    `;

    return c.json(rows);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'videos.public.failed',
      message: error instanceof Error ? error.message : String(error)
    }));
    return c.json({ message: 'Failed to load public videos' }, 500);
  }
});

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }

  const tokenInfo = extractBearerTokenFromRequest(c);
  if (!tokenInfo) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'auth.missing-token',
      method: c.req.method,
      path: c.req.path,
      origin: c.req.header('Origin') || null,
      hasAuthorization: Boolean(c.req.header('Authorization')),
      hasCookie: Boolean(c.req.header('Cookie'))
    }));
    return c.json({ message: 'Missing bearer token' }, 401);
  }

  const issuer = c.env.SUPABASE_JWT_ISSUER || `${c.env.SUPABASE_URL}/auth/v1`;
  const audience = c.env.SUPABASE_JWT_AUDIENCE || 'authenticated';

  try {
    const jwks = createRemoteJWKSet(new URL(`${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
    const { payload } = await jwtVerify(tokenInfo.token, jwks, { issuer, audience });
    const roleClaimKey = c.env.AUTH_ROLES_CLAIM || 'user_role';
    const roleClaim = getClaimByPath(payload, roleClaimKey);
    const fallbackClaim = getClaimByPath(payload, 'app_metadata.roles');
    const roles = normalizeRoles(roleClaim ?? fallbackClaim);
    const resolvedRoles: Role[] = roles.length > 0 ? roles : ['aluno'];

    c.set('user', {
      sub: String(payload.sub || ''),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      roles: resolvedRoles,
      raw: payload
    });

    const isPendingApproval = await readIsPendingApproval(c.env.NEON_DATABASE_URL, c.env.SUPABASE_SERVICE_KEY, String(payload.sub || ''));
    if (isPendingApproval) {
      return c.json({
        code: 'PENDING_APPROVAL',
        message: 'Cadastro pendente de aprovacao do administrador.'
      }, 403);
    }

    await next();
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'auth.invalid-token',
      method: c.req.method,
      path: c.req.path,
      tokenSource: tokenInfo.source,
      message: error instanceof Error ? error.message : String(error)
    }));
    return c.json({ message: 'Invalid token' }, 401);
  }
});

app.get('/api/me', async (c) => {
  const user = c.get('user');
  const isPendingApproval = await readIsPendingApproval(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY, user.sub);
  
  const response = { 
    sub: user.sub, 
    email: user.email, 
    roles: user.roles,
    isPendingApproval
  };
  
  console.log(`DEBUG: /api/me response for user ${user.sub}:`, JSON.stringify(response));

  return c.json(response);
});

app.get('/api/me/debug', async (c) => {
  const user = c.get('user');
  
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_KEY) {
    return c.json({ error: 'Supabase credentials not configured' }, 500);
  }

  try {
    const response = await fetch(`${c.env.SUPABASE_URL}/auth/v1/admin/users/${user.sub}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${c.env.SUPABASE_SERVICE_KEY}`,
        apikey: c.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    });

    const userData = await response.json();
    return c.json({
      userId: user.sub,
      fullUserData: userData
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

app.post('/api/auth/pending-approvals', async (c) => {
  const user = c.get('user');
  if (!user.roles.includes('administrador')) {
    return c.json({ message: 'Forbidden' }, 403);
  }

  if (!c.env.SUPABASE_SERVICE_KEY) {
    console.error('Supabase service key is missing.');
    return c.json({ message: 'Falha ao cadastrar!.' }, 500);
  }

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });

    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    
    if (error || !usersData?.users) {
      console.error('Failed to list users:', error?.message);
      return c.json({ message: 'Unable to load pending approvals', detail: error?.message }, 502);
    }

    const pendingUsers = usersData.users
      .filter((candidate) => {
        const appMetadata = candidate?.app_metadata || {};
        const pendingApproval = appMetadata?.is_pendente_aprovacao === true;
        const missingEmailConfirmation = !candidate?.email_confirmed_at;
        return pendingApproval || missingEmailConfirmation;
      })
      .map((candidate) => {
        const appMetadata = candidate?.app_metadata || {};
        const userMetadata = candidate?.user_metadata || {};
        const mappedRole = toManagedUserRole(String(appMetadata?.app_role || appMetadata?.user_role || 'aluno'));
        return {
          id: String(candidate?.id || ''),
          username: String(userMetadata?.username || candidate?.email || ''),
          email: String(candidate?.email || ''),
          fullName: String(userMetadata?.fullName || userMetadata?.name || candidate?.email || ''),
          role: mappedRole,
          active: Boolean(candidate?.email_confirmed_at),
          passwordExpiresAt: null
        };
      });

    return c.json(pendingUsers);
  } catch (error) {
    return c.json({
      message: 'Failed to load pending approvals.',
      detail: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

app.get('/api/videos/my-videos', async (c) => {
  try {
    const user = c.get('user');
    const sql = neon(c.env.NEON_DATABASE_URL);
    const rows = await sql`
      select id, title, description, teacher_id as "teacherId", teacher_name as "teacherName",
             duration, is_live as "isLive", was_live as "wasLive", is_public as "isPublic",
             uploaded_at as "uploadedAt", streaming_url as "streamingUrl", playback_id as "playbackId"
      from videos
      where teacher_id = ${user.sub}
      order by uploaded_at desc
      limit 200
    `;

    return c.json(rows);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'videos.my.failed',
      message: error instanceof Error ? error.message : String(error)
    }));
    return c.json({ message: 'Failed to load user videos' }, 500);
  }
});

app.post('/api/mux/live-streams', async (c) => {
  const user = c.get('user');
  const canPublish = user.roles.includes('professor') || user.roles.includes('administrador');
  if (!canPublish) {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const basic = btoa(`${c.env.MUX_TOKEN_ID}:${c.env.MUX_TOKEN_SECRET}`);
  const body = await c.req.json().catch(() => ({}));
  const playbackPolicy = body?.playbackPolicy === 'signed' ? ['signed'] : ['public'];

  let mux: any;
  try {
    const response = await fetch('https://api.mux.com/video/v1/live-streams', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playback_policy: playbackPolicy,
        new_asset_settings: {
          playback_policy: playbackPolicy
        },
        reconnect_window: 60,
        latency_mode: 'low'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'error',
        event: 'mux.create.failed',
        status: response.status,
        detail: errorText.slice(0, 1200)
      }));
      return c.json({ message: 'Mux error', detail: errorText }, 502);
    }

    mux = await response.json<any>();
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'mux.create.exception',
      message: error instanceof Error ? error.message : String(error)
    }));
    return c.json({ message: 'Mux request failed' }, 502);
  }
  const streamKey = mux?.data?.stream_key as string | undefined;
  const liveStreamId = mux?.data?.id as string | undefined;
  const playbackId = mux?.data?.playback_ids?.[0]?.id as string | undefined;

  if (!streamKey || !liveStreamId) {
    return c.json({ message: 'Invalid Mux response' }, 502);
  }

  const sql = neon(c.env.NEON_DATABASE_URL);
  await sql`
    insert into live_streams (id, owner_id, playback_id, created_at)
    values (${liveStreamId}, ${user.sub}, ${playbackId || null}, now())
    on conflict (id) do update
    set owner_id = excluded.owner_id,
        playback_id = excluded.playback_id
  `;

  return c.json({
    id: liveStreamId,
    streamKey,
    playbackId,
    rtmpUrl: 'rtmp://global-live.mux.com:5222/app',
    ingestUrl: `rtmp://global-live.mux.com:5222/app/${streamKey}`
  });
});

app.get('/api/mux/live-streams/active', async (c) => {
  const basic = btoa(`${c.env.MUX_TOKEN_ID}:${c.env.MUX_TOKEN_SECRET}`);
  let payload: any;
  try {
    const response = await fetch('https://api.mux.com/video/v1/live-streams?status=active&limit=100', {
      headers: { Authorization: `Basic ${basic}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        level: 'error',
        event: 'mux.list.failed',
        status: response.status,
        detail: errorText.slice(0, 1200)
      }));
      return c.json({ message: 'Unable to list active streams' }, 502);
    }

    payload = await response.json<any>();
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'mux.list.exception',
      message: error instanceof Error ? error.message : String(error)
    }));
    return c.json({ message: 'Unable to list active streams' }, 502);
  }

  const streams = (payload?.data || []).map((item: any) => ({
    id: item.id,
    playbackId: item?.playback_ids?.[0]?.id,
    status: item.status
  }));

  return c.json({ streams });
});

app.post('/api/videos', async (c) => {
  const user = c.get('user');
  const data = await c.req.json<{
    title: string;
    description?: string;
    isPublic?: boolean;
    isLive?: boolean;
    streamingUrl?: string;
    playbackId?: string;
    duration?: number;
  }>();

  const sql = neon(c.env.NEON_DATABASE_URL);
  const rows = await sql`
    insert into videos (
      title, description, teacher_id, teacher_name, duration,
      is_live, was_live, is_public, uploaded_at, streaming_url, playback_id
    ) values (
      ${data.title}, ${data.description || ''}, ${user.sub}, ${user.email || user.sub}, ${data.duration || 0},
      ${Boolean(data.isLive)}, ${Boolean(data.isLive)}, ${Boolean(data.isPublic ?? true)}, now(), ${data.streamingUrl || ''}, ${data.playbackId || null}
    )
    returning id, title, description, teacher_id as "teacherId", teacher_name as "teacherName",
              duration, is_live as "isLive", was_live as "wasLive", is_public as "isPublic",
              uploaded_at as "uploadedAt", streaming_url as "streamingUrl", playback_id as "playbackId"
  `;

  return c.json(rows[0], 201);
});

app.post('/api/r2/signed-upload', async (c) => {
  const data = await c.req.json<{ key: string; contentType?: string }>();
  if (!data?.key) {
    return c.json({ message: 'key is required' }, 400);
  }

  const signed = await c.env.VIDEOS_BUCKET.createMultipartUpload(data.key, {
    httpMetadata: {
      contentType: data.contentType || 'application/octet-stream'
    }
  });

  return c.json({
    key: data.key,
    uploadId: signed.uploadId
  });
});

app.get('/api/bootstrap', async (c) => {
  const sql = neon(c.env.NEON_DATABASE_URL);
  await sql`
    create table if not exists videos (
      id bigserial primary key,
      title text not null,
      description text not null default '',
      teacher_id text not null,
      teacher_name text not null,
      duration integer not null default 0,
      is_live boolean not null default false,
      was_live boolean not null default false,
      is_public boolean not null default true,
      uploaded_at timestamptz not null default now(),
      streaming_url text not null default '',
      playback_id text
    )
  `;

  await sql`
    create table if not exists live_streams (
      id text primary key,
      owner_id text not null,
      playback_id text,
      created_at timestamptz not null default now()
    )
  `;

  return c.json({ ok: true });
});

export default app;

function getClaimByPath(payload: JWTPayload, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  let cursor: unknown = payload;

  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || !(segment in (cursor as Record<string, unknown>))) {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function isRole(value: unknown): value is Role {
  return value === 'administrador' || value === 'professor' || value === 'aluno' || value === 'visitante';
}

function mapRole(raw: string): Role | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'administrador') {
    return 'administrador';
  }

  if (normalized === 'professor') {
    return 'professor';
  }

  if (normalized === 'aluno') {
    return 'aluno';
  }

  if (normalized === 'visitante') {
    return 'visitante';
  }

  return null;
}

function normalizeRoles(raw: unknown): Role[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => mapRole(entry))
      .filter((entry): entry is Role => !!entry)
      .filter((entry, index, list) => list.indexOf(entry) === index);
  }

  if (typeof raw === 'string') {
    const role = mapRole(raw);
    return role ? [role] : [];
  }

  return [];
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  // Fallback for clients that accidentally send only the raw JWT.
  const trimmed = authHeader.trim();
  if (trimmed.split('.').length === 3) {
    return trimmed;
  }

  return null;
}

function extractBearerTokenFromRequest(c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined } }): { token: string; source: string } | null {
  const headerCandidates = [
    { key: 'authorization', value: c.req.header('Authorization') },
    { key: 'x-supabase-auth', value: c.req.header('x-supabase-auth') },
    { key: 'sb-access-token', value: c.req.header('sb-access-token') }
  ];

  for (const candidate of headerCandidates) {
    const parsed = extractBearerToken(candidate.value) || extractJwtLike(candidate.value);
    if (parsed) {
      return { token: parsed, source: `header:${candidate.key}` };
    }
  }

  const queryToken = c.req.query('access_token');
  if (queryToken) {
    const parsed = extractBearerToken(queryToken) || extractJwtLike(queryToken);
    if (parsed) {
      return { token: parsed, source: 'query:access_token' };
    }
  }

  const cookieHeader = c.req.header('Cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookieValues = cookieHeader.split(';').map((part) => part.trim());
  for (const cookie of cookieValues) {
    const separatorIndex = cookie.indexOf('=');
    const rawValue = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : cookie;
    const decodedValue = decodeURIComponentSafe(rawValue);
    const parsed = extractBearerToken(decodedValue) || extractJwtLike(decodedValue);
    if (parsed) {
      return { token: parsed, source: 'cookie' };
    }
  }

  return null;
}

function extractJwtLike(input: string | undefined): string | null {
  if (!input) {
    return null;
  }

  const match = input.match(/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/);
  if (!match?.[1]) {
    return null;
  }

  return match[1];
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveAllowedOrigins(configuredOrigins: string | undefined): string[] {
  if (!configuredOrigins || configuredOrigins.trim().length === 0) {
    return ['https://espacodosaber.cpmacursos.com'];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function resolveResponseOrigin(requestOrigin: string | undefined, allowedOrigins: string[]): string | null {
  if (!requestOrigin) {
    return allowedOrigins.includes('*') ? '*' : allowedOrigins[0] || null;
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

function toManagedUserRole(rawRole: string): 'ADMIN' | 'TEACHER' | 'STUDENT' {
  const normalized = (rawRole || '').trim().toLowerCase();
  if (normalized === 'administrador') {
    return 'ADMIN';
  }

  if (normalized === 'professor') {
    return 'TEACHER';
  }

  return 'STUDENT';
}

async function   cvreadIsPendingApproval(supabaseUrl: string, serviceKey: string | undefined, userId: string): Promise<boolean> {
  console.log(`DEBUG: Checking pending approval for user ${userId} using Supabase at ${supabaseUrl} is serviceKey ${serviceKey ? 'provided' : 'not provided'}`);
  if (!userId || !supabaseUrl || !serviceKey) {
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Query the profiles table in Supabase PostgreSQL database
    const { data, error } = await supabase
      .from('public.profiles')
      .select('id, is_pendente_aprovacao')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'auth.pending-approval.user_not_found',
        userId,
        source: 'profiles_table',
        error: error?.message
      }));
      return false;
    }

    console.log(`DEBUG: Profile data for ${userId}:`, JSON.stringify(data));
    
    // Check profiles table for pending_approval flag
    const isPending = data?.is_pendente_aprovacao === true;
    
    console.log(JSON.stringify({
      level: 'debug',
      event: 'auth.pending-approval.query_result',
      userId,
      isPendingApproval: isPending,
      source: 'profiles_table'
    }));

    return isPending;
  } catch (error) {
    console.log(`DEBUG: Exception while checking pending approval for ${userId}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
