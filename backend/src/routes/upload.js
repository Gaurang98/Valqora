const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { uploadCSV } = require('../controllers/uploadController');

/**
 * POST /api/data/upload
 *
 * Accepts a CSV file via multipart/form-data.
 * Field name: "file"
 *
 * Steps handled by the controller:
 *   1. Parse CSV rows from in-memory buffer
 *   2. Validate each row against required field rules
 *   3. Detect in-batch and database duplicates
 *   4. Bulk-insert valid, unique rows into MongoDB
 *   5. Return structured JSON summary
 *
 * Errors from multer (file too large, wrong type) are caught here and returned
 * as clean JSON instead of the default Express error format.
 */
router.post(
  '/',
  (req, res, next) => {
    // Run multer and convert any MulterError into a clean 400 JSON response
    upload.single('file')(req, res, (err) => {
      if (err) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large. Maximum allowed size is 50 MB.'
            : err.message || 'File upload error.';
        return res.status(400).json({ error: message });
      }
      next();
    });
  },
  uploadCSV
);

module.exports = router;
