# API Reference – Application users (SUPER_ADMIN)

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`).

All endpoints in this document are mounted under `/users` and are restricted to `SUPER_ADMIN` users.

## GET /users/all

List all users in the application, with optional filters and pagination.

- Role: `SUPER_ADMIN`
- Authentication: **Required** (`Authorization: Bearer <token>`)
- Query parameters:
  - `q?` – optional search term; matches `username`, `email`, or `name` (case-insensitive).
  - `status?` – optional `CommonStatus` filter (e.g. `ACTIVE`, `INACTIVE`, `PENDING`, `SUSPENDED`).
  - `role?` – optional `UserRole` filter (e.g. `SUPER_ADMIN`, `MODERATOR`, `COMPANY_ADMIN`, `COMPANY_USER`).
  - `companyId?` – optional filter to only users belonging to a specific company.
  - `limit?` – page size, 1–100 (default 50).
  - `offset?` – zero-based offset (default 0).
- Behavior:
  - Ensures the authenticated actor has role `SUPER_ADMIN`.
  - Excludes soft-deleted users (`deletedAt` is null).
  - Applies optional search, status, role, and company filters.
  - Returns users ordered by `createdAt` descending with pagination metadata.
- Success (200):
  ```json
  {
    "users": [
      {
        "id": "...",
        "username": "admin",
        "email": "admin@example.com",
        "name": "Admin User",
        "phone": "+1-555-0000",
        "address": "123 Main St",
        "status": "ACTIVE",
        "userRole": "SUPER_ADMIN",
        "companyId": null,
        "createdAt": "2025-01-01T12:00:00.000Z",
        "updatedAt": "2025-01-02T09:00:00.000Z"
      }
    ],
    "total": 1,
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
- Error responses (examples):
  - `403 Forbidden`
    - Actor is not a `SUPER_ADMIN`:
      ```json
      { "error": "Forbidden", "requestId": "..." }
      ```
  - `500 Internal Server Error`
    - Unexpected failure:
      ```json
      { "error": "Failed to list users", "requestId": "..." }
      ```
