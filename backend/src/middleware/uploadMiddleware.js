const multer = require('multer');

/**
 * Multer middleware for Valqora CSV ingestion.
 *
 * Files are held in memory (not persisted to disk) so that the CSV stream
 * can be parsed directly from the buffer.  The 50 MB ceiling comfortably
 * accommodates the 100 k-row transactions.csv (~12 MB) while refusing
 * unreasonably large payloads.
 */

const FIFTY_MB = 50 * 1024 * 1024; // 50 MB in bytes

const storage = multer.memoryStorage();

/**
 * Only accept files whose mimetype or original extension indicates CSV.
 * Using both checks adds resilience against clients that send incorrect
 * MIME types (e.g. text/plain when the file is actually a .csv).
 */
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['text/csv', 'application/csv', 'text/plain'];
  const isCSVExt = file.originalname.toLowerCase().endsWith('.csv');
  const isCSVMime = allowedMimes.includes(file.mimetype);

  if (isCSVExt || isCSVMime) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        'Only CSV files are accepted. Please upload a .csv file.'
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: FIFTY_MB },
  fileFilter,
});

module.exports = upload;
