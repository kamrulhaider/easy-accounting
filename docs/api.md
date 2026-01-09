# API Reference – User & Auth routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

## Auth endpoints (`/auth`)

### POST /auth/login
- Body: `{ "emailOrUsername": string, "password": string }`
- Success: `{ token, user: { username, role } }` (token expires in 30d)
- Errors: `400` missing fields, `401` invalid credentials, `500` on server errors.

### GET /auth/me
- Header: `Authorization: Bearer <token>`
- Success: `{ user }` with profile fields and `company` summary when present.
- Errors: `401` unauthorized, `404` user not found.

### POST /auth/change-password
- Header: `Authorization: Bearer <token>`
- Body: `{ "currentPassword": string, "newPassword": string }` (`newPassword` >= 8 and different from current)
- Success: `{ message: "Password updated" }`
- Errors: `400` validation, `401` invalid current password/unauthorized, `500` on failure.

## Company user management (`/users`)
Requires `COMPANY_ADMIN` role; scoped to the admin's own company. Soft-deletes via `deletedAt`. All responses include `requestId` on errors.

### POST /users
- Body: `{ username, email, password, name?, phone?, address?, status? }`
- Creates a `COMPANY_USER` in the admin's company. `status` defaults to `ACTIVE` if omitted/invalid.
- Success: `201 { user }` (selected fields, no password)
- Errors: `400` missing fields or no company context, `403` forbidden, `409` username/email exists, `500` on failure.

### GET /users
- Query: `q?` (search username/email/name, case-insensitive), `status?` (`ACTIVE|INACTIVE|PENDING|SUSPENDED`), `limit?` (1-100, default 50), `offset?` (default 0)
- Returns users within the admin's company with pagination metadata: `{ users, total, pagination: { limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset } }`
- Errors: `400` no company context, `403` forbidden, `500` on failure.

### GET /users/:id
- Returns a single `COMPANY_USER` in the admin's company.
- Errors: `400` missing id, `403` forbidden, `404` not found, `500` on failure.

### PATCH /users/:id
- Body: any of `{ name, phone, address, status }` (`status` must be a valid `CommonStatus`).
- Updates user fields (company/user-role scope enforced).
- Errors: `400` missing id or no valid fields, `403` forbidden, `404` not found, `500` on failure.

### DELETE /users/:id
- Soft-delete a `COMPANY_USER` in the admin's company; self-delete is blocked.
- Errors: `400` missing id or self-delete, `403` forbidden, `404` not found, `500` on failure.

## Request/response examples

### Login
```http
POST /auth/login
Content-Type: application/json

{ "emailOrUsername": "admin", "password": "admin123" }
```

Response
```json
{
  "token": "<jwt>",
  "user": { "username": "admin", "role": "SUPER_ADMIN" }
}
```

### List company users (with pagination)
```http
GET /users?limit=20&offset=0&q=john
Authorization: Bearer <token>
```

Response
```json
{
  "users": [
    {
      "id": "...",
      "username": "john",
      "email": "john@example.com",
      "status": "ACTIVE",
      "userRole": "COMPANY_USER",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "total": 1,
  "pagination": {
    "limit": 20,
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