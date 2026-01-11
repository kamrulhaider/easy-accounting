# API Reference – Journal Entry routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

All endpoints below are mounted under `/journal-entries` and are company-scoped. The authenticated user must belong to the target company.

## Permissions

- Router-level middleware allows roles: `COMPANY_ADMIN`, `COMPANY_USER` for all read/create/update routes.
- `DELETE /journal-entries/:id` is restricted to `COMPANY_ADMIN`.
- Controllers additionally enforce that `req.user.companyId` matches the `companyId` of the resource/body/query.

## Endpoints

### POST /journal-entries

Create a balanced journal entry with one or more lines.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Body:
  ```json
  {
    "companyId": "string",
    "date": "ISO date string or Date-compatible value",
    "description": "optional string",
    "lines": [
      {
        "accountId": "string",
        "debitAmount": 100, // > 0 OR
        "creditAmount": 0, // > 0 (exactly one of debit/credit)
        "description": "optional string"
      }
    ]
  }
  ```
- Behavior:
  - Requires `companyId`, `date`, and non-empty `lines` array.
  - Requires authenticated user with `companyId` equal to body `companyId`.
  - Validates `date` is a valid date.
  - For each line:
    - Requires `accountId`.
    - Exactly one of `debitAmount` or `creditAmount` must be > 0.
    - Amounts are rounded half-up to integers; rounded values must be > 0.
  - Totals must balance after rounding: total debits = total credits > 0.
  - In a transaction:
    - Validates company exists and is `ACTIVE`.
    - Validates all referenced accounts exist, belong to the company, and are `ACTIVE`.
    - Creates the journal entry and associated `journalLines`.
- Success (201):
  ```json
  {
    "entry": {
      "id": "...",
      "date": "...",
      "description": "...",
      "companyId": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "journalLines": [
        {
          "id": "...",
          "accountId": "...",
          "debitAmount": 100,
          "creditAmount": null,
          "description": "...",
          "createdAt": "...",
          "updatedAt": "...",
          "account": {
            "id": "...",
            "name": "Cash",
            "accountType": "ASSET"
          }
        }
      ]
    }
  }
  ```
- Errors:
  - `400` – missing required fields; `Invalid date`; line validation errors (missing `accountId`, both/neither debit/credit, non-positive rounded amount); unbalanced totals; or business errors like `Company not found`, `Company inactive`, `Some accounts not found`, `Account does not belong to company`, `Account inactive`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` on company mismatch.

### GET /journal-entries

List journal entries for a company with optional filters, totals, and pagination.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query:
  - `companyId` (string, required)
  - `q?` – filter description by case-insensitive contains
  - `startDate?` – ISO date string; filters `date >= startDate`
  - `endDate?` – ISO date string; filters `date <= endDate`
  - `accountId?` – when provided, returns only entries that have at least one line for this account
  - `limit?` – number (1–100, default 50)
  - `offset?` – number (default 0)
  - `all?` – `true|false`; when `true`, returns all entries (no pagination; `limit` ignored and `offset` forced to 0)
- Behavior:
  - Requires `companyId` and authenticated user with matching `companyId`.
  - Excludes soft-deleted entries (`deletedAt != null`).
  - Optional description and date range filters.
  - If `accountId` is provided, first finds entry ids having at least one line with that `accountId` in the company, and filters results to those ids.
  - Returns a page of entries, each with per-entry debit/credit totals based on their lines, as well as overall totals across the page.
- Success (200):
  ```json
  {
    "entries": [
      {
        "id": "...",
        "date": "...",
        "description": "...",
        "companyId": "...",
        "createdAt": "...",
        "updatedAt": "...",
        "totals": { "debit": 100, "credit": 100 }
      }
    ],
    "total": 1,
    "totals": { "debit": 100, "credit": 100 },
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
  - `400` – `companyId required`, `Invalid startDate`, `Invalid endDate`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when `companyId` mismatch.
  - `500` – `Failed to fetch journal entries`.

### GET /journal-entries/:id

Get a full journal entry including its lines.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – journal entry id
- Behavior:
  - Fetches the entry by id, including all `journalLines` and their linked `account`.
  - Returns `404` if the entry does not exist or has been soft-deleted (`deletedAt` set).
  - Ensures authenticated user belongs to the same company as the entry.
- Success (200):
  ```json
  {
    "entry": {
      "id": "...",
      "date": "...",
      "description": "...",
      "companyId": "...",
      "createdAt": "...",
      "updatedAt": "...",
      "journalLines": [
        {
          "id": "...",
          "accountId": "...",
          "debitAmount": 100,
          "creditAmount": null,
          "description": "...",
          "createdAt": "...",
          "updatedAt": "...",
          "account": {
            "id": "...",
            "name": "Cash",
            "accountType": "ASSET"
          }
        }
      ]
    }
  }
  ```
- Errors:
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Journal entry not found` (also for soft-deleted entries).
  - `500` – `Failed to fetch journal entry`.

### PATCH /journal-entries/:id

Update the date/description of a journal entry and optionally replace all its lines.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – journal entry id
- Body:
  ```json
  {
    "date": "optional ISO date string",
    "description": "optional string",
    "lines": [
      {
        "accountId": "string",
        "debitAmount": 100,
        "creditAmount": 0,
        "description": "optional string"
      }
    ]
  }
  ```
- Behavior:
  - At least one of `date`, `description`, or `lines` must be provided; otherwise responds `400`.
  - If `date` is provided, validates it as a valid date.
  - If `lines` is provided:
    - Must be a non-empty array.
    - Same per-line validation as creation: exactly one positive `debitAmount` or `creditAmount`, rounded half-up to integers, and entry must balance after rounding.
    - Validates that all referenced accounts exist, belong to the entry's company, and are `ACTIVE`.
    - Replaces all existing lines atomically (deletes old lines, inserts new ones) inside a transaction.
  - Ensures entry exists, is not soft-deleted, and belongs to the same company as the authenticated user.
- Success (200): same shape as GET by id (`{ entry }` with full line details).
- Errors:
  - `400` – `No fields to update`, `Invalid date`, line validation errors, unbalanced totals, `Some accounts not found`, `Account does not belong to company`, `Account inactive`, or other validation/business errors.
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Journal entry not found`.

### DELETE /journal-entries/:id

Soft-delete a journal entry.

- Roles: `COMPANY_ADMIN`
- Path params: `id` – journal entry id
- Behavior:
  - Ensures entry exists and belongs to the same company as the authenticated user.
  - If already soft-deleted, returns `204` with empty body.
  - Otherwise, sets `deletedAt` to the current timestamp.
- Success (204): empty body
- Errors:
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Journal entry not found`.
  - `500` – `Failed to delete journal entry`.
