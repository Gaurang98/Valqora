const { Readable } = require('stream');
const csvParser = require('csv-parser');
const Transaction = require('../models/Transaction');

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['SUCCESS', 'FAILED']);

const REQUIRED_FIELDS = [
  'transaction_id',
  'customer_id',
  'timestamp',
  'amount',
  'currency',
  'payment_method',
  'provider',
  'status',
  'failure_reason',
  'retry_count',
  'customer_type',
  'customer_lifetime_value',
  'previous_failures',
];

const OPTIONAL_GT_FIELDS = [
  'is_recoverable',
  'ground_truth_action',
  'ground_truth_priority',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse the CSV buffer into an array of raw row objects.
 * Returns a Promise that resolves with { rows, parseError }.
 */
function parseCSVBuffer(buffer) {
  return new Promise((resolve) => {
    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csvParser({ trim: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve({ rows, parseError: null }))
      .on('error', (err) => resolve({ rows: [], parseError: err.message }));
  });
}

/**
 * Validate a single raw CSV row.
 * Returns { valid: true, data: <normalised> } or { valid: false, reason: <string> }.
 */
function validateAndNormalise(raw) {
  // 1. Required field presence
  for (const field of REQUIRED_FIELDS) {
    const val = raw[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  // Trim string fields
  const trimmed = {};
  for (const key of Object.keys(raw)) {
    trimmed[key] = typeof raw[key] === 'string' ? raw[key].trim() : raw[key];
  }

  // 2. timestamp – must parse to a real Date
  const ts = new Date(trimmed.timestamp);
  if (isNaN(ts.getTime())) {
    return { valid: false, reason: `Invalid timestamp: "${trimmed.timestamp}"` };
  }

  // 3. amount – numeric and > 0
  const amount = Number(trimmed.amount);
  if (isNaN(amount)) {
    return { valid: false, reason: `amount is not numeric: "${trimmed.amount}"` };
  }
  if (amount <= 0) {
    return { valid: false, reason: `amount must be greater than 0, got: ${amount}` };
  }

  // 4. retry_count – non-negative integer
  const retryCount = Number(trimmed.retry_count);
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    return {
      valid: false,
      reason: `retry_count must be a non-negative integer, got: "${trimmed.retry_count}"`,
    };
  }

  // 5. previous_failures – non-negative integer
  const prevFailures = Number(trimmed.previous_failures);
  if (!Number.isInteger(prevFailures) || prevFailures < 0) {
    return {
      valid: false,
      reason: `previous_failures must be a non-negative integer, got: "${trimmed.previous_failures}"`,
    };
  }

  // 6. customer_lifetime_value – numeric and non-negative
  const clv = Number(trimmed.customer_lifetime_value);
  if (isNaN(clv) || clv < 0) {
    return {
      valid: false,
      reason: `customer_lifetime_value must be numeric and non-negative, got: "${trimmed.customer_lifetime_value}"`,
    };
  }

  // 7. status – must be SUCCESS or FAILED
  const status = trimmed.status;
  if (!VALID_STATUSES.has(status)) {
    return {
      valid: false,
      reason: `status must be SUCCESS or FAILED, got: "${status}"`,
    };
  }

  // 8. failure_reason cross-check
  const failureReason = trimmed.failure_reason;
  if (status === 'FAILED' && failureReason === 'NONE') {
    return {
      valid: false,
      reason: `FAILED transaction must have a non-NONE failure_reason`,
    };
  }
  // (SUCCESS + non-NONE failure_reason is a data quality warning but not fatal —
  //  we do not silently overwrite, instead we pass it through as-is so the operator
  //  can see the raw data in MongoDB and decide.)

  // ─── Build normalised document ────────────────────────────────────────────
  const doc = {
    transaction_id: trimmed.transaction_id,
    customer_id: trimmed.customer_id,
    timestamp: ts,
    amount,
    currency: trimmed.currency.toUpperCase(),
    payment_method: trimmed.payment_method,
    provider: trimmed.provider,
    status,
    failure_reason: failureReason,
    retry_count: retryCount,
    customer_type: trimmed.customer_type,
    customer_lifetime_value: clv,
    previous_failures: prevFailures,
  };

  // Preserve optional ground-truth fields when present
  for (const field of OPTIONAL_GT_FIELDS) {
    if (trimmed[field] !== undefined && trimmed[field] !== null) {
      doc[field] = trimmed[field];
    }
  }

  return { valid: true, data: doc };
}

// ─── Controller: POST /api/data/upload ───────────────────────────────────────

/**
 * Handle CSV upload, parse → validate → deduplicate → insert.
 *
 * Steps:
 *   1. Verify a file was attached and is a CSV.
 *   2. Parse the in-memory buffer with csv-parser.
 *   3. Validate every row; collect invalid rows with reasons (do not crash).
 *   4. Detect in-batch duplicates (same transaction_id appearing twice in the CSV).
 *   5. Detect cross-batch duplicates already stored in MongoDB.
 *   6. Bulk-insert valid, non-duplicate rows.
 *   7. Return a structured JSON summary.
 */
exports.uploadCSV = async (req, res) => {
  try {
    // ── 1. File presence & type check ──────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded. Please attach a CSV file using the "file" field.',
      });
    }

    const filename = req.file.originalname || '';
    const isCSV =
      filename.toLowerCase().endsWith('.csv') ||
      ['text/csv', 'application/csv', 'text/plain'].includes(req.file.mimetype);

    if (!isCSV) {
      return res.status(400).json({
        error: 'Invalid file type. Only CSV files are accepted.',
      });
    }

    // ── 2. Parse CSV from buffer ────────────────────────────────────────────
    const { rows, parseError } = await parseCSVBuffer(req.file.buffer);

    if (parseError) {
      return res.status(422).json({
        error: `CSV parsing failed: ${parseError}`,
      });
    }

    const totalRows = rows.length;

    if (totalRows === 0) {
      return res.status(422).json({
        error: 'The uploaded CSV contains no data rows (or only a header row).',
      });
    }

    // ── 3. Validate every row ───────────────────────────────────────────────
    const validDocs = [];
    const invalidRows = [];
    const seenInBatch = new Map(); // transaction_id → first row index (1-based)
    let inBatchDuplicates = 0;

    for (let i = 0; i < rows.length; i++) {
      const result = validateAndNormalise(rows[i]);

      if (!result.valid) {
        invalidRows.push({ row: i + 1, reason: result.reason });
        continue;
      }

      const txnId = result.data.transaction_id;

      // ── 4. In-batch duplicate detection ──────────────────────────────────
      if (seenInBatch.has(txnId)) {
        inBatchDuplicates++;
        invalidRows.push({
          row: i + 1,
          reason: `Duplicate transaction_id in CSV (first seen at row ${seenInBatch.get(txnId)}): ${txnId}`,
        });
        continue;
      }

      seenInBatch.set(txnId, i + 1);
      validDocs.push(result.data);
    }

    // ── 5. Cross-batch duplicate detection (MongoDB) ────────────────────────
    const incomingIds = validDocs.map((d) => d.transaction_id);
    let existingIds = new Set();

    if (incomingIds.length > 0) {
      const found = await Transaction.find(
        { transaction_id: { $in: incomingIds } },
        { transaction_id: 1, _id: 0 }
      ).lean();
      existingIds = new Set(found.map((d) => d.transaction_id));
    }

    const newDocs = [];
    let dbDuplicates = 0;

    for (const doc of validDocs) {
      if (existingIds.has(doc.transaction_id)) {
        dbDuplicates++;
      } else {
        newDocs.push(doc);
      }
    }

    const totalDuplicates = inBatchDuplicates + dbDuplicates;

    // ── 6. Bulk insert ──────────────────────────────────────────────────────
    let insertedRows = 0;

    if (newDocs.length > 0) {
      // ordered: false — continue even if an individual doc fails (safety net)
      const result = await Transaction.insertMany(newDocs, {
        ordered: false,
        lean: true,
      });
      insertedRows = result.length;
    }

    // ── 7. Response summary ─────────────────────────────────────────────────
    return res.status(200).json({
      message: 'Upload complete',
      file: filename,
      totalRows,
      validRows: validDocs.length,
      invalidRows: invalidRows.length,
      duplicateRows: totalDuplicates,
      insertedRows,
      // Breakdown for transparency (omit if you prefer a leaner response)
      breakdown: {
        inBatchDuplicates,
        dbDuplicates,
        invalidDetails: invalidRows.slice(0, 20), // first 20 invalid rows for debugging
      },
    });
  } catch (err) {
    console.error('[uploadCSV] Unexpected error:', err.message);

    // Handle Mongoose bulk-write duplicate-key errors that slipped through
    if (err.code === 11000) {
      return res.status(422).json({
        error: 'One or more transactions already exist in the database (duplicate key).',
      });
    }

    return res.status(500).json({
      error: 'An unexpected server error occurred during upload. Please try again.',
    });
  }
};
