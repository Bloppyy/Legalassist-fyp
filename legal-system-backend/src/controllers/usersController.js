const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

/**
 * GET /api/users/me
 * Returns the authenticated user's profile from the users table.
 * Schema columns: id, name, email, role, created_at
 */
const getProfile = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, supervisor_id, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) return next(createError(404, 'User profile not found'));

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/me
 * Updates the authenticated user's name.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', req.user.id)
      .select('id, name, email, role, created_at')
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Profile updated');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users
 * List all users. Associate, partner, and admin only.
 * Useful for assigning cases or looking up colleagues.
 */
const getAll = async (req, res, next) => {
  try {
    const { role, search } = req.query;

    let query = supabase
      .from('users')
      .select('id, name, email, role, supervisor_id, created_at')
      .order('name', { ascending: true });

    if (role) query = query.eq('role', role);
    if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/role
 * Admin only — change any user's role.
 * Updates both the users table AND Supabase Auth app_metadata so the JWT
 * role claim stays in sync with what auth middleware reads.
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Update Supabase Auth app_metadata first — this is what the JWT will carry
    const { error: authError } = await supabase.auth.admin.updateUserById(id, {
      app_metadata: { role },
    });

    if (authError) return next(createError(404, 'User not found in auth'));

    // Keep the users table in sync
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', id)
      .select('id, name, email, role, supervisor_id, created_at')
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'Role updated');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * Admin only — create a new user account.
 * Creates the Supabase Auth user with the given role in app_metadata,
 * then inserts a matching row into the users table.
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, supervisor_id } = req.body;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
    });

    if (authError) {
      if (authError.message?.toLowerCase().includes('already registered')) {
        return next(createError(409, 'A user with this email already exists'));
      }
      throw authError;
    }

    const { data, error } = await supabase
      .from('users')
      .insert({ id: authData.user.id, name, email, role, supervisor_id: supervisor_id || null })
      .select('id, name, email, role, supervisor_id, created_at')
      .single();

    if (error) throw error;

    return sendSuccess(res, data, 'User created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/users/:id
 * Admin only — permanently delete a user.
 * Removes from Supabase Auth and the users table.
 * Admin cannot delete their own account.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return next(createError(400, 'You cannot delete your own account'));
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) return next(createError(404, 'User not found'));

    // Row will cascade-delete if FK is set up, but delete explicitly to be safe
    await supabase.from('users').delete().eq('id', id);

    return sendSuccess(res, null, 'User deleted');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id/supervisor
 * Admin only — assign or clear supervisor for junior_associate / chambering users.
 */
const updateUserSupervisor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { supervisor_id } = req.body;

    const { data, error } = await supabase
      .from('users')
      .update({ supervisor_id: supervisor_id || null })
      .eq('id', id)
      .select('id, name, email, role, supervisor_id, created_at')
      .single();

    if (error) return next(createError(404, 'User not found'));

    return sendSuccess(res, data, 'Supervisor updated');
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, getAll, createUser, updateUserRole, updateUserSupervisor, deleteUser };
