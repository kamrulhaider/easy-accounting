# API Reference – Account Category routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

All endpoints below are mounted under `/account-categories` and are company-scoped. The authenticated user must belong to the target company.

## Permissions

- `COMPANY_ADMIN` can create, list, update, delete categories and move accounts.
- `COMPANY_USER` can currently access `POST /account-categories`, `GET /account-categories`, and `PATCH /account-categories/:id` (see router), but will still be rejected if they are not in the specified company.

## Endpoints

### POST /account-categories

Create an account category for a company.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Body: `{ companyId: string, name: string }`
- Behavior:
  - Requires the authenticated user to have `companyId` equal to the body `companyId`.
  - Fails if the company does not exist.
  - Fails if another category with the same `name` already exists in the company.
- Success (201): `{ category }` with `{ id, name, companyId, createdAt, updatedAt }`
- Errors:
  - `400` – `companyId and name required` or duplicate category name.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when companyId mismatch.
  - `404` – `Company not found`.
  - `500` – `Failed to create category`.

### GET /account-categories

List account categories for a company with pagination and account counts.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Query:
  - `companyId` (string, required)
  - `q?` – optional name search (case-insensitive contains)
  - `limit?` – number (1-100, default 50)
  - `offset?` – number (default 0)
  - `all?` – `true|false`; when `true`, returns all categories (no pagination, `limit` ignored; `offset` forced to 0)
- Behavior:
  - Requires authenticated user with matching `companyId`.
  - Returns each category with an `accountCount` field (number of accounts assigned to that category in the company).
  - Also returns `uncategorizedCount` and `totalAccounts` for the company.
- Success (200):
  ```json
  {
    "categories": [
      {
        "id": "...",
        "name": "...",
        "companyId": "...",
        "createdAt": "...",
        "updatedAt": "...",
        "accountCount": 0
      }
    ],
    "total": 1,
    "uncategorizedCount": 0,
    "totalAccounts": 1,
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
  - `400` – `companyId required` or invalid pagination values.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context` or `Forbidden` when companyId mismatch.
  - `500` – `Failed to fetch categories`.

### PATCH /account-categories/:id

Rename an account category.

- Roles: `COMPANY_ADMIN`, `COMPANY_USER`
- Path params: `id` – category id
- Body: `{ name: string }`
- Behavior:
  - Requires `name`.
  - Ensures the category exists and belongs to the same company as the authenticated user.
  - Enforces uniqueness of `name` within the company (excluding this category).
- Success (200): `{ category }` with `{ id, name, companyId, updatedAt }`
- Errors:
  - `400` – `name required` or `Category name already exists`.
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Category not found`.
  - `500` – `Failed to update category`.

### DELETE /account-categories/:id

Hard-delete a category. Accounts that referenced it will have `categoryId` set to `null` (via `onDelete: SetNull`).

- Roles: `COMPANY_ADMIN`
- Path params: `id` – category id
- Behavior:
  - Ensures the category exists and belongs to the same company as the authenticated user.
  - Deletes the category.
- Success (204): empty body
- Errors:
  - `401` – `Unauthorized`.
  - `403` – `Forbidden` when user has no/mismatched company.
  - `404` – `Category not found`.
  - `500` – `Failed to delete category`.

### POST /account-categories/move

Move all accounts from one category to another within the same company (or to/from `null`).

- Roles: `COMPANY_ADMIN`
- Body: `{ companyId: string, fromCategoryId: string|null, toCategoryId: string|null }`
- Behavior:
  - Requires authenticated user with matching `companyId`.
  - `fromCategoryId` and `toCategoryId` may be strings or `null`.
  - If `fromCategoryId === toCategoryId`, returns `{ moved: 0 }` without changes.
  - When provided (non-null), both `fromCategoryId` and `toCategoryId` must exist and belong to the same company.
  - Moves all accounts in `companyId` where `categoryId` equals `fromCategoryId` (or `null` when `fromCategoryId` is `null`) to `toCategoryId` (or `null`).
- Success (200): `{ moved: number }`
- Errors:
  - `400` – `companyId required`, `Invalid fromCategoryId`, or `Invalid toCategoryId`.
  - `401` – `Unauthorized`.
  - `403` – `User has no company context`, `Forbidden`, `Forbidden fromCategoryId`, or `Forbidden toCategoryId` on cross-company access.
  - `500` – `Failed to move accounts`.
