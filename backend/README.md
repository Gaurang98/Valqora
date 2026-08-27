# Valqora Backend API

Express.js + MongoDB backend for the **Valqora** AI Revenue Decision & Recovery Engine.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set MONGODB_URI

# 3. Start (production)
npm start

# 4. Start (development with auto-reload)
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | No (default `5000`) | Port the server listens on |
| `MONGODB_URI` | **Yes** | MongoDB connection string (Atlas or local) |
| `NODE_ENV` | No | `development` or `production` |

> **Never commit `.env`** — it is excluded by `.gitignore`.

---

## API Reference

### `GET /api/health`

Health check for the Valqora backend process.

**Response `200`**
```json
{ "status": "Valqora backend running" }
```

---

### `POST /api/data/upload`

Upload a CSV file for ingestion into MongoDB.

**Request**
- Content-Type: `multipart/form-data`
- Form field name: `file`
- Accepted: `.csv` files up to **50 MB**

**Supported CSV** (first version): `transactions.csv`

**Response `200` — Upload complete**
```json
{
  "message": "Upload complete",
  "file": "transactions.csv",
  "totalRows": 100000,
  "validRows": 100000,
  "invalidRows": 0,
  "duplicateRows": 0,
  "insertedRows": 100000,
  "breakdown": {
    "inBatchDuplicates": 0,
    "dbDuplicates": 0,
    "invalidDetails": []
  }
}
```

**Error responses**
| Status | Meaning |
| :--- | :--- |
| `400` | No file attached, wrong file type, or file too large |
| `422` | CSV parse failed or empty file |
| `500` | Unexpected server or database error |

#### Required CSV Fields

| Field | Type | Validation Rules |
| :--- | :--- | :--- |
| `transaction_id` | String | Must be non-empty; **unique** |
| `customer_id` | String | Must be non-empty |
| `timestamp` | String / ISO Date | Must parse to a valid Date |
| `amount` | Number | Numeric, **must be > 0** |
| `currency` | String | Must be non-empty |
| `payment_method` | String | One of `UPI`, `CREDIT_CARD`, `DEBIT_CARD`, `NET_BANKING`, `WALLET` |
| `provider` | String | Must be non-empty |
| `status` | String | Must be `SUCCESS` or `FAILED` |
| `failure_reason` | String | Required; must **not** be `NONE` when `status = FAILED` |
| `retry_count` | Integer | Non-negative integer |
| `customer_type` | String | One of `NEW`, `REGULAR`, `HIGH_VALUE` |
| `customer_lifetime_value` | Number | Numeric, non-negative |
| `previous_failures` | Integer | Non-negative integer |

#### Optional Ground-Truth Fields (preserved for ML)

| Field | Values |
| :--- | :--- |
| `is_recoverable` | `YES`, `POSSIBLY`, `NO` |
| `ground_truth_action` | `NO_ACTION`, `RETRY`, `PAYMENT_LINK`, `PAYMENT_METHOD_UPDATE`, `WAIT`, `HUMAN_REVIEW` |
| `ground_truth_priority` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

#### Validation Behaviour

- Each row is validated independently. An invalid row is **flagged and skipped** — the upload does not crash.
- Invalid rows are counted and the first 20 are included in `breakdown.invalidDetails` for debugging.
- Data is **never silently modified**. If a row fails validation, it is excluded as-is.

#### Duplicate Handling

- **In-batch duplicates**: duplicate `transaction_id` values within the same uploaded CSV are detected and skipped (counted in `breakdown.inBatchDuplicates`).
- **Database duplicates**: `transaction_id` values already stored in MongoDB are checked and skipped (counted in `breakdown.dbDuplicates`).
- Both types contribute to the top-level `duplicateRows` count.
- Running the upload a second time with the same file produces `insertedRows: 0` and all rows reported as `duplicateRows`.

#### Normalization

Before insertion, all valid rows are normalized:
- `amount`, `retry_count`, `previous_failures`, `customer_lifetime_value` → `Number`
- `timestamp` → `Date`
- `currency` → uppercase
- All string fields have leading/trailing whitespace trimmed

---

### `GET /api/transactions`

Retrieve paginated transaction records from MongoDB.

**Query Parameters**

| Param | Default | Max | Description |
| :--- | :--- | :--- | :--- |
| `page` | `1` | — | Page number (1-indexed) |
| `limit` | `50` | `500` | Records per page |

**Response `200`**
```json
{
  "data": [ ...transaction objects ],
  "page": 1,
  "limit": 50,
  "total": 100000
}
```

**Error responses**
| Status | Meaning |
| :--- | :--- |
| `500` | Unexpected server or database error |

---

## Project Structure

```text
backend/
├── src/
│   ├── server.js                    # Entry point — connects DB then starts HTTP server
│   ├── app.js                       # Express app, middleware, route registration
│   ├── config/
│   │   └── db.js                    # Mongoose connection (reads MONGODB_URI from env)
│   ├── models/
│   │   └── Transaction.js           # Mongoose schema — unique index on transaction_id
│   ├── routes/
│   │   ├── health.js                # GET /api/health
│   │   ├── upload.js                # POST /api/data/upload
│   │   └── transactions.js          # GET /api/transactions
│   ├── controllers/
│   │   ├── uploadController.js      # CSV parse → validate → deduplicate → insert
│   │   └── transactionController.js # Paginated MongoDB query
│   └── middleware/
│       └── uploadMiddleware.js      # multer (memory storage, 50 MB cap, CSV-only)
├── .env                             # Local secrets (gitignored)
├── .env.example                     # Template
└── package.json
```
