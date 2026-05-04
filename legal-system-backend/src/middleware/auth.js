const supabase = require('../config/supabase');
const { sendError } = require('../utils/response');

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches req.user = { id, email, role } on success.
 * Role is read from app_metadata (set server-side only — cannot be spoofed by users).
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Missing or invalid authorization header', 401);
  }

  const token = authHeader.split(' ')[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return sendError(res, 'Invalid or expired token', 401);
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.app_metadata?.role || 'intern',
  };

  next();
};

/**
 * Role-based access control middleware factory.
 * Usage: authorize('partner') or authorize('associate', 'partner')
 * Must be used after authenticate.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'You do not have permission to perform this action', 403);
    }
    next();
  };
};

// Role group constants — use these in authorize() calls instead of repeating role lists
const LEVEL_1 = ['intern', 'junior_associate', 'chambering'];
const LEVEL_1_AND_ASSOCIATE = [...LEVEL_1, 'associate'];
const STAFF = [...LEVEL_1, 'associate', 'partner', 'admin'];

module.exports = { authenticate, authorize, LEVEL_1, LEVEL_1_AND_ASSOCIATE, STAFF };
