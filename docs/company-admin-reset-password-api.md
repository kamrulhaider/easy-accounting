# API Reference – Reset Company Admin Password (SUPER_ADMIN)

Base URL: http://localhost:4000
Authentication: Bearer JWT in Authorization header (Bearer <token>).

All endpoints in this document are mounted under `/users` and require `SUPER_ADMIN` role.

## POST /users/admins/:id/reset-password

Reset the password for a `COMPANY_ADMIN` user to the default value `12345678`.

- Role: SUPER_ADMIN
- Authentication: Required (Authorization: Bearer <token>)
- Path params:
  - `id` – user id of the target COMPANY_ADMIN.
- Body: none

### Behavior

- Ensures the authenticated actor has role SUPER_ADMIN.
- Ensures the target user exists, is not soft-deleted (`deletedAt` is null), and has `userRole = COMPANY_ADMIN`.
- Sets the user's password to the bcrypt-hashed default `"12345678"`.

### Success (200)

```json
{
  "message": "Password reset to default",
  "user": { "id": "...", "userRole": "COMPANY_ADMIN" },
  "defaultPassword": "12345678"
}
```

### Error responses

- 400 Bad Request
  - Missing id: `{ "error": "User id required", "requestId": "..." }`
- 403 Forbidden
  - Actor is not SUPER_ADMIN or target user is not a COMPANY_ADMIN: `{ "error": "Forbidden", "requestId": "..." }`
- 404 Not Found
  - User not found or soft-deleted: `{ "error": "User not found", "requestId": "..." }`
- 500 Internal Server Error
  - Unexpected failure: `{ "error": "Failed to reset password", "requestId": "..." }`

### Notes

- Consider prompting the user to change their password on next login through a separate flow.
