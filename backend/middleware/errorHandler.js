// Centralized error handling middleware
module.exports = function errorHandler(err, req, res, next) {
    console.error('ErrorHandler:', err && err.stack ? err.stack : err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
};
