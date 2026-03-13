# Auth Flow Notes for Node API Migration

## Goal
Document how the frontend should decide whether a user is authenticated and where to redirect, so migration from Supabase to Node API does not reintroduce permissive fallbacks.

## Current Route Behavior
- Login route and register route are guest-only.
- If user is authenticated, access to guest routes is blocked and user is redirected to dashboard by role.
- If user is not authenticated, protected routes redirect to login.

Source files:
- frontend/src/app/app-routing.module.ts
- frontend/src/app/shared/guards/auth.guard.ts

## Authentication Rule (Strict)
A user must only be considered authenticated when all of the following are true:
- Access token exists.
- Roles array exists.
- Roles array has at least one recognized role.

Source file:
- frontend/src/app/shared/services/auth.service.ts

## Navigation Visibility Rule
Navbar visibility in the app is tied to isAuthenticated.

Source file:
- frontend/src/app/app.component.ts

Important:
- Never show app navigation for users with missing/unknown roles.
- Never default unknown role to aluno (or any permissive role).

## Redirect Resolution Rule
Role priority used for routing:
1. administrador -> /administrador
2. professor -> /professor
3. aluno or medium -> /aluno
4. any other/empty role set -> /login

Source files:
- frontend/src/app/auth/components/login.component.ts
- frontend/src/app/shared/guards/auth.guard.ts
- frontend/src/app/app.component.ts

## Why Unauthorized Navigation Happened Before
Two patterns allowed accidental access:
- Missing roles were defaulted to aluno.
- Route resolution also defaulted to aluno when role could not be determined.

Both patterns are now removed from guard/login/dashboard route logic.

## Node API Contract Recommendations
When migrating auth to Node API, keep the frontend contract explicit.

### Suggested Endpoints
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me

### Login Response Shape
Return a stable payload that includes token and roles.

Example:
```json
{
  "access_token": "jwt-token",
  "refresh_token": "refresh-token",
  "expires_in": 3600,
  "user": {
    "id": "uuid-or-id",
    "email": "user@email.com",
    "name": "User Name"
  },
  "roles": ["aluno"],
  "permissions": []
}
```

### Non-Negotiable Backend Rules
- Do not issue success login response without roles.
- Do not return empty roles array for active users.
- Return 401/403 when token is invalid or claims are incomplete.
- Normalize legacy role aliases server-side (visitante/mediuns -> medium).

## Frontend Migration Checklist
- Replace Supabase login/register/refresh calls with Node API calls.
- Keep strict isAuthenticated check unchanged.
- Keep role-based redirect resolution unchanged.
- Keep guestOnly/protected route behavior unchanged.
- Ensure logout clears client auth state immediately.
- Ensure /api/auth/me is called on app bootstrap if needed to hydrate user state.

## Quick Test Matrix
1. Invalid password login:
- Expected: stay on login, show error, no navbar.

2. Login success with empty roles:
- Expected: treat as unauthenticated, stay/return to login, no navbar.

3. Login success with role aluno:
- Expected: redirect to /aluno, navbar visible.

4. Open /login while already authenticated as professor:
- Expected: redirect to /professor.

5. Protected route access without auth:
- Expected: redirect to /login.

## Notes for Security
- Keep role and permission checks on backend too (frontend checks are UX only).
- Prefer short-lived access tokens plus refresh token rotation.
- Add server-side audit logs for login/register/role changes.
