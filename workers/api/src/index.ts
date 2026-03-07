import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { neon } from '@neondatabase/serverless';

type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

type AppBindings = {
  VIDEOS_BUCKET: R2Bucket;
  APP_ENV: string;
  FRONTEND_ORIGIN?: string;
  AUTH0_DOMAIN: string;
  AUTH0_AUDIENCE: string;
  AUTH0_ISSUER?: string;
  AUTH0_ROLES_CLAIM?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
  AUTH0_DB_CONNECTION?: string;
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

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use('/*', async (c, next) => {
  const origin = c.env.FRONTEND_ORIGIN || '*';
  return cors({ origin, allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] })(c, next);
});

app.get('/health', (c) => c.json({ ok: true, service: 'workers-api', env: c.env.APP_ENV || 'unknown' }));

app.post('/api/auth/register', async (c) => {
  const payload = await c.req.json<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
    accessType?: 'PUBLICO' | 'ALUNO';
  }>().catch(() => ({}));

  const username = (payload.username || '').trim();
  const email = (payload.email || '').trim().toLowerCase();
  const password = payload.password || '';
  const confirmPassword = payload.confirmPassword || '';
  const fullName = (payload.fullName || '').trim();
  const accessType = payload.accessType || 'ALUNO';

  if (!username || !email || !password || !confirmPassword || !fullName) {
    return c.json({ message: 'Campos obrigatórios não informados.', pendingApproval: false }, 400);
  }

  if (password !== confirmPassword) {
    return c.json({ message: 'As senhas não conferem.', pendingApproval: false }, 400);
  }

  if (password.length < 8) {
    return c.json({ message: 'A senha deve ter ao menos 8 caracteres.', pendingApproval: false }, 400);
  }

  try {
    const managementToken = await getAuth0ManagementToken(c.env);
    const connection = c.env.AUTH0_DB_CONNECTION || 'Username-Password-Authentication';
    const role = accessType === 'PUBLICO' ? 'STUDENT' : 'STUDENT';

    const createUserResponse = await fetch(`https://${c.env.AUTH0_DOMAIN}/api/v2/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managementToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        connection,
        username,
        email,
        password,
        name: fullName,
        email_verified: false,
        verify_email: true,
        app_metadata: {
          roles: [role]
        },
        user_metadata: {
          accessType,
          fullName
        }
      })
    });

    if (!createUserResponse.ok) {
      const errorPayload = await createUserResponse.json<any>().catch(() => ({}));
      const message =
        errorPayload?.message ||
        errorPayload?.error_description ||
        'Não foi possível criar usuário no Auth0.';
      const status = createUserResponse.status === 409 ? 409 : 502;
      return c.json({ message, pendingApproval: false }, status);
    }

    return c.json({
      message: 'Cadastro realizado com sucesso. Verifique seu e-mail para confirmação.',
      pendingApproval: false
    }, 201);
  } catch (error) {
    return c.json({ message: 'Falha ao registrar usuário no Auth0.', pendingApproval: false }, 500);
  }
});

app.use('/api/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ message: 'Missing bearer token' }, 401);
  }

  const token = authHeader.substring('Bearer '.length).trim();
  const domain = c.env.AUTH0_DOMAIN;
  const issuer = c.env.AUTH0_ISSUER || `https://${domain}/`;
  const audience = c.env.AUTH0_AUDIENCE;

  try {
    const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience });
    const roleClaimKey = c.env.AUTH0_ROLES_CLAIM || 'https://espacodosaber.com/roles';
    const roleClaim = payload[roleClaimKey] as string[] | undefined;
    const roles = (roleClaim || []).filter((r): r is Role => r === 'ADMIN' || r === 'TEACHER' || r === 'STUDENT');

    c.set('user', {
      sub: String(payload.sub || ''),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      roles,
      raw: payload
    });

    await next();
  } catch {
    return c.json({ message: 'Invalid token' }, 401);
  }
});

app.get('/api/me', (c) => {
  const user = c.get('user');
  return c.json({ sub: user.sub, email: user.email, roles: user.roles });
});

app.get('/api/videos/public', async (c) => {
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
});

app.get('/api/videos/my-videos', async (c) => {
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
});

app.post('/api/mux/live-streams', async (c) => {
  const user = c.get('user');
  const canPublish = user.roles.includes('TEACHER') || user.roles.includes('ADMIN');
  if (!canPublish) {
    return c.json({ message: 'Forbidden' }, 403);
  }

  const basic = btoa(`${c.env.MUX_TOKEN_ID}:${c.env.MUX_TOKEN_SECRET}`);
  const body = await c.req.json().catch(() => ({}));
  const playbackPolicy = body?.playbackPolicy === 'signed' ? ['signed'] : ['public'];

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
    return c.json({ message: 'Mux error', detail: errorText }, 502);
  }

  const mux = await response.json<any>();
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
  const response = await fetch('https://api.mux.com/video/v1/live-streams?status=active&limit=100', {
    headers: { Authorization: `Basic ${basic}` }
  });

  if (!response.ok) {
    return c.json({ message: 'Unable to list active streams' }, 502);
  }

  const payload = await response.json<any>();
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

async function getAuth0ManagementToken(env: AppBindings): Promise<string> {
  if (!env.AUTH0_CLIENT_ID || !env.AUTH0_CLIENT_SECRET) {
    throw new Error('Missing Auth0 management credentials');
  }

  const tokenResponse = await fetch(`https://${env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: env.AUTH0_CLIENT_ID,
      client_secret: env.AUTH0_CLIENT_SECRET,
      audience: `https://${env.AUTH0_DOMAIN}/api/v2/`
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Unable to obtain Auth0 management token');
  }

  const tokenPayload = await tokenResponse.json<{ access_token?: string }>();
  if (!tokenPayload.access_token) {
    throw new Error('Invalid Auth0 management token payload');
  }

  return tokenPayload.access_token;
}
