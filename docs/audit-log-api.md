# API Reference – Audit Logs

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

## Audit Logs (`/audit-logs`)

Requires `Authorization: Bearer <token>`. Access control varies by role.

### GET /audit-logs

- Role: `SUPER_ADMIN` (sees all audit logs); `COMPANY_ADMIN` (only their company's logs)
- Query parameters (all optional):
  - `companyId` (string): Filter by company ID (SUPER_ADMIN only, ignored for COMPANY_ADMIN)
  - `userId` (string): Filter by user ID who performed the action
  - `entity` (string): Filter by entity type (e.g., "Company", "User", "Account", case-insensitive partial match)
  - `action` (string): Filter by action type (e.g., "create", "update", "delete", case-insensitive partial match)
  - `limit` (number): Results per page, range 1-100 (default 50)
  - `offset` (number): Number of records to skip (default 0)
- Returns audit logs ordered by timestamp descending (most recent first).
- Each audit log includes:
  - `id`: Unique audit log ID
  - `action`: Action performed (e.g., "create", "update", "delete")
  - `entity`: Entity type (e.g., "Company", "User", "Account")
  - `entityId`: ID of the affected entity
  - `timestamp`: When the action occurred
  - `companyId`: ID of the company context
  - `userId`: ID of the user who performed the action
  - `company`: Company details with `{ id, name, email }`
  - `user`: User details with `{ id, username, email, name, userRole }`
- Success: `200 { auditLogs: [...], total, pagination: { limit, offset, currentPage, pageCount, itemsOnPage, hasNextPage, hasPrevPage, nextOffset, prevOffset } }`
- Errors:
  - `401` unauthorized (no valid token)
  - `403` forbidden (insufficient role or COMPANY_ADMIN without companyId)
  - `500` on failure

**Role-based filtering:**

- `SUPER_ADMIN`: Can see all audit logs across all companies. Can optionally filter by `companyId` to narrow results.
- `COMPANY_ADMIN`: Automatically restricted to audit logs for their assigned company only. The `companyId` filter is ignored for this role.

**Example Request (SUPER_ADMIN):**

```http
GET /audit-logs?entity=Company&action=create&limit=20&offset=0
Authorization: Bearer <super_admin_token>
```

**Example Response:**

```json
{
  "auditLogs": [
    {
      "id": "log-uuid-123",
      "action": "create",
      "entity": "Company",
      "entityId": "company-uuid-456",
      "timestamp": "2026-01-16T10:30:00.000Z",
      "companyId": "company-uuid-456",
      "userId": "user-uuid-789",
      "company": {
        "id": "company-uuid-456",
        "name": "Acme Corp",
        "email": "contact@acme.com"
      },
      "user": {
        "id": "user-uuid-789",
        "username": "admin",
        "email": "admin@example.com",
        "name": "Admin User",
        "userRole": "SUPER_ADMIN"
      }
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

**Example Request (COMPANY_ADMIN):**

```http
GET /audit-logs?userId=user-uuid-101&limit=10
Authorization: Bearer <company_admin_token>
```

Response will include only audit logs from the company that the `COMPANY_ADMIN` belongs to, filtered by `userId`.

**Pagination:**

- Use `limit` and `offset` to paginate through results.
- `pagination.nextOffset` and `pagination.prevOffset` provide convenient values for next/previous page navigation.
- `pagination.hasNextPage` and `pagination.hasPrevPage` indicate if more pages exist.

**Notes:**

- Audit logs are automatically created by the system for mutations (create, update, delete operations) on key entities when performed within an authenticated request context.
- The audit log system uses AsyncLocalStorage to capture user and company context automatically.
- Timestamps are in UTC ISO 8601 format.
