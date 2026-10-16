# 05 — Autenticación y aislamiento

## Vías de acceso (NextAuth v4, sesión JWT — `src/lib/auth.ts`)

- **Google OAuth** (registro público del SaaS): `GoogleProvider` activo solo si
  existen `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` (OAuth client
  DISTINTO del Módulo 6: solo perfil+email, sin scopes de GSC/GA4). En el primer
  login se crea la cuenta: `role: "user"`, `plan: "free"`, `password: null`,
  `status: "active"`. Un usuario `suspended` es rechazado en el callback `signIn`.
- **Credentials** (email + contraseña con `bcryptjs`): exclusiva del admin de la
  plataforma. Las cuentas creadas por Google tienen `password: null` y no pueden
  entrar por aquí.

Páginas: `/acceso` (Google + formulario credentials bajo "acceso interno") y
`/registro` (Google), públicas, en `src/app/acceso|registro` (componente compartido
`src/components/auth/AuthPanel.tsx`). El callback JWT relee el usuario en BD al
emitir/refresh, así `role`/`plan`/`status` de la sesión van frescos.

## Barreras de aislamiento (`src/lib/auth-guards.ts`)

- `requireSession()`: `getServerSession` + verificación en BD de que la cuenta sigue
  `active`. Una suspensión desde el panel corta el acceso en la siguiente petición,
  sin esperar a que caduque el JWT. **Es la única forma correcta de obtener la
  sesión en rutas API** (nunca `getServerSession` a pelo).
- `projectForSession(session, projectId[, select])`: carga el proyecto filtrando por
  `userId` (el role `admin` ve todos). Devuelve null → la ruta responde 404 sin
  distinguir "no existe" de "es de otro" (no filtra existencia de proyectos ajenos).
- Rutas de recursos hijos (`[noteId]`, `[kwId]`, `[studyId]`...): verifican el
  proyecto padre con `projectForSession(session, id, { id: true })` antes de tocar
  el hijo.
- Rutas de plataforma (configuración global, gasto global, plantillas de tareas):
  gate `isAdmin(session)` → 403.
- **Middleware** (`src/middleware.ts`): primera línea para páginas — `/app/:path*`
  exige sesión, `/admin/:path*` exige además `role: "admin"` (panel de administración,
  Fase 2). Las rutas API NO pasan por el middleware: su barrera es el patrón
  `requireSession`/`projectForSession` de cada handler.
- **Layout de proyecto** (`src/app/app/proyectos/[id]/layout.tsx`): choke point de
  todas las páginas de módulo — `projectForSession` + 404.

## Roles

| role | Quién | Puede |
|---|---|---|
| `admin` | Omar (plataforma) | Todo: todos los proyectos, config global, sin límites de plan (el tope global de DataForSEO sí le aplica) |
| `user` | Clientes del SaaS | Solo sus proyectos; límites de su plan (`src/lib/plans.ts`) |

## Protecciones

- Rate limiting de login (`src/lib/rate-limit.ts`): 10/10min por IP, 5/15min por
  email (en memoria — con más de una réplica, migrar a Redis).
- Suspensión: `User.status = "suspended"` → `requireSession` devuelve null (401) y
  el callback `signIn` deniega el login OAuth.
- Panel de administración (`/admin`, Fase 2): layout con `requireSession()` + `isAdmin`;
  API `/api/admin/usuarios/**` con gate `isAdmin` → 403. Las cuentas `admin` (y la propia)
  no se suspenden, degradan ni borran desde ahí.
- Borrado de cuenta: `DELETE /api/perfil` (cascada de proyectos); bloqueado para el
  admin de plataforma.

Ver también: [`06-roadmap-saas.md`](./06-roadmap-saas.md) (fases) y
[`00-protocolo-trabajo.md`](./00-protocolo-trabajo.md) (recetas y invariantes).
