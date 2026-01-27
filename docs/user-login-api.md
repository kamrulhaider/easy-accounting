# API Reference – User login

Base URL: `http://localhost:4000`
Authentication: This endpoint does **not** require an existing token. It issues a new JWT on success.

All endpoints in this document are mounted under `/auth`.

## POST /auth/login

Authenticate a user by username or email and password.

- Roles: Any existing user (no role check before login; role is encoded in the token).
- Body (JSON):
  ```json
  {
    "usernameOrEmail": "user@example.com",
    "password": "plain-text-password"
  }
  ```
- Behavior:
  - Accepts either a username or an email in `usernameOrEmail`.
  - Looks up a non-deleted user and verifies the password using bcrypt.
  - If the user is inactive (status not `ACTIVE`) or soft-deleted, login is denied.
  - If the user belongs to a company and the company is inactive (status not `ACTIVE`) or deleted (has a `deletedAt` timestamp), login is denied.
  - On success, signs a JWT with:
    - `sub`: user id
    - `companyId`: the company the user belongs to (if any)
    - `role`: the user's role (e.g. `SUPER_ADMIN`, `COMPANY_ADMIN`, `COMPANY_USER`, `MODERATOR`).
  - The token expiry is 30 days.
- Success (200):

  ```json
  {
    "token": "<jwt>",
    "user": {
      "id": "...",
      "username": "...",
      "email": "...",
      "name": "...",
      "role": "COMPANY_ADMIN",
      "companyId": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
  ```

  - The `user` object never includes the password hash.

- Error responses (examples):
  - `400 Bad Request`
    - Missing fields: `{ "error": "usernameOrEmail and password are required" }`
  - `401 Unauthorized`
    - Invalid credentials: `{ "error": "Invalid username/email or password" }`
  - `403 Forbidden`
    - User inactive or deleted: `{ "error": "User is inactive" }` or `{ "error": "User is deleted" }`
    - Company inactive or deleted: `{ "error": "Company is inactive or deleted" }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to login user", "requestId": "..." }`

## Using the token

- Include the returned JWT in the `Authorization` header for protected endpoints:
  ```http
  Authorization: Bearer <jwt>
  ```
- Many routes are company-scoped and will use the `companyId` and `role` from the token for authorization.
