const express = require('express');
const router = express.Router();

// @route   GET /api/health
// @desc    Health check endpoint for Valqora backend
// @access  Public
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'Valqora backend running'
  });
});

module.exports = router;
