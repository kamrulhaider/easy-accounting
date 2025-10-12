# Copilot / AI contributor instructions for easy-accounting

This file contains concise, project-specific guidance to help AI assistants be productive in this repository.

Overview

- This is a small Express + TypeScript API backed by Prisma (Postgres). Key folders: `src/` (app code), `prisma/` (schema + seed), `__tests__/` (jest tests).
- App entry: `src/index.ts`. Prisma client is created in `src/prisma.ts` and used directly from controllers.

Architecture and data flow

- HTTP server (Express) -> middlewares (`src/middlewares/auth.ts`) -> routers (`src/routers/*`) -> controllers (`src/controllers/*`) -> Prisma client (`src/prisma.ts`) -> Postgres.
- Authentication is JWT-based but lightweight: tokens are signed in `src/controllers/user/loginUser.ts` and parsed in `src/middlewares/auth.ts` (env var: `JWT_SECRET`).
- Request lifecycle logging and a per-request `requestId` header is defined in `requestLogger` in `src/middlewares/auth.ts`. Controllers may rely on `req.user` and `req.requestId`.

Project-specific conventions

- TypeScript, CommonJS module style (see `package.json` field `type: "commonjs"`). Keep imports/exports consistent with existing files.
- Prisma models use explicit auditing fields (createdById/updatedById) across entities. New DB writes should set these when possible (see `createCompany` controller for pattern).
- Controllers are plain functions that accept `(req, res)` and return JSON responses with appropriate HTTP status codes. Use early returns for validation errors.
- Error handling: throw or pass errors; the central `errorHandler` middleware (`src/middlewares/auth.ts`) logs via `src/utils/logger` and returns an object `{ error, requestId }`.
- Password helpers live in `src/utils/password.ts` (use `hashPassword` / `verifyPassword`). Logging uses `src/utils/logger.ts` (pino).

Important files to reference (examples)

- `src/index.ts` — where app is created and routes are wired. Shows health endpoint and error handler placement.
- `src/middlewares/auth.ts` — requestId, request logging, JWT parsing, `requireRole()` helper, and central error handler.
- `src/prisma.ts` — singleton Prisma client exported as `prisma`.
- `src/controllers/company/createCompany.ts` — example transaction which creates a Company and User and sets auditing fields.
- `src/controllers/user/loginUser.ts` — example login flow and token signing.
- `prisma/schema.prisma` — canonical data model (User, Company, Account, JournalEntry, JournalLine, AuditLog). Note enums: `UserRole`, `CommonStatus`, `AccountType`.
- `prisma/seed.ts` — seed script (run via `npm run seed`) — useful when adding integration tests or demo data.

Developer workflows (commands)

- Install deps: npm install
- Run in dev mode (ts-node-dev): npm run dev (uses `src/index.ts`) on port via `PORT` env var (default 4000).
- Build: npm run build (tsc) then npm start to run compiled `dist/index.js`.
- Seed database: npm run seed (invokes `ts-node prisma/seed.ts`).
- Tests: npm test (uses dotenv-cli to load `.env.test`, runs jest in-band). Tests call `prisma.$connect()` in `jest.setup.ts` and expect a test DB connection.

Environment

- .env variables to be aware of: `DATABASE_URL` (Postgres), `JWT_SECRET` (token signing). Tests use `.env.test` via `dotenv-cli`.

Patterns and gotchas

- Keep Prisma client usage centralized via `src/prisma.ts` (do not create new PrismaClient instances per request).
- Use transactions where multiple related DB changes occur (see `createCompany.ts` with `prisma.$transaction` using the transactional client `tx`).
- Controllers return JSON errors with `error` field and sometimes include `requestId`. Preserve this shape when adding endpoints.
- `getCompanies` is implemented and restricted to `SUPER_ADMIN` and `MODERATOR` roles; it returns rich pagination metadata (limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset). Use it as the reference pattern for future paginated list endpoints.
- Tests run with NODE_ENV=test. Avoid relying on global state between tests; the project connects/disconnects Prisma in jest setup/teardown.

Examples to copy/paste

- Signing tokens: see `src/controllers/user/loginUser.ts` (signToken uses `JWT_SECRET` and sets `sub` to user id).
- Role check middleware: use `requireRole([UserRole.COMPANY_ADMIN])` from `src/middlewares/auth.ts` when protecting routes.

When editing repository files

- Preserve CommonJS `type: "commonjs"` behavior or update `package.json` and build steps intentionally if switching to ESM.
- Run the test suite locally after changes: `npm test` and ensure `jest.setup.ts` connects/disconnects Prisma.

What NOT to do

- Don't add multiple PrismaClient instances. Don't bypass `req.requestId` and centralized logging.
- Don't assume `JWT_SECRET` exists in development — code falls back to `dev-secret-change`, but prefer using env variables.

If you need clarification

- Ask which environment to run (dev DB vs test DB). For schema changes, run Prisma migrations manually (this repo uses Prisma; no migrations are checked in here).

End of instructions — please ask for clarifications or feedback so I can iterate.
