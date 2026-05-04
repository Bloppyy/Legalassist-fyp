const { sendError } = require('../utils/response');

/**
 * Global error handler — must be the last middleware registered in index.js.
 * Catches errors thrown via next(err) from any route or controller.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${statusCode}] ${message}`, err.stack);
  }

  return sendError(
    res,
    message,
    statusCode,
    process.env.NODE_ENV !== 'production' ? err.stack : undefined
  );
};

module.exports = errorHandler;
