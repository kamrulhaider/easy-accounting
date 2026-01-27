# API Reference – Update Company Admin (SUPER_ADMIN)

Base URL: http://localhost:4000
Authentication: Bearer JWT in Authorization header (Bearer <token>).

All endpoints in this document are mounted under `/users` and require `SUPER_ADMIN` role.

## PATCH /users/admins/:id

Update basic fields for a `COMPANY_ADMIN` user in any company.

- Role: SUPER_ADMIN
- Authentication: Required (Authorization: Bearer <token>)
- Path params:
  - `id` – user id of the target COMPANY_ADMIN.
- Body (JSON):
  ```json
  {
    "name": "Updated Admin",
    "phone": "+1-555-1111",
    "address": "456 Second St",
    "status": "INACTIVE"
  }
  ```

  - All fields are optional; at least one valid field must be provided.
  - `status` must be a valid `CommonStatus` (e.g. `ACTIVE`, `INACTIVE`, `PENDING`, `SUSPENDED`).

### Behavior

- Ensures the authenticated actor has role SUPER_ADMIN.
- Ensures the target user exists, is not soft-deleted (`deletedAt` is null), and has `userRole = COMPANY_ADMIN`.
- Applies only provided, valid fields; ignores unknown fields and rejects when no valid fields are present.

### Success (200)

```json
{
  "user": {
    "id": "...",
    "username": "company-admin",
    "email": "admin@acme.test",
    "name": "Updated Admin",
    "phone": "+1-555-1111",
    "address": "456 Second St",
    "status": "INACTIVE",
    "userRole": "COMPANY_ADMIN",
    "companyId": "company-uuid",
    "createdAt": "2025-01-01T12:00:00.000Z",
    "updatedAt": "2025-01-03T10:00:00.000Z"
  }
}
```

### Error responses

- 400 Bad Request
  - Missing id: `{ "error": "User id required", "requestId": "..." }`
  - No valid fields: `{ "error": "No valid fields to update", "requestId": "..." }`
- 403 Forbidden
  - Actor is not SUPER_ADMIN or target user is not a COMPANY_ADMIN: `{ "error": "Forbidden", "requestId": "..." }`
- 404 Not Found
  - User not found or soft-deleted: `{ "error": "User not found", "requestId": "..." }`
- 500 Internal Server Error
  - Unexpected failure: `{ "error": "Failed to update user", "requestId": "..." }`

### Notes

- This endpoint is already documented within the broader users doc: see `docs/application-users-api.md` under "PATCH /users/admins/:id". This file provides a focused reference for the operation.
