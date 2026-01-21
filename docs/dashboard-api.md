# API Reference – Dashboard routes

Base URL: `http://localhost:4000`
Authentication: Bearer JWT in `Authorization` header (`Bearer <token>`). Error responses include `{ error, requestId }` when available.

All endpoints in this document are mounted under `/dashboard`.

## 1. Company summary – `/dashboard/company/summary`

Returns high-level KPIs for a single company over an optional date range.

- Method: `GET`
- Roles: `MODERATOR`, `COMPANY_ADMIN`
- Query parameters:
  - `companyId` (string)
    - Required for `MODERATOR`.
    - Optional for `COMPANY_ADMIN` (ignored if present but must match their own `companyId` if provided).
  - `startDate` (string, optional)
    - ISO date or `YYYY-MM-DD` (inclusive lower bound).
  - `endDate` (string, optional)
    - ISO date or `YYYY-MM-DD` (inclusive upper bound).

If only `startDate` is provided, the range is `[startDate, now]`.
If only `endDate` is provided, the range is `(-∞, endDate]`.

### Success response (200)

```json
{
  "companyId": "uuid-of-company",
  "period": {
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-12-31T23:59:59.000Z"
  },
  "summary": {
    "totalRevenue": 120000.5,
    "totalExpense": 80000.25,
    "netProfit": 40000.25,
    "journalEntryCount": 325,
    "activeAccountCount": 42
  }
}
```

### Notes

- `totalRevenue` aggregates lines on accounts of type `REVENUE` as `credit - debit`.
- `totalExpense` aggregates lines on accounts of type `EXPENSE` as `debit - credit`.
- `netProfit = totalRevenue - totalExpense`.

---

## 2. Last 12 months profit/loss – `/dashboard/company/profit-loss-12-months`

Provides per-month profit/loss data for the last 12 calendar months, suitable for a bar or line chart.

- Method: `GET`
- Roles: `MODERATOR`, `COMPANY_ADMIN`
- Query parameters:
  - `companyId` (string)
    - Required for `MODERATOR`.
    - Optional for `COMPANY_ADMIN` (must match their own `companyId` if provided).

The API looks back 12 months including the current month (UTC-based) and groups by month key `YYYY-MM`.

### Success response (200)

```json
{
  "companyId": "uuid-of-company",
  "period": {
    "startMonth": "2024-03",
    "endMonth": "2025-02"
  },
  "data": [
    {
      "month": "2024-03",
      "revenue": 10000,
      "expense": 7000,
      "net": 3000
    },
    {
      "month": "2024-04",
      "revenue": 8000,
      "expense": 9000,
      "net": -1000
    }
  ]
}
```

### Frontend usage

- Use `data` as your chart dataset.
- X-axis: `month` (`YYYY-MM`).
- Y-axis: `net` (for profit/loss), or separate series for `revenue` and `expense`.

---

## 3. Last 12 months journal entry counts – `/dashboard/company/journal-entries-12-months`

Provides the number of journal entries per month for the last 12 calendar months.

- Method: `GET`
- Roles: `MODERATOR`, `COMPANY_ADMIN`
- Query parameters:
  - `companyId` (string)
    - Required for `MODERATOR`.
    - Optional for `COMPANY_ADMIN` (must match their own `companyId` if provided).

Months with no entries are returned with `count: 0`.

### Success response (200)

```json
{
  "companyId": "uuid-of-company",
  "period": {
    "startMonth": "2024-03",
    "endMonth": "2025-02"
  },
  "data": [
    {
      "month": "2024-03",
      "count": 15
    },
    {
      "month": "2024-04",
      "count": 22
    }
  ]
}
```

### Frontend usage

- Ideal for a simple bar chart.
- X-axis: `month`.
- Y-axis: `count` (number of journal entries created in that month).

---

## Error responses

All routes may return structured error objects, for example:

- `401 Unauthorized` – missing or invalid token:
  ```json
  { "error": "Unauthorized" }
  ```
- `403 Forbidden` – user does not have one of the required roles or wrong `companyId`:
  ```json
  { "error": "Forbidden" }
  ```
- `400 Bad Request` – invalid dates or missing `companyId` for elevated roles:
  ```json
  { "error": "companyId required" }
  ```
- `500 Internal Server Error` – unexpected failure:
  ```json
  { "error": "Failed to fetch ...", "requestId": "..." }
  ```
