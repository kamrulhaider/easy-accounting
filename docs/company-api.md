# API Reference – Company routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

## Companies (`/companies`)

Requires `Authorization: Bearer <token>`. Roles vary per route.

### POST /companies

- Role: `SUPER_ADMIN`
- Body: `{ company: { name, email, description?, address?, phone? }, admin: { username, email, password, name?, phone?, address? } }`
- Creates a company and its first `COMPANY_ADMIN` user (password is hashed server-side).
- Success: `201 { company, admin }` (admin excludes password)
- Errors: `400` validation/email-or-username conflict, `401` unauthorized

### GET /companies

- Role: `SUPER_ADMIN|MODERATOR` (sees all); `COMPANY_ADMIN` (only own company)
- Query: `q?` (name/email contains), `status?` (`ACTIVE|INACTIVE|PENDING|SUSPENDED`), `limit?` 1-100 (default 50), `offset?` (default 0), `includeDeleted?` (`true|false`, elevated roles only)
- Excludes soft-deleted by default; elevated roles may opt-in with `includeDeleted=true`.
- Success: `{ companies, total, pagination: { limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset } }`
- Errors: `401` unauthorized, `403` forbidden, `500` on failure

### GET /companies/:id

- Role: `SUPER_ADMIN|MODERATOR` (any company); `COMPANY_ADMIN` (own company only)
- Success: `{ company }`
- Errors: `401` unauthorized, `403` forbidden, `404` not found (including soft-deleted), `500` on failure

### PATCH /companies/:id

- Role: `SUPER_ADMIN|MODERATOR`
- Body: any of `{ name, email, description, address, phone, status }` (`status` must be a valid `CommonStatus`)
- Email is unique across companies; update is rejected if email is already used.
- Success: `{ company }`
- Errors: `400` no valid fields or email conflict, `401` unauthorized, `403` forbidden, `404` not found, `500` on failure

### PATCH /companies/my

- Role: `COMPANY_ADMIN`
- Scope: updates only the admin's own company (derived from the authenticated user's `companyId`)
- Body: any of `{ description, address, phone, currency }`
- Success: `{ company }`
- Errors: `400` no valid fields, `401` unauthorized, `403` forbidden, `404` company not found, `500` on failure

Example request body:

```json
{
  "description": "Updated company description",
  "address": "123 Main St, City",
  "phone": "+880123456789",
  "currency": "USD"
}
```

### PATCH /companies/:id/deactivate

- Role: `SUPER_ADMIN`
- Sets company `status` to `INACTIVE` (does not delete).
- Success: `{ company }`
- Errors: `401` unauthorized, `403` forbidden, `404` not found (or deleted), `500` on failure

### PATCH /companies/:id/reactivate

- Role: `SUPER_ADMIN|MODERATOR`
- Sets company `status` to `ACTIVE` (only when not soft-deleted).
- Success: `{ company }`
- Errors: `401` unauthorized, `403` forbidden, `404` not found (or deleted), `500` on failure

### DELETE /companies/:id

- Role: `SUPER_ADMIN`
- Soft-deletes a company (`deletedAt` set, `status` set to `INACTIVE`).
- Success: `204 No Content` (idempotent if already deleted)
- Errors: `401` unauthorized, `403` forbidden, `404` not found, `500` on failure
