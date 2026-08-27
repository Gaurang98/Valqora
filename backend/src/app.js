const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const uploadRoutes = require('./routes/upload');
const transactionRoutes = require('./routes/transactions');

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/data/upload', uploadRoutes);
app.use('/api/transactions', transactionRoutes);

// Fallback for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
