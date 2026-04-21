# CLAUDE.md — ProjectFlow Backend

> Backend API for ProjectFlow SaaS — a multi-tenant project management platform.

---

## Tech Stack

- **Node.js 20 LTS** + **Express 4** + **TypeScript** (strict mode)
- **ts-node** — dev runtime | **tsc** — production build (`src/` → `dist/`)
- **Mongoose 8** — MongoDB ODM with typed schemas & interfaces
- **jsonwebtoken** — JWT sign/verify
- **bcrypt** — password hashing (salt rounds: 10)
- **zod** — request body validation
- **dotenv** — environment config
- **cors** + **cookie-parser** — middleware

---

## Project Structure

```
src/
├── index.ts                  # Express app entry point
├── config/
│   └── db.ts                 # Mongoose connection
├── modules/
│   ├── auth/                 # auth.model.ts, auth.service.ts, auth.controller.ts, auth.routes.ts
│   ├── tenant/               # tenant.model.ts, tenant.service.ts, tenant.routes.ts
│   ├── user/                 # profile, role management
│   ├── project/              # project.model.ts, project.service.ts, project.controller.ts, project.routes.ts
│   └── task/                 # task.model.ts, task.service.ts, task.controller.ts, task.routes.ts
├── middleware/
│   ├── authMiddleware.ts     # JWT verify + inject req.user
│   ├── roleMiddleware.ts     # requireRole() factory
│   └── errorHandler.ts       # Global error handler
├── types/
│   └── index.ts              # Shared types: AuthRequest, Role, enums
└── utils/                    # Validators, constants, helpers
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server via `ts-node` + `nodemon` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS from `dist/index.js` |

---

## Environment Variables

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/projectflow
JWT_SECRET=your_jwt_secret_256bit
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your_refresh_secret
CLIENT_ORIGIN=http://localhost:5173
```

---

## Coding Rules

- **All code is TypeScript** — no `.js` files in `src/`
- **Strict typing** — avoid `any`; define interfaces for all models, request/response payloads, and service return types
- **Always scope MongoDB queries with `tenantId`** — never query without it on tenant-owned data
- **Auth is stateless JWT** — token payload: `{ userId, tenantId, role }`
- **JWT stored in httpOnly cookie** — never localStorage
- **Every protected route** runs `authMiddleware` → decodes JWT → injects `req.user`
- **Validate all request bodies** with zod on POST/PATCH handlers
- **Use async/await** — no raw `.then()` chains
- **Every async function** must have try/catch
- **Keep modules self-contained** — each module owns its model, service, controller, routes
- **No hardcoded secrets** — always use `process.env.*`

---

## User Roles (RBAC)

| Role | Access Level |
|------|-------------|
| `super_admin` | Platform-wide — all tenants |
| `admin` | Tenant-wide — all projects/users in org |
| `manager` | Project-wide — create/assign tasks |
| `user` | Task-level — view & update assigned tasks |

---

## API Endpoints

| Module | Method | Path | Auth |
|--------|--------|------|------|
| Auth | POST | `/api/auth/register` | Public |
| Auth | POST | `/api/auth/login` | Public |
| Auth | POST | `/api/auth/refresh` | Cookie |
| Users | GET | `/api/users` | admin+ |
| Users | PATCH | `/api/users/:id/role` | admin |
| Projects | GET | `/api/projects` | user+ |
| Projects | POST | `/api/projects` | manager+ |
| Projects | PATCH | `/api/projects/:id` | manager+ |
| Projects | DELETE | `/api/projects/:id` | admin |
| Tasks | GET | `/api/tasks?projectId=` | user+ |
| Tasks | POST | `/api/tasks` | manager+ |
| Tasks | PATCH | `/api/tasks/:id` | user+ |
| Tasks | DELETE | `/api/tasks/:id` | manager+ |

---

## Deployment (Render)

- Build command: `npm run build`
- Start command: `node dist/index.js`
- Set all `.env` variables in Render dashboard
