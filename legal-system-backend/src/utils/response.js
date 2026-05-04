/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} message
 * @param {number} statusCode
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, data, message, error: null });
};

/**
 * Send an error JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 * @param {*} error
 */
const sendError = (res, message = 'An error occurred', statusCode = 500, error = null) => {
  return res.status(statusCode).json({ success: false, data: null, message, error });
};

/**
 * Create an error object with a statusCode property for use with next(err).
 * @param {number} statusCode
 * @param {string} message
 */
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { sendSuccess, sendError, createError };
