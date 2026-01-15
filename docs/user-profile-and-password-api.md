# API Reference – User profile & password

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`).

All endpoints in this document are mounted under `/auth`.

## GET /auth/me

Return the authenticated user's profile and (if applicable) their company.

- Authentication: **Required** (`Authorization: Bearer <token>`)
- Roles: Any authenticated user
- Behavior:
  - Reads the user id from the JWT (via `req.user`).
  - Loads the user by id, excluding password hash.
  - Includes the user's company summary (if the user belongs to a company).
- Success (200):
  ```json
  {
    "user": {
      "id": "...",
      "username": "jdoe",
      "email": "jdoe@example.com",
      "userRole": "COMPANY_ADMIN",
      "status": "ACTIVE",
      "name": "John Doe",
      "phone": "+1-555-1234",
      "address": "123 Main St",
      "company": {
        "id": "...",
        "name": "Acme Inc.",
        "email": "info@acme.test",
        "status": "ACTIVE"
      },
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-02-01T08:30:00.000Z"
    }
  }
  ```
- Error responses (examples):
  - `401 Unauthorized`
    - No/invalid token or user not attached: `{ "error": "Unauthorized" }`
  - `404 Not Found`
    - User id from token does not exist: `{ "error": "User not found" }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to load profile", "requestId": "..." }`

## POST /auth/change-password

Change the authenticated user's password.

- Authentication: **Required** (`Authorization: Bearer <token>`)
- Roles: Any authenticated user
- Body (JSON):
  ```json
  {
    "currentPassword": "old-password",
    "newPassword": "new-strong-password"
  }
  ```
- Validation rules:
  - `currentPassword` and `newPassword` are both required.
  - `newPassword` must be at least 8 characters long.
  - `newPassword` must be different from `currentPassword`.
- Behavior:
  - Loads the current user using the id from the JWT.
  - Verifies `currentPassword` against the stored (bcrypt) hash.
  - If valid, hashes `newPassword` and updates the user record.
- Success (200):
  ```json
  {
    "message": "Password updated"
  }
  ```
- Error responses (examples):
  - `400 Bad Request`
    - Missing fields: `{ "error": "currentPassword and newPassword required" }`
    - Too short: `{ "error": "newPassword must be at least 8 characters" }`
    - Same as current: `{ "error": "newPassword must be different from currentPassword" }`
  - `401 Unauthorized`
    - No/invalid token: `{ "error": "Unauthorized" }`
    - Wrong current password: `{ "error": "Invalid current password" }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to change password", "requestId": "..." }`
