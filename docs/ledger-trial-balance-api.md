# API Reference – Ledger & Trial Balance routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

Ledger and trial balance endpoints are company-scoped. The authenticated user must belong to the target company.

## Permissions

- Router-level middleware allows roles: `COMPANY_ADMIN`, `COMPANY_USER` for both `/ledger` and `/trial-balance` GET routes.
- Controllers additionally enforce that `req.user.companyId` matches the `companyId` query parameter.

## Ledger (`/ledger`)

### GET /ledger

Return a paginated general ledger for a single account, including running balances.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query parameters:

  - `companyId` (string, required)
  - `accountId` (string, required) – id of the account whose ledger to fetch
  - `startDate?` – ISO date string; include only lines whose journal entry date is `>= startDate`
  - `endDate?` – ISO date string; include only lines whose journal entry date is `<= endDate`
  - `limit?` – number (1–100, default 50)
  - `offset?` – number (default 0)
  - `all?` – `true|false`; when `true`, return all matching lines (no pagination; `limit` ignored and `offset` forced to 0)

- Behavior:

  - Requires authenticated user with `companyId` equal to query `companyId`.
  - Validates `companyId` and `accountId` are provided.
  - Validates `startDate` / `endDate` when present.
  - Loads the account and returns `404` if not found or if it belongs to another company.
  - Considers only non-deleted journal entries and lines (`deletedAt` null on both).
  - Optional date range is applied via the journal entry's `date` field.
  - Computes:
    - `startBalance`: net of all matching lines before the current page (for pagination stability).
    - A page of lines ordered by journal entry date, creation time, and id.
    - For each line, a running `balance` starting from `startBalance` and adding `debitAmount - creditAmount`.
    - Totals across all matching lines (not just the page): `debit`, `credit`, and `net`.

- Success (200):

  ```json
  {
    "account": {
      "id": "...",
      "name": "Cash",
      "accountType": "ASSET",
      "status": "ACTIVE"
    },
    "lines": [
      {
        "id": "...",
        "date": "2024-01-01T00:00:00.000Z",
        "journalEntryId": "...",
        "journalEntryDescription": "Invoice 123",
        "description": "optional line description",
        "debitAmount": 100,
        "creditAmount": 0,
        "balance": 100,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ],
    "totals": {
      "debit": 100,
      "credit": 0,
      "net": 100
    },
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
  - `400` – `companyId required`, `accountId required`, `Invalid startDate`, or `Invalid endDate`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when `companyId` mismatch.
  - `404` – `Account not found` (either missing or belonging to another company).
  - `500` – `Failed to fetch ledger`.

## Trial Balance (`/trial-balance`)

### GET /trial-balance

Return a trial balance for all accounts in a company, with per-account debit/credit/net balances and overall totals.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query parameters:

  - `companyId` (string, required)
  - `startDate?` – ISO date string; include journal lines whose journal entry date is `>= startDate`
  - `endDate?` – ISO date string; include journal lines whose journal entry date is `<= endDate`
  - `status?` – optional account status filter; must be a valid `CommonStatus` (e.g. `ACTIVE`, `INACTIVE`, etc.)

- Behavior:

  - Requires authenticated user with `companyId` equal to query `companyId`.
  - Validates `startDate` and `endDate` when provided, and ensures `startDate <= endDate`.
  - Loads all accounts in the company (optionally filtered by `status`).
  - If there are no accounts, returns empty `accounts` with all totals = 0.
  - Aggregates all non-deleted journal lines for those accounts (within the optional date range and from non-deleted journal entries) and groups by `accountId`.
  - For each account, computes:
    - `debit` – total debits
    - `credit` – total credits
    - `net` – `debit - credit`
    - `debitBalance` – `max(net, 0)`
    - `creditBalance` – `max(-net, 0)`
  - Computes overall totals across all accounts: total `debit`, `credit`, `net`, `debitBalance`, `creditBalance`.

- Success (200):

  ```json
  {
    "accounts": [
      {
        "id": "...",
        "name": "Cash",
        "accountType": "ASSET",
        "status": "ACTIVE",
        "debit": 1000,
        "credit": 200,
        "net": 800,
        "debitBalance": 800,
        "creditBalance": 0
      }
    ],
    "totals": {
      "debit": 1000,
      "credit": 200,
      "net": 800,
      "debitBalance": 800,
      "creditBalance": 0
    },
    "filters": {
      "companyId": "...",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.000Z",
      "status": "ACTIVE"
    }
  }
  ```

- Errors:
  - `400` – `companyId required`, `Invalid startDate`, `Invalid endDate`, or `startDate must be before or equal to endDate`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when `companyId` mismatch.
  - `500` – `Failed to fetch trial balance`.
