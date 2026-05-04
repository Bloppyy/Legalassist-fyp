const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

/**
 * GET /api/notifications
 * List all notifications for the authenticated user, newest first.
 * Supports ?unread=true to filter unread only.
 */
const getAll = async (req, res, next) => {
  try {
    const { unread } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (unread === 'true') {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read. User can only mark their own.
 */
const markRead = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !existing) return next(createError(404, 'Notification not found'));

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications for the authenticated user as read.
 */
const markAllRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;

    return sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, markRead, markAllRead };
