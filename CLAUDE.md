# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GIMS (Government Infrastructure Management System) Task Registry — a WhatsApp/Telegram-based AI-powered task management system for government facilities. Supervisors register daily maintenance tasks via voice or text in Marathi, Hindi, or English. Google Gemini AI handles language detection, voice transcription, and automatic task categorization.

## Development Commands

### Infrastructure
PostgreSQL 18 and Redis are installed directly on Windows (no Docker).
- **psql path:** `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`
- **DB credentials:** user `postgres`, password `postgres123`, database `gims_db`, port 5432
- **Redis:** localhost:6379, no password

To run migrations manually:
```bash
export PGPASSWORD=postgres123 && "/c/Program Files/PostgreSQL/18/bin/psql.exe" -U postgres -d gims_db -h localhost < backend/migrations/001_initial_schema.sql
```
Migrations are numbered 001–007 in `backend/migrations/`, with seeds in `backend/seeds/`. Run them in order.

### Backend (Express + TypeScript, port 3000)
```bash
cd backend
npm install
npm run dev                    # ts-node-dev with auto-reload
npm run build                  # tsc → dist/
npm run start                  # Run compiled output
npm run test                   # Jest (ts-jest configured, no test files yet)
npm run test:watch             # Jest watch mode
npm run lint                   # ESLint on src/**/*.ts
npm run migrate                # Run psql migrations directly
npm run seed                   # Seed category data
```

### Frontend (React + Vite + TypeScript, port 5173)
```bash
cd frontend
npm install
npm run dev                    # Vite dev server
npm run build                  # tsc -b + vite build
npm run lint                   # ESLint
npm run preview                # Preview production build
```

**Port note:** The frontend Axios base URL defaults to `http://localhost:3001/api` via `VITE_API_URL`, but the backend defaults to port **3000**. Set `VITE_API_URL=http://localhost:3000/api` in `frontend/.env` to match, or adjust `PORT` in the backend `.env`.

## Architecture

### Backend (`backend/src/`)

**Controller → Service → Database pattern.** No ORM — raw SQL via `pg` pool in `config/database.ts`.

- **`config/`** — Database pool (`database.ts`), Redis client via ioredis (`redis.ts`), env validation with Zod schema (`env.ts`)
- **`controllers/`** — HTTP request handlers (auth, task, team, teamStats, dashboard, report, webhook, attachment, notification, reminder, profile)
- **`services/`** — Business logic. Key services:
  - `gemini.service.ts` — AI task classification and voice transcription (supports separate `GEMINI_API_KEY_VOICE` for audio)
  - `whatsapp.service.ts` / `telegram.service.ts` / `telegram-polling.service.ts` — Messaging platform integration
  - `task.service.ts` — CRUD with role-based filtering
  - `inAppNotification.service.ts` — In-app notification delivery
  - `report.service.ts` — PDF (PDFKit) and Excel (ExcelJS) report generation
- **`routes/`** — Route files aggregated in `routes/index.ts`. API base: `/api`. Health check at `GET /api/health`.
- **`middlewares/`** — JWT auth (`auth.middleware.ts`), Zod-based request validation (`validate.middleware.ts`), error handling (`error.middleware.ts`)
- **`queues/`** — Bull job queues (Redis-backed): message, notification, reminder, telegram
- **`utils/`** — `response.ts` (standardized API responses), `logger.ts` (Winston), `validators.ts`
- **`types/index.ts`** — All TypeScript interfaces (single file)

**Path aliases** configured in `tsconfig.json`: `@config/*`, `@controllers/*`, `@services/*`, `@models/*`, `@routes/*`, `@middlewares/*`, `@queues/*`, `@utils/*`, `@types/*` (all resolve to `src/<folder>/*`).

### Frontend (`frontend/src/`)

- **`pages/`** — Route-level components (Dashboard, Tasks, TaskForm, Reports, Teams, TeamDashboard, Users, AuditLog, Reminders, Settings, Profile, Login)
- **`components/`** — Shared components: `layout/` (Header, Sidebar, Layout), `ui/` (reusable UI primitives), plus AttachmentList, FileUpload, VoiceRecorder, NotificationBell, MarathiMarquee
- **`services/`** — Axios-based API files; `api.ts` has interceptors for auth tokens + auto-refresh on 401
- **`context/AuthContext.tsx`** — Authentication state management
- **`types/index.ts`** — TypeScript interfaces

React Router DOM for routing, TanStack React Query for server state (30s stale time, 1 retry), React Hook Form + Zod for forms, Tailwind CSS for styling, Recharts for charts, Lucide React for icons, date-fns for dates.

### Database

PostgreSQL with raw SQL migrations. Key tables:
- **`users`** — UUID PK, phone-based auth, roles: `super_admin`, `admin`, `member`
- **`task_registry`** — UUID PK, `task_data` JSONB column for flexible category-specific fields, soft deletes
- **`categories`** — `field_template` JSONB defines dynamic form fields per category
- **`teams`** — Team organization with admin ownership
- **`audit_log`** — Full change tracking (old_data/new_data JSONB)
- **`attachments`**, **`voice_messages`**, **`reminders`**, **`notifications`**, **`whatsapp_sessions`**

### Key Patterns

- **Role-based access**: `super_admin` sees all, `admin` sees team-scoped, `member` sees own tasks. Enforced in both middleware and service-level SQL queries. Auth middleware provides three functions: `authenticate()` (required JWT), `authorize(...roles)` (role check), `optionalAuth()` (token optional).
- **JSONB for flexible data**: Task data schema varies by category, stored in `task_data` JSONB field with templates in `categories.field_template`.
- **Async job processing**: Heavy operations (AI transcription, messaging) go through Bull queues backed by Redis. Four queues: message, notification, reminder, telegram.
- **Multi-source input**: Tasks arrive from web UI, WhatsApp webhook (`/api/webhook/whatsapp`), or Telegram. Unified processing in services.
- **Standardized API responses**: All endpoints return `{ success, data?, message?, error?, meta? }` via `utils/response.ts`. Frontend Axios interceptor unwraps `data` automatically and handles 401 with automatic token refresh.
- **Error handling**: Custom error classes (`AppError`, `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`) in `error.middleware.ts`. Wrap async route handlers with `asyncHandler()` to catch errors.
- **Request validation**: Zod schemas applied via `validateBody()`, `validateQuery()`, `validateParams()`, or combined `validateRequest()` from `validate.middleware.ts`.
- **Graceful shutdown**: `server.ts` handles SIGTERM/SIGINT with ordered teardown: HTTP server → Telegram polling → Bull queues → Database pool → Redis (10s force-exit timeout).

## Environment

Backend requires `.env` file in `backend/` (copy from `backend/.env.example`). Critical variables: `DB_*` / `DATABASE_URL`, `REDIS_*`, `JWT_SECRET` (min 32 chars), `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`. WhatsApp/Telegram tokens needed only for messaging features.

Frontend uses `VITE_API_URL` (in `frontend/.env`) to point at the backend API.

Local PostgreSQL 18 defaults: user `postgres`/`postgres123`, database `gims_db`, port 5432. Redis on localhost:6379 with no password.
