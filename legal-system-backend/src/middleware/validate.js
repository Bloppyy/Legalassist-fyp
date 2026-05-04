const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Reads the result of express-validator checks that ran before this middleware.
 * Returns a 422 with the error array if any fields failed validation.
 * Place this after your validator chain and before your controller in the route.
 *
 * Usage:
 *   router.post('/', [body('title').notEmpty()], validate, controller.create);
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 422, errors.array());
  }
  next();
};

module.exports = validate;
