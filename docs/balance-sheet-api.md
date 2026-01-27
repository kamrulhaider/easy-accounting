# API Reference – Balance Sheet

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

The balance sheet endpoint is company-scoped. The authenticated user must belong to the target company.

## Permissions

- Router-level middleware allows roles: `COMPANY_ADMIN`, `COMPANY_USER` for `/balance-sheet` GET route.
- Controller additionally enforces that `req.user.companyId` matches the `companyId` query parameter.

## Balance Sheet (`/balance-sheet`)

### GET /balance-sheet

Return a balance sheet for a company by aggregating Assets, Liabilities, and Equity.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query parameters:
  - `companyId` (string, required)
  - `startDate?` – ISO date string; include journal lines whose journal entry date is `>= startDate`
  - `endDate?` – ISO date string; include journal lines whose journal entry date is `<= endDate`
  - `status?` – optional account status filter; must be a valid `CommonStatus` (e.g. `ACTIVE`, `INACTIVE`, etc.)

- Behavior:
  - Requires authenticated user with `companyId` equal to query `companyId`.
  - Validates `startDate` and `endDate` when provided, and ensures `startDate <= endDate`.
  - Loads company accounts filtered to `ASSET`, `LIABILITY`, and `EQUITY` (excludes `REVENUE` and `EXPENSE`). Optionally filters by account `status`.
  - Aggregates all non-deleted journal lines for those accounts (within the optional date range and from non-deleted journal entries) and groups by `accountId`.
  - For each account, computes net = `debit - credit` and maps to section balances by natural side:
    - Assets: `balance = max(net, 0)` (debit nature)
    - Liabilities: `balance = max(-net, 0)` (credit nature)
    - Equity: `balance = max(-net, 0)` (credit nature)
  - Computes section totals and checks accounting equation: `assetsTotal == liabilitiesTotal + equityTotal` (reported via `equationBalanced`).

- Success (200):

  ```json
  {
    "assets": {
      "total": 1000,
      "accounts": [{ "id": "...", "name": "Cash", "balance": 800 }]
    },
    "liabilities": {
      "total": 600,
      "accounts": [{ "id": "...", "name": "Accounts Payable", "balance": 600 }]
    },
    "equity": {
      "total": 400,
      "accounts": [{ "id": "...", "name": "Owner's Equity", "balance": 400 }]
    },
    "totals": {
      "assets": 1000,
      "liabilities": 600,
      "equity": 400,
      "equationBalanced": true
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
  - `500` – `Failed to fetch balance sheet`.
