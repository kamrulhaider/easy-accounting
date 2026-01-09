# Copilot / AI contributor instructions for easy-accounting

This file contains concise, project-specific guidance to help AI assistants be productive in this repository.

## Overview

- This is a small Express + TypeScript API backed by Prisma (Postgres). Key folders: `src/` (app code), `prisma/` (schema + seed).
- App entry: `src/index.ts`. Prisma client is created in `src/prisma.ts` and used directly from controllers.

## Architecture and data flow

- HTTP server (Express) -> middlewares (`src/middlewares/auth.ts`) -> routers (`src/routers/*`) -> controllers (`src/controllers/*`) -> Prisma client (`src/prisma.ts`) -> Postgres.
- Authentication is JWT-based but lightweight: tokens are signed in `src/controllers/user/loginUser.ts` and parsed in `src/middlewares/auth.ts` (env var: `JWT_SECRET`).
- Request lifecycle logging and a per-request `requestId` header is defined in `requestLogger` in `src/middlewares/auth.ts`. Controllers may rely on `req.user` and `req.requestId`.
- **Audit logging**: `src/prisma.ts` wraps the Prisma client with a Proxy-based audit interceptor using AsyncLocalStorage. Mutations (create/update/upsert/delete) automatically log to `AuditLog` table when context has `userId` and `companyId`. See `attachAuditContext` middleware that runs per-request.

## Project-specific conventions

- **Module system**: TypeScript, CommonJS (see `package.json` field `type: "commonjs"`). Keep imports/exports consistent with existing files (no ESM syntax).
- **Controllers**: Plain async functions `(req: Request, res: Response)` that return JSON responses with HTTP status codes. Use early returns for validation errors. Never throw unhandled errors—controllers catch and return error JSON.
- **Error handling**: Central `errorHandler` middleware (`src/middlewares/auth.ts`) logs via `src/utils/logger` (pino) and returns `{ error, requestId }`. Controllers should catch and respond, not throw.
- **Password hashing**: Use `hashPassword` / `verifyPassword` from `src/utils/password.ts` (bcrypt). Never store plaintext passwords.
- **Logging**: Use `src/utils/logger.ts` (pino). Logs to console (dev with pino-pretty) and `logs/app.log` (prod). Logger redacts password fields automatically.

## Important files to reference (examples)

- `src/index.ts` — where app is created and routes are wired. Shows middleware order, health endpoint, and error handler placement.
- `src/middlewares/auth.ts` — requestId generation, request logging, JWT parsing (`loadUser`), `attachAuditContext`, `requireRole()` helper, and central error handler.
- `src/prisma.ts` — singleton Prisma client exported as `prisma`. Uses Proxy + AsyncLocalStorage for automatic audit logging on mutations.
- `src/controllers/company/createCompany.ts` — example transaction creating Company + User with proper error handling and `prisma.$transaction`.
- `src/controllers/company/getCompanies.ts` — reference pagination pattern with rich metadata (limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset).
- `src/controllers/user/loginUser.ts` — JWT signing flow (`signToken` uses `JWT_SECRET` and sets `sub` to user id, 30d expiry).
- `prisma/schema.prisma` — canonical data model (User, Company, Account, JournalEntry, JournalLine, AuditLog). Note enums: `UserRole`, `CommonStatus`, `AccountType`.
- `prisma/seed.ts` — seed script (run via `npm run seed`) creating SUPER_ADMIN user with hashed password.
- `src/utils/logger.ts` — pino logger with password redaction, pino-pretty for dev, file logging to `logs/app.log`.

## Developer workflows (commands)

- Install deps: `npm install`
- Run in dev mode (ts-node-dev): `npm run dev` (uses `src/index.ts`) on port via `PORT` env var (default 4000).
- Build: `npm run build` (tsc) then `npm start` to run compiled `dist/index.js`.
- Seed database: `npm run seed` (invokes `ts-node prisma/seed.ts`).

## Environment

- .env variables to be aware of: `DATABASE_URL` (Postgres), `JWT_SECRET` (token signing).

## Patterns and gotchas

- Keep Prisma client usage centralized via `src/prisma.ts` (do not create new PrismaClient instances per request).
- Use transactions where multiple related DB changes occur (see `createCompany.ts` with `prisma.$transaction` using the transactional client `tx`).
- Controllers return JSON errors with `error` field and sometimes include `requestId`. Preserve this shape when adding endpoints.
- `getCompanies` is implemented and restricted to `SUPER_ADMIN` and `MODERATOR` roles; it returns rich pagination metadata (limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset). Use it as the reference pattern for future paginated list endpoints.

## Examples to copy/paste

- Signing tokens: see `src/controllers/user/loginUser.ts` (`signToken` uses `JWT_SECRET` and sets `sub` to user id).
- Role check middleware: use `requireRole([UserRole.COMPANY_ADMIN])` from `src/middlewares/auth.ts` when protecting routes.

## When editing repository files

- Preserve CommonJS `type: "commonjs"` behavior or update `package.json` and build steps intentionally if switching to ESM.

## What NOT to do

- Don't add multiple PrismaClient instances. Don't bypass `req.requestId` and centralized logging.
- Don't assume `JWT_SECRET` exists in development — code falls back to `dev-secret-change`, but prefer using env variables.

## If you need clarification

- Ask which environment to run (dev DB vs test DB). For schema changes, run Prisma migrations manually (this repo uses Prisma; no migrations are checked in here).

End of instructions — please ask for clarifications or feedback so I can iterate.
