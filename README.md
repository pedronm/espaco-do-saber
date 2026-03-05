# Espaco do Saber

Plataforma de cursos e transmissao com arquitetura serverless.

## Arquitetura Atual

- Frontend: Angular 19, deploy em Cloudflare Pages.
- API: Cloudflare Workers (`workers/api`) com integracoes:
  - Auth0 para autenticacao e cadastro (via backend).
  - Mux para live streaming.
  - Neon para dados de aplicacao.
  - Cloudflare R2 para armazenamento de videos e artefatos.
- Video processing: Worker Python (`workers/video-processing`) para orquestracao de jobs e metadados.

## Estrutura do Repositorio

```text
frontend/
workers/
  api/
  video-processing/
assets/
html/
copilot/
```

## Modulos Legados Removidos

Os seguintes componentes foram removidos por nao fazerem mais parte da arquitetura alvo:

- Spring Boot backend (`backend/`)
- Go streaming service (`video-management/video-streaming/`)
- Python service containerizado antigo (`video-management/video-processing/`)
- Keycloak local (`keycloak/`)
- Docker compose e infraestrutura local (`docker/`, `docker-compose.yml`, `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/proxy.conf.json`)

## Desenvolvimento Local

### 1. Frontend

```bash
cd frontend
npm install
npm run start
```

### 2. Worker API (TypeScript)

```bash
cd workers/api
npm install
npm run dev
```

### 3. Worker de Video (Python)

```bash
cd workers/video-processing
wrangler dev
```

## Deploy

### Frontend (Cloudflare Pages)

- Build command: `npm run build`
- Build output: `frontend/dist/espaco-do-saber-frontend`
- Configure `_redirects` para SPA fallback (recomendado).

### Workers

```bash
cd workers/api
npm run deploy

cd ../video-processing
wrangler deploy
```

## Variaveis Importantes

### Workers API

- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `NEON_DATABASE_URL`
- Binding R2: `VIDEOS_BUCKET`

### Frontend

- `src/environments/environment*.ts` deve apontar para a URL da Worker API e parametros Auth0.

## Status da Migracao

Checklist principal concluido:

- Armazenamento em Cloudflare R2
- Streaming migrado de Go para Mux
- Keycloak substituido por Auth0
- Frontend preparado para Cloudflare Pages
- Backend Java substituido por Cloudflare Workers (JS/Python)
- Banco definido para Neon (com possibilidade de D1 por caso de uso)
