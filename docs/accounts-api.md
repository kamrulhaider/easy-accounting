# API Reference – Account routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

All endpoints below are mounted under `/accounts` and are company-scoped. The authenticated user must belong to the target company.

## Permissions

- Router-level middleware allows roles: `COMPANY_ADMIN`, `COMPANY_USER` for all `/accounts` routes.
- Controllers additionally enforce that `req.user.companyId` matches the `companyId` of the resource/body/query.

## Endpoints

### POST /accounts

Create an account in a company.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Body: `{ companyId: string, name: string, accountType: AccountType, categoryId?: string }`
  - `AccountType` is an enum from Prisma (e.g. `ASSET`, `LIABILITY`, `EQUITY`, `INCOME`, `EXPENSE`; see schema for full list).
- Behavior:
  - Requires `companyId`, `name`, and `accountType`.
  - Validates `accountType` against the `AccountType` enum.
  - Requires authenticated user with `companyId` equal to the body `companyId`.
  - Ensures the company exists and is `ACTIVE`.
  - Ensures `name` is unique per company.
  - If `categoryId` is supplied, validates that category exists and belongs to the same company.
- Success (201): `{ account }` with `{ id, name, accountType, status, companyId, categoryId, createdAt, updatedAt }`
- Errors:
  - `400` – `companyId, name, accountType required`, `Invalid accountType`, `Company inactive`, or `Account name already exists in company`, `Invalid categoryId`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context`, `Forbidden`, or `Forbidden category`.
  - `404` – `Company not found`.
  - `500` – `Failed to create account` (or an error message derived from the thrown error).

### GET /accounts

List accounts for a company with filtering and pagination.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query:
  - `companyId` (string, required)
  - `q?` – optional name search (case-insensitive contains)
  - `type?` – optional account type (must be valid `AccountType`)
  - `status?` – optional status (must be valid `CommonStatus`)
  - `categoryId?` – string; when `"null"`, filters for uncategorized accounts; otherwise filters by that category id
  - `limit?` – number (1-100, default 50)
  - `offset?` – number (default 0)
  - `all?` – `true|false`; when `true`, returns all accounts (no pagination; `limit` ignored and `offset` forced to 0)
- Behavior:
  - Requires `companyId` and authenticated user with matching `companyId`.
  - Applies filters for name, type, status, and category when provided.
  - Returns current page of accounts plus pagination metadata and `totalAccounts` for the company (ignoring filters).
- Success (200):
  ```json
  {
    "accounts": [
      {
        "id": "...",
        "name": "...",
        "accountType": "ASSET",
        "status": "ACTIVE",
        "companyId": "...",
        "categoryId": "...",
        "category": { "id": "...", "name": "..." },
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "total": 1,
    "totalAccounts": 10,
    "pagination": {
      "limit": 50,
      "offset": 0,
      "currentPage": 1,
      "pageCount": 1,
      "itemsOnPage": 1,
      "hasNextPage": false,
      "hasPrevPage": false,
      "nextOffset": null,
      "prevOffset": null
    }
  }
  ```
- Errors:
  - `400` – `companyId required` or invalid pagination/filter values.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when `companyId` mismatch.
  - `500` – `Failed to fetch accounts`.

### GET /accounts/:id

Get a single account by id.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – account id
- Behavior:
  - Looks up the account by id, including its category summary.
  - Ensures authenticated user belongs to the same company as the account.
- Success (200): `{ account }` with `{ id, name, accountType, status, companyId, categoryId, category, createdAt, updatedAt }`
- Errors:
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Account not found`.
  - `500` – `Failed to fetch account`.

### PATCH /accounts/:id

Update basic fields on an account.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – account id
- Body: partial `{ name?: string, status?: CommonStatus, accountType?: AccountType, categoryId?: string|null }`
- Behavior:
  - At least one updatable field must be provided; otherwise responds `400`.
  - Validates `accountType` against `AccountType` and `status` against `CommonStatus`.
  - Ensures account exists and belongs to the same company as the authenticated user.
  - If `name` is provided, ensures uniqueness per company.
  - If `categoryId` is present in the body:
    - `null` clears the category.
    - String ids are validated to exist and belong to the same company.
- Success (200): `{ account }` with `{ id, name, status, accountType, companyId, categoryId, updatedAt }`
- Errors:
  - `400` – `No fields to update`, `Invalid accountType`, `Invalid status`, `Account name already exists`, or `Invalid categoryId`.
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` or `Forbidden category` when company/category mismatch.
  - `404` – `Account not found`.
  - `500` – `Failed to update account`.

### PATCH /accounts/:id/deactivate

Deactivate an account by setting its status to `INACTIVE`.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – account id
- Behavior:
  - Ensures account exists and belongs to the same company as the authenticated user.
  - Sets `status` to `INACTIVE`.
- Success (200): `{ account }` with `{ id, name, status }`
- Errors:
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Account not found`.
  - `500` – `Failed to deactivate account`.
