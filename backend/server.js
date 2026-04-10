const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.path}`);
    next();
});
app.use(cors());
app.use(express.json());

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error(err));

// 🚀 Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/data', require('./routes/dataRoutes'));
app.use('/api/optimizations', require('./routes/optimizations'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/ml', require('./routes/mlRoutes'));
app.use('/api/simulation', require('./routes/simulationRoutes'));
app.use('/api/vessels', require('./routes/vesselRoutes'));
app.use('/api/budget', require('./routes/budgetRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));

// 📁 Serve static files from the project root
app.use(express.static(path.resolve(__dirname, '..')));

// 🔄 SPA Fallback: Serve index.html for non-API requests
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: `API route not found: ${req.path}` });
    }
    res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});

// 🛠️ Global Error Handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});