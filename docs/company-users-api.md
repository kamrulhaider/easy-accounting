# API Reference – Company users

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`).

All endpoints in this document are mounted under `/users` and are restricted to `COMPANY_ADMIN` users operating within their own company.

## POST /users

Create a new company user (role `COMPANY_USER`) within the authenticated admin's company.

- Role: `COMPANY_ADMIN`
- Authentication: **Required** (`Authorization: Bearer <token>`)
- Body (JSON):
  ```json
  {
    "username": "employee1",
    "email": "employee1@example.com",
    "password": "plain-text-password",
    "name": "Employee One",
    "phone": "+1-555-0000",
    "address": "123 Main St",
    "status": "ACTIVE"
  }
  ```
  - `username`, `email`, `password` are required.
  - `status` is optional; defaults to `ACTIVE` if omitted or invalid.
- Behavior:
  - Validates that the authenticated user is a `COMPANY_ADMIN` with a `companyId`.
  - Ensures `username` or `email` is not already taken.
  - Hashes the password and creates a `COMPANY_USER` in the admin's company.
- Success (201):
  ```json
  {
    "user": {
      "id": "...",
      "username": "employee1",
      "email": "employee1@example.com",
      "name": "Employee One",
      "phone": "+1-555-0000",
      "address": "123 Main St",
      "userRole": "COMPANY_USER",
      "status": "ACTIVE",
      "companyId": "...",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-01T12:00:00.000Z"
    }
  }
  ```
- Error responses (examples):
  - `400 Bad Request`
    - Missing required fields: `{ "error": "username, email, and password are required", "requestId": "..." }`
    - No company on actor: `{ "error": "No company context", "requestId": "..." }`
  - `403 Forbidden`
    - Actor is not a `COMPANY_ADMIN`: `{ "error": "Forbidden", "requestId": "..." }`
  - `409 Conflict`
    - Username or email already exists: `{ "error": "username or email already exists", "requestId": "..." }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to create user", "requestId": "..." }`

## GET /users

List company users for the authenticated admin's company.

- Role: `COMPANY_ADMIN`
- Authentication: **Required**
- Query parameters:
  - `q?` – optional search term; matches `username`, `email`, or `name` (case-insensitive).
  - `status?` – optional `CommonStatus` filter (e.g. `ACTIVE`, `INACTIVE`).
  - `limit?` – page size, 1–100 (default 50).
  - `offset?` – zero-based offset (default 0).
- Behavior:
  - Filters to users with `userRole = COMPANY_USER` within the admin's `companyId`, excluding `deletedAt` users.
  - Applies search and status filters when provided.
  - Returns users ordered by `createdAt` descending with pagination metadata.
- Success (200):
  ```json
  {
    "users": [
      {
        "id": "...",
        "username": "employee1",
        "email": "employee1@example.com",
        "name": "Employee One",
        "phone": "+1-555-0000",
        "address": "123 Main St",
        "status": "ACTIVE",
        "userRole": "COMPANY_USER",
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
  - `400 Bad Request`
    - No company on actor: `{ "error": "No company context", "requestId": "..." }`
  - `403 Forbidden`
    - Actor is not a `COMPANY_ADMIN`: `{ "error": "Forbidden", "requestId": "..." }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to list users", "requestId": "..." }`

## GET /users/:id

Get a single company user by id within the authenticated admin's company.

- Role: `COMPANY_ADMIN`
- Authentication: **Required**
- Path params:
  - `id` – user id
- Behavior:
  - Ensures actor is `COMPANY_ADMIN` with a `companyId`.
  - Looks up a non-deleted `COMPANY_USER` with the given `id` in the same company.
- Success (200):
  ```json
  {
    "user": {
      "id": "...",
      "username": "employee1",
      "email": "employee1@example.com",
      "name": "Employee One",
      "phone": "+1-555-0000",
      "address": "123 Main St",
      "status": "ACTIVE",
      "userRole": "COMPANY_USER",
      "companyId": "...",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-02T09:00:00.000Z"
    }
  }
  ```
- Error responses (examples):
  - `400 Bad Request`
    - Missing id: `{ "error": "User id required", "requestId": "..." }`
  - `400 Bad Request`
    - No company on actor: `{ "error": "No company context", "requestId": "..." }`
  - `403 Forbidden`
    - Actor is not a `COMPANY_ADMIN`: `{ "error": "Forbidden", "requestId": "..." }`
  - `404 Not Found`
    - User not found or not in this company: `{ "error": "User not found", "requestId": "..." }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to get user", "requestId": "..." }`

## PATCH /users/:id

Update basic fields for a company user within the admin's company.

- Role: `COMPANY_ADMIN`
- Authentication: **Required**
- Path params:
  - `id` – user id
- Body (JSON):
  ```json
  {
    "name": "Updated Name",
    "phone": "+1-555-1111",
    "address": "456 Second St",
    "status": "INACTIVE"
  }
  ```
  - All fields are optional; at least one valid field must be provided.
- Behavior:
  - Ensures the target user exists, is not soft-deleted, belongs to the same company, and has role `COMPANY_USER`.
  - Applies only provided, valid fields; rejects when no valid fields are present.
- Success (200):
  ```json
  {
    "user": {
      "id": "...",
      "username": "employee1",
      "email": "employee1@example.com",
      "name": "Updated Name",
      "phone": "+1-555-1111",
      "address": "456 Second St",
      "status": "INACTIVE",
      "userRole": "COMPANY_USER",
      "companyId": "...",
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-03T10:00:00.000Z"
    }
  }
  ```
- Error responses (examples):
  - `400 Bad Request`
    - Missing id: `{ "error": "User id required", "requestId": "..." }`
    - No valid fields: `{ "error": "No valid fields to update", "requestId": "..." }`
    - No company on actor: `{ "error": "No company context", "requestId": "..." }`
  - `403 Forbidden`
    - Actor is not `COMPANY_ADMIN` or target user not in same company / not `COMPANY_USER`: `{ "error": "Forbidden", "requestId": "..." }`
  - `404 Not Found`
    - User not found or soft-deleted: `{ "error": "User not found", "requestId": "..." }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to update user", "requestId": "..." }`

## DELETE /users/:id

Soft-delete a company user within the admin's company.

- Role: `COMPANY_ADMIN`
- Authentication: **Required**
- Path params:
  - `id` – user id
- Behavior:
  - Ensures the target `COMPANY_USER` exists, is not already soft-deleted, and belongs to the same company.
  - Rejects attempts to delete the acting admin themselves.
  - Sets `deletedAt` on the user record (soft delete) and returns a simple confirmation.
- Success (200):
  ```json
  {
    "ok": true,
    "id": "..."
  }
  ```
- Error responses (examples):
  - `400 Bad Request`
    - Missing id: `{ "error": "User id required", "requestId": "..." }`
    - Self-delete attempt: `{ "error": "Cannot delete yourself", "requestId": "..." }`
    - No company on actor: `{ "error": "No company context", "requestId": "..." }`
  - `403 Forbidden`
    - Actor is not `COMPANY_ADMIN` or target user not in same company / not `COMPANY_USER`: `{ "error": "Forbidden", "requestId": "..." }`
  - `404 Not Found`
    - User not found or already soft-deleted: `{ "error": "User not found", "requestId": "..." }`
  - `500 Internal Server Error`
    - Unexpected failure: `{ "error": "Failed to delete user", "requestId": "..." }`
