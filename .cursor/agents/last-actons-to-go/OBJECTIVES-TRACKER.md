# Objectives Tracker — Espaço do Saber

> Updated by the orchestrator after each work session. Review and edit as needed.

**Last updated:** 2026-07-04 (P1 session)

## Legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## 1. Route control / validation (Cloudflare)

**Primary agent:** cloud-agent  
**Status:** `[~]` Mostly done

### Done
- [x] Route lists aligned (Portuguese paths ↔ Angular routes)
- [x] API JWT validation via Supabase JWKS
- [x] Service bindings (route-manager → API / frontend)
- [x] Route-manager: JWT signature/expiry validation via JWKS (when token present)
- [x] Invalid tokens rejected at edge (`401` for API, redirect for SPA)
- [x] `/videos/*` subpaths covered by `/videos` protected prefix

### Remaining
- [ ] Document threat model (edge vs API vs Angular guards — localStorage SPA)
- [ ] Security agent sign-off
- [ ] QA: route-manager redirect tests

**Key files:** `workers/route-manager/src/index.ts`, `frontend/src/app/app-routing.module.ts`

---

## 2. Login process (Supabase)

**Primary agent:** cloud-agent  
**Status:** `[~]` Mostly done

### Done
- [x] `signInWithPassword` via Supabase client
- [x] JWT attached to API calls (interceptor)
- [x] Role claims from JWT (`user_role`)
- [x] Pending approval check via `GET /api/me`

### Remaining
- [x] Fix pending check fail-open on API error (`auth.service.ts`)
- [x] Implement `POST /api/auth/reset-password`
- [ ] Align dev/prod environment configs
- [ ] Verify Supabase Edge Function `private-data-register` (not in repo)
- [ ] Security agent sign-off
- [ ] QA: auth flow tests (login, pending, logout)

**Key files:** `frontend/src/app/shared/services/auth.service.ts`, `workers/api/src/index.ts`

---

## 3. Admin admit/reject users

**Primary agent:** angular-agent  
**Status:** `[~]` Mostly done

### Done
- [x] Admin dashboard pending list UI
- [x] `GET/PATCH /api/auth/pending-approvals` API
- [x] Reject deletes auth user + profile + roles
- [x] Feature flag `adminAdmissionOn`

### Remaining
- [ ] End-to-end test with real Supabase registration flow
- [ ] Remove dead legacy approve endpoints in `UserManagementService` if any
- [ ] Email notification on approval (extra — per domain rules)
- [ ] Security agent sign-off
- [ ] QA: approve/reject integration tests

**Key files:** `frontend/src/app/admin/components/admin-dashboard.component.ts`, `frontend/src/app/shared/services/user-management.service.ts`

---

## 4. Video loading (R2 / cloud storage)

**Primary agent:** python-video-agent  
**Status:** `[~]` Partial

### Done
- [x] R2 multipart upload via API (`/api/r2/*`)
- [x] Range streaming from R2 (`GET /video-files/:key`)
- [x] Neon metadata insert after upload
- [x] Angular upload flow (teacher dashboard)

### Remaining
- [x] **P0:** Protect `/video-files/:key` (signed URLs + JWT + ownership)
- [x] **P0:** Authorize `GET /api/videos/:id` (public vs role vs owner)
- [ ] Enforce `is_public` / student-only on API and UI (partial — API logic added)
- [ ] Video-processing worker: real job pipeline (currently stub)
- [ ] Security agent sign-off
- [ ] QA: upload + authorized playback tests

**Key files:** `workers/api/src/index.ts`, `frontend/src/app/shared/services/r2-upload.service.ts`, `workers/video-processing/src/worker.py`

---

## 5. MUX streaming

**Primary agent:** python-video-agent  
**Status:** `[~]` Partial

### Done
- [x] Create live stream via Mux API
- [x] Store stream in Neon `live_streams`
- [x] OBS RTMP ingest key generation (teacher/admin UI)
- [x] List active streams

### Remaining
- [x] Fix playback URL: use `playbackId` not `liveId`
- [x] Switch live player from FLV to HLS (`hls.js`)
- [ ] Mux webhooks → update Neon when live ends / asset ready
- [ ] Live stream access control (student vs public) — per domain rules
- [ ] Use or remove unused `MUX_SIGNING_KEY_*` env vars
- [ ] Security agent sign-off
- [ ] QA: stream create + playback tests

**Key files:** `frontend/src/app/shared/services/stream-gateway.service.ts`, `frontend/src/app/shared/components/video-player/video-player.component.ts`

---

## 6. Security review

**Primary agent:** security-agent  
**Status:** `[ ]` Not started (continuous)

### Critical (from architecture analysis)
- [x] Remove secrets from `workers/api/wrangler.jsonc`; use `.dev.vars` / `wrangler secret put`
- [x] Close unauthenticated R2/video routes (signed playback + JWT)
- [ ] **Rotate exposed credentials** (MUX + Supabase service key were committed)
- [x] Harden route-manager auth
- [x] Remove `/api/me/debug`
- [x] Stop defaulting empty JWT roles to `aluno`
- [ ] Audit Angular routes visible without proper role guard
- [ ] Verify Supabase RLS (dashboard — not in repo)

---

## 7. Tests per module

**Primary agent:** qa-agent  
**Status:** `[ ]` Not started

### Target coverage
- [ ] Frontend: auth guard, pending approval, admin dashboard, video player
- [ ] API Worker: JWT middleware, admin routes, video auth, R2 upload
- [ ] Route manager: redirect logic, public/protected routes
- [ ] Video processing: job creation stub
- [ ] Fix existing `home.component.spec.ts`

---

## Cross-cutting blockers

| Blocker | Owner | Notes |
|---------|-------|-------|
| Secrets in wrangler.jsonc | cloud-agent + security | P0 before any deploy |
| Supabase Edge Function not in repo | cloud-agent | Needed to audit registration |
| README says Auth0, code uses Supabase | orchestrator | Docs reconciliation |
| Dual DB (Supabase + Neon) | node-agent | Document or consolidate later |
