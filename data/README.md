# Valqora Synthetic Datasets

> **Note**: All datasets in this directory are purely **synthetic** and generated deterministically for testing, benchmarking, and training the **Valqora** AI Revenue Decision & Recovery Engine prototype. No real customer or financial data is stored.

---

## 📁 Dataset Files

This directory contains three relational synthetic CSV datasets generated with a fixed random seed (`42`):

```text
data/
├── customers.csv      # 25,000 unique customer historical profiles
├── transactions.csv   # Exactly 100,000 transactions with ground-truth recovery labels
├── events.csv         # 17,000+ lifecycle events, abandonments & degradation telemetry
└── README.md          # Dataset documentation and regeneration instructions
```

---

## 📊 File Schemas & Descriptions

### 1. `customers.csv` (25,000 records)
Customer profiles capturing purchasing history, spending tiers, and lifetime value.

| Column | Type | Description |
| :--- | :--- | :--- |
| `customer_id` | String | Unique customer identifier (e.g. `CUST_00001` - `CUST_25000`) |
| `customer_type` | String | Segmentation tier: `NEW`, `REGULAR`, or `HIGH_VALUE` |
| `total_spent` | Float | Cumulative historical spending in INR |
| `purchase_count` | Integer | Total count of completed purchases |
| `average_order_value` | Float | Mean order value (AOV) in INR |
| `previous_failures` | Integer | Historical payment failure count |
| `successful_transactions` | Integer | Historical successful transaction count |
| `last_purchase_date` | Timestamp | Timestamp of the customer's last purchase |
| `customer_lifetime_value` | Float | Projected Customer Lifetime Value (CLV) in INR |

---

### 2. `transactions.csv` (Exactly 100,000 records)
Transaction log featuring Indian payment rails, synthetic providers, failure reasons, and deterministic ground-truth labels.

| Column | Type | Description |
| :--- | :--- | :--- |
| `transaction_id` | String | Unique transaction identifier (`TXN_000001` - `TXN_100000`) |
| `customer_id` | String | Foreign key reference to `customers.csv` |
| `timestamp` | Timestamp | Transaction occurrence timestamp across a 60-day window |
| `amount` | Float | Transaction amount in INR |
| `currency` | String | Currency code (`INR`) |
| `payment_method` | String | `UPI`, `CREDIT_CARD`, `DEBIT_CARD`, `NET_BANKING`, `WALLET` |
| `provider` | String | Synthetic acquirer / gateway (`Provider_A`, `Provider_B`, `Provider_C`, `Provider_D`) |
| `status` | String | `SUCCESS` (~93.3%) or `FAILED` (~6.7%) |
| `failure_reason` | String | `NONE` for success; failure categories detailed below |
| `retry_count` | Integer | Number of automated/manual retries already attempted (0 to 4) |
| `customer_type` | String | Customer tier at the time of transaction (`NEW`, `REGULAR`, `HIGH_VALUE`) |
| `customer_lifetime_value` | Float | Customer CLV in INR |
| `previous_failures` | Integer | Customer historical failure count |
| `is_recoverable` | String | `YES` (high likelihood), `POSSIBLY` (action needed), `NO` |
| `ground_truth_action` | String | Recommended recovery action (see definitions below) |
| `ground_truth_priority` | String | Operational urgency: `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |

#### Failure Categories:
- **Temporary / Infrastructure**: `BANK_TIMEOUT`, `PROVIDER_TIMEOUT`, `NETWORK_ERROR`
- **Customer / Payment Method Action**: `CARD_EXPIRED`, `INSUFFICIENT_FUNDS`, `INVALID_CARD`, `PAYMENT_METHOD_EXPIRED`, `RECURRING_PAYMENT_FAILED`
- **Fraud / Risk**: `SUSPICIOUS_TRANSACTION`

#### Ground-Truth Action Labels:
- `NO_ACTION`: For successful transactions.
- `RETRY`: Automated gateway retry via exponential backoff (for temporary failures with `retry_count <= 1`).
- `PAYMENT_LINK`: Dispatch 1-click tokenized payment recovery link via WhatsApp/Email.
- `PAYMENT_METHOD_UPDATE`: Prompt customer to update or re-tokenize card details.
- `WAIT`: Hold retries until salary/payday credit cycles (e.g. for `INSUFFICIENT_FUNDS` near month-end).
- `HUMAN_REVIEW`: Flag suspicious transactions for risk/compliance officer review.

---

### 3. `events.csv` (17,000+ records)
Event stream capturing transaction lifecycle stages, policy guardrail evaluations, checkout abandonments, and provider degradation incidents.

| Column | Type | Description |
| :--- | :--- | :--- |
| `event_id` | String | Unique event identifier (`EVT_0000001` onwards) |
| `timestamp` | Timestamp | Timestamp of event occurrence |
| `event_type` | String | `PAYMENT_FAILED`, `PAYMENT_RETRY`, `CHECKOUT_ABANDONED`, `PROVIDER_DEGRADATION`, `PAYMENT_RECOVERED`, `POLICY_BLOCKED` |
| `transaction_id` | String | Foreign key to `transactions.csv` (empty for abandonments/telemetry) |
| `customer_id` | String | Foreign key to `customers.csv` |
| `provider` | String | Target payment provider |
| `severity` | String | `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `metadata` | JSON String | Structured payload containing telemetry, error codes, policy rules, or cart intent scores |

---

## 🔄 How to Regenerate the Datasets

To regenerate all datasets deterministically:

```bash
# From the repository root
python ml/generate_dataset.py
```

The generator will:
1. Initialize the fixed seed (`42`).
2. Generate all 3 CSV files into `data/`.
3. Perform strict validation checks (record counts, foreign key integrity, label rules).
4. Print statistical distributions and summary metrics.
